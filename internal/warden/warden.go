// Package warden implements the small, host-local SwarmOps release updater.
// It accepts only GitHub release assets, validates their checksum, checks a
// loopback health endpoint, and restores the previous known-good release when
// a candidate does not start correctly.
package warden

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"runtime"
	"sort"
	"strings"
	"time"
)

const (
	defaultAPIBaseURL     = "https://api.github.com"
	defaultHealthTimeout  = 45 * time.Second
	defaultHealthInterval = time.Second
	maxChecksumBytes      = 1 << 20
	maxBundleBytes        = 256 << 20
	maxExtractedBytes     = 512 << 20
)

var (
	repositoryPattern = regexp.MustCompile(`^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$`)
	versionPattern    = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]*$`)
	assetFilePattern  = regexp.MustCompile(`^assets/[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?\.yml$`)
)

// ServiceManager controls one fixed, local service. Implementations must not
// pass user-controlled text to a shell.
type ServiceManager interface {
	Stop(context.Context) error
	Start(context.Context) error
}

// Config describes one installed component. ReleaseDir contains version
// directories and a current symlink; neither application data nor secrets are
// stored beneath it.
type Config struct {
	Repository     string
	Component      string
	ReleaseDir     string
	HealthURL      string
	APIBaseURL     string
	HealthTimeout  time.Duration
	HealthInterval time.Duration
	HTTPClient     *http.Client
	Service        ServiceManager
	OS             string
	Arch           string
}

// Result records a completed update attempt. An error is returned when the
// candidate was not healthy even if rollback restored the prior release.
type Result struct {
	Version    string
	Updated    bool
	RolledBack bool
}

type releasePayload struct {
	TagName string         `json:"tag_name"`
	Assets  []releaseAsset `json:"assets"`
}

type releaseAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// Update obtains the latest published release when requestedVersion is empty,
// or an exact published release otherwise. It only switches current after the
// candidate has been checksum-verified and unpacked into a private staging
// directory.
func Update(ctx context.Context, config Config, requestedVersion string) (Result, error) {
	config, err := normalize(config)
	if err != nil {
		return Result{}, err
	}
	if requestedVersion != "" && !validVersion(requestedVersion) {
		return Result{}, fmt.Errorf("release version has unsupported characters")
	}
	previous, err := currentVersion(config.ReleaseDir)
	if err != nil {
		return Result{}, fmt.Errorf("read installed release: %w", err)
	}
	release, err := fetchRelease(ctx, config, requestedVersion)
	if err != nil {
		return Result{}, err
	}
	if release.TagName == previous {
		return Result{Version: release.TagName}, nil
	}

	bundleName := fmt.Sprintf("swarmops-%s_%s_%s_%s.tar.gz", config.Component, release.TagName, config.OS, config.Arch)
	checksumAsset, ok := findAsset(release.Assets, "checksums.txt")
	if !ok {
		return Result{}, fmt.Errorf("release %s does not publish checksums.txt", release.TagName)
	}
	bundleAsset, ok := findAsset(release.Assets, bundleName)
	if !ok {
		return Result{}, fmt.Errorf("release %s has no %s", release.TagName, bundleName)
	}
	checksums, err := download(ctx, config.HTTPClient, checksumAsset.BrowserDownloadURL, maxChecksumBytes)
	if err != nil {
		return Result{}, fmt.Errorf("download release checksums: %w", err)
	}
	bundle, err := download(ctx, config.HTTPClient, bundleAsset.BrowserDownloadURL, maxBundleBytes)
	if err != nil {
		return Result{}, fmt.Errorf("download release bundle: %w", err)
	}
	if err := verifyChecksum(checksums, bundleName, bundle); err != nil {
		return Result{}, fmt.Errorf("verify release bundle: %w", err)
	}
	candidate, err := stageBundle(config.ReleaseDir, release.TagName, config.Component, bundle)
	if err != nil {
		return Result{}, fmt.Errorf("stage release %s: %w", release.TagName, err)
	}
	removeCandidate := func() {
		if candidate != "" {
			_ = os.RemoveAll(candidate)
		}
	}
	if err := config.Service.Stop(ctx); err != nil {
		removeCandidate()
		return Result{}, fmt.Errorf("stop current service before update: %w", err)
	}
	if err := switchCurrent(config.ReleaseDir, release.TagName); err != nil {
		if restartErr := config.Service.Start(ctx); restartErr != nil {
			removeCandidate()
			return Result{}, fmt.Errorf("switch to release %s: %w; restart previous service: %v", release.TagName, err, restartErr)
		}
		removeCandidate()
		return Result{}, fmt.Errorf("switch to release %s: %w", release.TagName, err)
	}
	candidateErr := config.Service.Start(ctx)
	if candidateErr == nil {
		candidateErr = waitForHealth(ctx, config.HealthURL, config.HealthTimeout, config.HealthInterval)
	}
	if candidateErr == nil {
		if touchErr := os.Chtimes(candidate, time.Now(), time.Now()); touchErr != nil {
			return Result{Version: release.TagName, Updated: true}, fmt.Errorf("release %s is healthy but could not record update time: %w", release.TagName, touchErr)
		}
		if pruneErr := prune(config.ReleaseDir, release.TagName); pruneErr != nil {
			return Result{Version: release.TagName, Updated: true}, fmt.Errorf("release %s is healthy but retention cleanup failed: %w", release.TagName, pruneErr)
		}
		return Result{Version: release.TagName, Updated: true}, nil
	}

	rollbackErr := rollback(ctx, config, previous, candidate)
	if rollbackErr != nil {
		return Result{Version: release.TagName, RolledBack: true}, fmt.Errorf("release %s failed health validation: %w; rollback failed: %v", release.TagName, candidateErr, rollbackErr)
	}
	return Result{Version: release.TagName, RolledBack: true}, fmt.Errorf("release %s failed health validation and was rolled back: %w", release.TagName, candidateErr)
}

func normalize(config Config) (Config, error) {
	config.Repository = strings.TrimSpace(config.Repository)
	if config.Repository == "" {
		config.Repository = "nimasrn/SwarmOps"
	}
	if !repositoryPattern.MatchString(config.Repository) {
		return Config{}, fmt.Errorf("repository must be owner/name")
	}
	if config.Component != "agent" && config.Component != "core" {
		return Config{}, fmt.Errorf("component must be agent or core")
	}
	if !filepath.IsAbs(config.ReleaseDir) || filepath.Clean(config.ReleaseDir) == string(filepath.Separator) {
		return Config{}, fmt.Errorf("release directory must be an absolute, non-root path")
	}
	if config.Service == nil {
		return Config{}, fmt.Errorf("service manager is required")
	}
	if config.APIBaseURL == "" {
		config.APIBaseURL = defaultAPIBaseURL
	}
	apiURL, err := url.Parse(config.APIBaseURL)
	if err != nil || apiURL.Scheme == "" || apiURL.Host == "" || apiURL.User != nil {
		return Config{}, fmt.Errorf("release API URL must be an absolute URL without credentials")
	}
	if apiURL.Scheme != "https" && !isLoopbackHost(apiURL.Hostname()) {
		return Config{}, fmt.Errorf("release API URL must use HTTPS")
	}
	if config.HealthTimeout <= 0 {
		config.HealthTimeout = defaultHealthTimeout
	}
	if config.HealthInterval <= 0 {
		config.HealthInterval = defaultHealthInterval
	}
	if config.HealthInterval > config.HealthTimeout {
		return Config{}, fmt.Errorf("health interval must not exceed health timeout")
	}
	if err := validateLoopbackHealthURL(config.HealthURL); err != nil {
		return Config{}, err
	}
	if config.HTTPClient == nil {
		config.HTTPClient = &http.Client{Timeout: 30 * time.Second}
	}
	if config.OS == "" {
		config.OS = runtime.GOOS
	}
	if config.Arch == "" {
		config.Arch = runtime.GOARCH
	}
	if !validVersion(config.OS) || !validVersion(config.Arch) {
		return Config{}, fmt.Errorf("platform has unsupported characters")
	}
	return config, nil
}

func fetchRelease(ctx context.Context, config Config, requestedVersion string) (releasePayload, error) {
	endpoint := strings.TrimRight(config.APIBaseURL, "/") + "/repos/" + config.Repository + "/releases/latest"
	if requestedVersion != "" {
		endpoint = strings.TrimRight(config.APIBaseURL, "/") + "/repos/" + config.Repository + "/releases/tags/" + url.PathEscape(requestedVersion)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return releasePayload{}, fmt.Errorf("create release request: %w", err)
	}
	request.Header.Set("Accept", "application/vnd.github+json")
	releaseClient := *config.HTTPClient
	previousRedirect := releaseClient.CheckRedirect
	releaseClient.CheckRedirect = func(next *http.Request, via []*http.Request) error {
		if !allowedReleaseURL(next.URL) || next.URL.User != nil {
			return fmt.Errorf("release metadata redirect must use HTTPS without credentials")
		}
		if previousRedirect != nil {
			return previousRedirect(next, via)
		}
		return nil
	}
	response, err := releaseClient.Do(request)
	if err != nil {
		return releasePayload{}, fmt.Errorf("request release metadata: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return releasePayload{}, fmt.Errorf("release metadata returned HTTP %d", response.StatusCode)
	}
	decoder := json.NewDecoder(io.LimitReader(response.Body, maxChecksumBytes))
	var release releasePayload
	if err := decoder.Decode(&release); err != nil {
		return releasePayload{}, fmt.Errorf("decode release metadata: %w", err)
	}
	if !validVersion(release.TagName) {
		return releasePayload{}, fmt.Errorf("release metadata contains an invalid tag")
	}
	if requestedVersion != "" && release.TagName != requestedVersion {
		return releasePayload{}, fmt.Errorf("release metadata tag does not match requested version")
	}
	return release, nil
}

func findAsset(assets []releaseAsset, name string) (releaseAsset, bool) {
	for _, asset := range assets {
		if asset.Name == name && strings.TrimSpace(asset.BrowserDownloadURL) != "" {
			return asset, true
		}
	}
	return releaseAsset{}, false
}

func download(ctx context.Context, client *http.Client, rawURL string, limit int64) ([]byte, error) {
	parsed, err := url.Parse(rawURL)
	if err != nil || parsed.Host == "" || parsed.User != nil || !allowedReleaseURL(parsed) {
		return nil, fmt.Errorf("release asset URL must use HTTPS without credentials")
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, err
	}
	assetClient := *client
	previousRedirect := assetClient.CheckRedirect
	assetClient.CheckRedirect = func(next *http.Request, via []*http.Request) error {
		if !allowedReleaseURL(next.URL) || next.URL.User != nil {
			return fmt.Errorf("release asset redirect must use HTTPS without credentials")
		}
		if previousRedirect != nil {
			return previousRedirect(next, via)
		}
		return nil
	}
	response, err := assetClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("release asset returned HTTP %d", response.StatusCode)
	}
	if response.ContentLength > limit {
		return nil, fmt.Errorf("release asset exceeds %d bytes", limit)
	}
	content, err := io.ReadAll(io.LimitReader(response.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(content)) > limit {
		return nil, fmt.Errorf("release asset exceeds %d bytes", limit)
	}
	return content, nil
}

func allowedReleaseURL(parsed *url.URL) bool {
	return parsed.Scheme == "https" || (parsed.Scheme == "http" && isLoopbackHost(parsed.Hostname()))
}

func verifyChecksum(checksums []byte, assetName string, content []byte) error {
	expected := ""
	for _, line := range strings.Split(string(checksums), "\n") {
		fields := strings.Fields(line)
		if len(fields) != 2 || strings.TrimPrefix(fields[1], "*") != assetName {
			continue
		}
		if len(fields[0]) != sha256.Size*2 {
			return fmt.Errorf("checksum for %s has invalid length", assetName)
		}
		if _, err := hex.DecodeString(fields[0]); err != nil {
			return fmt.Errorf("checksum for %s is not hexadecimal", assetName)
		}
		expected = strings.ToLower(fields[0])
		break
	}
	if expected == "" {
		return fmt.Errorf("checksums.txt has no checksum for %s", assetName)
	}
	actual := fmt.Sprintf("%x", sha256.Sum256(content))
	if actual != expected {
		return errors.New("SHA-256 checksum mismatch")
	}
	return nil
}

func stageBundle(releaseDir, version, component string, bundle []byte) (string, error) {
	if !validVersion(version) {
		return "", fmt.Errorf("release version has unsupported characters")
	}
	if err := os.MkdirAll(releaseDir, 0o755); err != nil {
		return "", err
	}
	destination := filepath.Join(releaseDir, version)
	if _, err := os.Lstat(destination); err == nil {
		return "", fmt.Errorf("release directory already exists")
	} else if !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	staging, err := os.MkdirTemp(releaseDir, ".staging-"+version+"-")
	if err != nil {
		return "", err
	}
	cleanup := true
	defer func() {
		if cleanup {
			_ = os.RemoveAll(staging)
		}
	}()
	if err := extractBundle(bundle, staging, component); err != nil {
		return "", err
	}
	if err := os.Rename(staging, destination); err != nil {
		return "", err
	}
	cleanup = false
	return destination, nil
}

func extractBundle(bundle []byte, directory, component string) error {
	gzipReader, err := gzip.NewReader(bytes.NewReader(bundle))
	if err != nil {
		return fmt.Errorf("open gzip archive: %w", err)
	}
	defer gzipReader.Close()
	reader := tar.NewReader(gzipReader)
	seen := map[string]bool{}
	var total int64
	for {
		header, err := reader.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return fmt.Errorf("read archive: %w", err)
		}
		name, err := safeArchiveName(header.Name)
		if err != nil {
			return err
		}
		if header.Typeflag != tar.TypeReg && header.Typeflag != tar.TypeRegA {
			return fmt.Errorf("archive entry %q is not a regular file", name)
		}
		if !allowedBundleFile(component, name) {
			return fmt.Errorf("archive contains unsupported file %q", name)
		}
		if seen[name] {
			return fmt.Errorf("archive contains duplicate file %q", name)
		}
		seen[name] = true
		if header.Size < 0 || header.Size > maxExtractedBytes-total {
			return fmt.Errorf("archive extraction exceeds %d bytes", maxExtractedBytes)
		}
		total += header.Size
		destination := filepath.Join(directory, filepath.FromSlash(name))
		if !pathWithin(directory, destination) {
			return fmt.Errorf("archive file %q escapes staging directory", name)
		}
		if err := os.MkdirAll(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		// MkdirTemp and MkdirAll also apply the process umask. Every directory
		// in a reviewed release must remain traversable by the component's
		// service account even though Warden itself runs as root.
		if err := os.Chmod(filepath.Dir(destination), 0o755); err != nil {
			return err
		}
		mode := bundleFileMode(name)
		file, err := os.OpenFile(destination, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
		if err != nil {
			return err
		}
		// OpenFile applies the process umask. Warden intentionally runs under a
		// restrictive umask, so restore the reviewed bundle mode explicitly;
		// otherwise root-owned executables become 0700 and the service account
		// cannot start the candidate.
		if err := file.Chmod(mode); err != nil {
			_ = file.Close()
			return err
		}
		_, copyErr := io.CopyN(file, reader, header.Size)
		closeErr := file.Close()
		if copyErr != nil {
			return copyErr
		}
		if closeErr != nil {
			return closeErr
		}
	}
	for _, required := range requiredBundleFiles(component) {
		if !seen[required] {
			return fmt.Errorf("archive does not contain required file %q", required)
		}
	}
	return nil
}

func safeArchiveName(name string) (string, error) {
	if name == "" || strings.HasPrefix(name, "/") || strings.ContainsRune(name, '\x00') {
		return "", fmt.Errorf("archive contains unsafe file name")
	}
	clean := path.Clean(name)
	if clean == "." || clean == ".." || strings.HasPrefix(clean, "../") {
		return "", fmt.Errorf("archive contains unsafe file name %q", name)
	}
	return clean, nil
}

func allowedBundleFile(component, name string) bool {
	for _, required := range requiredBundleFiles(component) {
		if name == required {
			return true
		}
	}
	// Core release assets are reviewed Compose documents. Keep executables and
	// every other archive path fixed, while allowing a future release to add a
	// flat, safely named stack asset without first requiring an updater bridge.
	// Checksums, regular-file enforcement, path containment, extracted-size
	// limits, and the known required files remain mandatory.
	return component == "core" && assetFilePattern.MatchString(name)
}

func requiredBundleFiles(component string) []string {
	if component == "core" {
		return []string{
			"swarmops-core",
			"swarmops-warden",
			"assets/agent.yml",
			"assets/logs.yml",
			"assets/mongo.yml",
			"assets/observability.yml",
			"assets/postgres.yml",
			"assets/redis.yml",
			"assets/traefik.yml",
		}
	}
	return []string{"swarmops-agent", "swarmops-warden"}
}

func bundleFileMode(name string) os.FileMode {
	switch name {
	case "swarmops-agent", "swarmops-core", "swarmops-warden":
		return 0o755
	default:
		return 0o644
	}
}

func pathWithin(root, candidate string) bool {
	relative, err := filepath.Rel(root, candidate)
	return err == nil && relative != ".." && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

func currentVersion(releaseDir string) (string, error) {
	link := filepath.Join(releaseDir, "current")
	target, err := os.Readlink(link)
	if err != nil {
		return "", err
	}
	if filepath.Base(target) != target || !validVersion(target) {
		return "", fmt.Errorf("current link has an unsafe target")
	}
	info, err := os.Stat(filepath.Join(releaseDir, target))
	if err != nil {
		return "", err
	}
	if !info.IsDir() {
		return "", fmt.Errorf("current link does not point to a release directory")
	}
	return target, nil
}

func switchCurrent(releaseDir, version string) error {
	if !validVersion(version) {
		return fmt.Errorf("release version has unsupported characters")
	}
	if info, err := os.Stat(filepath.Join(releaseDir, version)); err != nil || !info.IsDir() {
		if err != nil {
			return err
		}
		return fmt.Errorf("release directory is not a directory")
	}
	temporary := filepath.Join(releaseDir, ".current-next")
	if err := os.Remove(temporary); err != nil && !errors.Is(err, os.ErrNotExist) {
		return err
	}
	if err := os.Symlink(version, temporary); err != nil {
		return err
	}
	if err := os.Rename(temporary, filepath.Join(releaseDir, "current")); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return nil
}

func rollback(ctx context.Context, config Config, previous, candidate string) error {
	var failures []string
	if err := config.Service.Stop(ctx); err != nil {
		failures = append(failures, "stop candidate: "+err.Error())
	}
	if err := switchCurrent(config.ReleaseDir, previous); err != nil {
		failures = append(failures, "restore current link: "+err.Error())
	} else if err := config.Service.Start(ctx); err != nil {
		failures = append(failures, "start previous service: "+err.Error())
	} else if err := waitForHealth(ctx, config.HealthURL, config.HealthTimeout, config.HealthInterval); err != nil {
		failures = append(failures, "validate previous service: "+err.Error())
	}
	if candidate != "" {
		if err := os.RemoveAll(candidate); err != nil {
			failures = append(failures, "remove failed candidate: "+err.Error())
		}
	}
	if len(failures) > 0 {
		return errors.New(strings.Join(failures, "; "))
	}
	return nil
}

func waitForHealth(ctx context.Context, rawURL string, timeout, interval time.Duration) error {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return err
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if parsed.Scheme == "https" {
		// The health endpoint is validated as loopback before this call. The
		// machine agent may use a locally generated or private CA certificate;
		// its public TLS identity is still pinned by the remote controller.
		transport.TLSClientConfig = &tls.Config{MinVersion: tls.VersionTLS13, InsecureSkipVerify: true} // #nosec G402 -- loopback liveness probe only.
	}
	client := &http.Client{Transport: transport, Timeout: minDuration(interval, 5*time.Second)}
	deadline := time.Now().Add(timeout)
	var lastErr error
	for time.Now().Before(deadline) {
		request, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
		if err == nil {
			response, requestErr := client.Do(request)
			if requestErr == nil {
				_ = response.Body.Close()
				if response.StatusCode == http.StatusOK {
					return nil
				}
				lastErr = fmt.Errorf("health endpoint returned HTTP %d", response.StatusCode)
			} else {
				lastErr = requestErr
			}
		} else {
			lastErr = err
		}
		wait := time.NewTimer(interval)
		select {
		case <-ctx.Done():
			wait.Stop()
			return ctx.Err()
		case <-wait.C:
		}
	}
	if lastErr == nil {
		lastErr = errors.New("health timeout elapsed")
	}
	return lastErr
}

func validateLoopbackHealthURL(rawURL string) error {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || parsed.User != nil {
		return fmt.Errorf("health URL must be an absolute URL without credentials")
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("health URL must use HTTP or HTTPS")
	}
	if !isLoopbackHost(parsed.Hostname()) {
		return fmt.Errorf("health URL must use localhost or a loopback IP address")
	}
	if parsed.RawQuery != "" || parsed.Fragment != "" {
		return fmt.Errorf("health URL must not include a query or fragment")
	}
	return nil
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func prune(releaseDir, current string) error {
	entries, err := os.ReadDir(releaseDir)
	if err != nil {
		return err
	}
	type candidate struct {
		name string
		mod  time.Time
	}
	var releases []candidate
	for _, entry := range entries {
		if !entry.IsDir() || !validVersion(entry.Name()) {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		releases = append(releases, candidate{name: entry.Name(), mod: info.ModTime()})
	}
	sort.Slice(releases, func(i, j int) bool { return releases[i].mod.After(releases[j].mod) })
	keep := map[string]bool{current: true}
	for _, release := range releases {
		if len(keep) >= 3 {
			break
		}
		keep[release.name] = true
	}
	for _, release := range releases {
		if keep[release.name] {
			continue
		}
		if err := os.RemoveAll(filepath.Join(releaseDir, release.name)); err != nil {
			return err
		}
	}
	return nil
}

func validVersion(value string) bool { return versionPattern.MatchString(value) }

func minDuration(first, second time.Duration) time.Duration {
	if first < second {
		return first
	}
	return second
}
