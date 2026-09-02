package warden

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"syscall"
	"testing"
	"time"
)

func TestUpdateRollsBackAnUnhealthyCandidate(t *testing.T) {
	releaseDir := t.TempDir()
	installRelease(t, releaseDir, "v1.0.0")
	linkCurrent(t, releaseDir, "v1.0.0")

	health := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if current, err := currentVersion(releaseDir); err == nil && current == "v2.0.0" {
			writer.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		writer.WriteHeader(http.StatusOK)
	}))
	defer health.Close()

	bundle := testBundle(t, "agent")
	release := releaseServer(t, "v2.0.0", "agent", "linux", "amd64", bundle)
	defer release.Close()
	manager := &fakeService{}
	statusFile := filepath.Join(t.TempDir(), "update-status.json")
	result, err := Update(context.Background(), Config{
		Repository:     "nimasrn/SwarmOps",
		Component:      "agent",
		ReleaseDir:     releaseDir,
		HealthURL:      health.URL,
		StatusFile:     statusFile,
		APIBaseURL:     release.URL,
		HealthTimeout:  80 * time.Millisecond,
		HealthInterval: 5 * time.Millisecond,
		Service:        manager,
		OS:             "linux",
		Arch:           "amd64",
	}, "")
	if err == nil {
		t.Fatal("Update() returned nil error for an unhealthy candidate")
	}
	if !result.RolledBack || result.Version != "v2.0.0" {
		t.Fatalf("Update() result = %#v, want failed v2 rollback", result)
	}
	current, err := currentVersion(releaseDir)
	if err != nil {
		t.Fatalf("currentVersion(): %v", err)
	}
	if current != "v1.0.0" {
		t.Fatalf("current release = %q, want v1.0.0", current)
	}
	if _, err := os.Stat(filepath.Join(releaseDir, "v2.0.0")); !os.IsNotExist(err) {
		t.Fatalf("failed candidate directory should be removed, stat err = %v", err)
	}
	if manager.stops != 2 || manager.starts != 2 {
		t.Fatalf("service calls = stop %d/start %d, want stop 2/start 2", manager.stops, manager.starts)
	}
	status, statusErr := readUpdateStatus(statusFile)
	if statusErr != nil {
		t.Fatal(statusErr)
	}
	if status.State != "failed" || status.Version != "v1.0.0" || status.CheckedAt.IsZero() {
		t.Fatalf("status = %#v, want failed with restored v1.0.0", status)
	}
}

func TestUpdateKeepsCurrentAndTwoPriorKnownGoodReleases(t *testing.T) {
	releaseDir := t.TempDir()
	for index, version := range []string{"v0.8.0", "v0.9.0", "v1.0.0"} {
		installRelease(t, releaseDir, version)
		moment := time.Now().Add(time.Duration(index-4) * time.Hour)
		if err := os.Chtimes(filepath.Join(releaseDir, version), moment, moment); err != nil {
			t.Fatal(err)
		}
	}
	linkCurrent(t, releaseDir, "v1.0.0")
	health := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	defer health.Close()
	bundle := testBundle(t, "agent")
	release := releaseServer(t, "v1.1.0", "agent", "linux", "amd64", bundle)
	defer release.Close()

	result, err := Update(context.Background(), Config{
		Repository:     "nimasrn/SwarmOps",
		Component:      "agent",
		ReleaseDir:     releaseDir,
		HealthURL:      health.URL,
		APIBaseURL:     release.URL,
		HealthTimeout:  time.Second,
		HealthInterval: 5 * time.Millisecond,
		Service:        &fakeService{},
		OS:             "linux",
		Arch:           "amd64",
	}, "")
	if err != nil {
		t.Fatalf("Update(): %v", err)
	}
	if !result.Updated || result.RolledBack {
		t.Fatalf("Update() result = %#v, want successful update", result)
	}
	if current, err := currentVersion(releaseDir); err != nil || current != "v1.1.0" {
		t.Fatalf("current release = %q, %v; want v1.1.0", current, err)
	}
	entries, err := os.ReadDir(releaseDir)
	if err != nil {
		t.Fatal(err)
	}
	var releases []string
	for _, entry := range entries {
		if entry.IsDir() && validVersion(entry.Name()) {
			releases = append(releases, entry.Name())
		}
	}
	sort.Strings(releases)
	if got, want := fmt.Sprint(releases), "[v0.9.0 v1.0.0 v1.1.0]"; got != want {
		t.Fatalf("retained releases = %s, want %s", got, want)
	}
}

func TestAgentUpdateDefersWhileMutationIsBusyAndConsumesRequest(t *testing.T) {
	releaseDir := t.TempDir()
	installRelease(t, releaseDir, "v1.0.0")
	linkCurrent(t, releaseDir, "v1.0.0")
	stateDir := t.TempDir()
	busyFile := filepath.Join(stateDir, "update.busy")
	requestFile := filepath.Join(stateDir, "update.request")
	statusFile := filepath.Join(stateDir, "update-status.json")
	if err := os.WriteFile(busyFile, []byte("busy\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(requestFile, []byte("check\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	manager := &fakeService{}
	result, err := Update(context.Background(), Config{
		Repository:  "nimasrn/SwarmOps",
		Component:   "agent",
		ReleaseDir:  releaseDir,
		HealthURL:   "http://127.0.0.1:9180/healthz",
		BusyFile:    busyFile,
		RequestFile: requestFile,
		StatusFile:  statusFile,
		Service:     manager,
		OS:          "linux",
		Arch:        "amd64",
	}, "")
	if err != nil {
		t.Fatalf("Update(): %v", err)
	}
	if !result.Deferred || result.Version != "v1.0.0" {
		t.Fatalf("Update() result = %#v, want deferred v1.0.0", result)
	}
	if manager.stops != 0 || manager.starts != 0 {
		t.Fatalf("service calls = stop %d/start %d, want none", manager.stops, manager.starts)
	}
	if _, err := os.Stat(requestFile); !os.IsNotExist(err) {
		t.Fatalf("request marker should be consumed, stat err = %v", err)
	}
	status, err := readUpdateStatus(statusFile)
	if err != nil {
		t.Fatal(err)
	}
	if !status.Automatic || status.State != "deferred" || status.Version != "v1.0.0" || status.CheckedAt.IsZero() {
		t.Fatalf("status = %#v, want deferred v1.0.0", status)
	}
}

func TestAgentUpdateRecordsActivatedRelease(t *testing.T) {
	releaseDir := t.TempDir()
	installRelease(t, releaseDir, "v1.0.0")
	linkCurrent(t, releaseDir, "v1.0.0")
	health := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	defer health.Close()
	bundle := testBundle(t, "agent")
	release := releaseServer(t, "v1.1.0", "agent", "linux", "amd64", bundle)
	defer release.Close()
	statusFile := filepath.Join(t.TempDir(), "update-status.json")
	result, err := Update(context.Background(), Config{
		Repository:     "nimasrn/SwarmOps",
		Component:      "agent",
		ReleaseDir:     releaseDir,
		HealthURL:      health.URL,
		StatusFile:     statusFile,
		APIBaseURL:     release.URL,
		HealthTimeout:  time.Second,
		HealthInterval: 5 * time.Millisecond,
		Service:        &fakeService{},
		OS:             "linux",
		Arch:           "amd64",
	}, "")
	if err != nil {
		t.Fatalf("Update(): %v", err)
	}
	if !result.Updated {
		t.Fatalf("Update() result = %#v, want updated", result)
	}
	status, err := readUpdateStatus(statusFile)
	if err != nil {
		t.Fatal(err)
	}
	if status.State != "updated" || status.Version != "v1.1.0" || status.LastUpdatedAt.IsZero() {
		t.Fatalf("status = %#v, want updated v1.1.0", status)
	}
}

// The core is managed from the console the same way an agent is: it writes a
// request marker, and the marker may name the exact release to install, which
// is how a rollback reaches a controller nobody can SSH into.
func TestUpdateCoreConsumesMarkerVersionAndRecordsStatus(t *testing.T) {
	releaseDir := t.TempDir()
	installRelease(t, releaseDir, "v1.0.0")
	linkCurrent(t, releaseDir, "v1.0.0")
	health := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	defer health.Close()
	release := releaseServer(t, "v1.1.0", "core", "linux", "amd64", testBundle(t, "core"))
	defer release.Close()
	stateDir := t.TempDir()
	requestFile := filepath.Join(stateDir, "update.request")
	if err := os.WriteFile(requestFile, []byte("requestedAt=2026-01-01T00:00:00Z\nversion=v1.1.0\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	statusFile := filepath.Join(stateDir, "update-status.json")
	result, err := Update(context.Background(), Config{
		Component:      "core",
		ReleaseDir:     releaseDir,
		HealthURL:      health.URL,
		RequestFile:    requestFile,
		StatusFile:     statusFile,
		APIBaseURL:     release.URL,
		HealthTimeout:  time.Second,
		HealthInterval: 5 * time.Millisecond,
		Service:        &fakeService{},
		OS:             "linux",
		Arch:           "amd64",
	}, "")
	if err != nil {
		t.Fatalf("Update(): %v", err)
	}
	if !result.Updated || result.Version != "v1.1.0" {
		t.Fatalf("Update() result = %#v, want updated v1.1.0", result)
	}
	if _, err := os.Stat(requestFile); !os.IsNotExist(err) {
		t.Fatalf("request marker should be consumed, stat err = %v", err)
	}
	status, err := readUpdateStatus(statusFile)
	if err != nil {
		t.Fatal(err)
	}
	if status.State != "updated" || status.Version != "v1.1.0" {
		t.Fatalf("status = %#v, want updated v1.1.0", status)
	}
}

func TestRequestedMarkerVersionIgnoresJunk(t *testing.T) {
	if version := requestedMarkerVersion("2026-01-01T00:00:00Z\n"); version != "" {
		t.Fatalf("version = %q, want empty for a timestamp-only marker", version)
	}
	if version := requestedMarkerVersion("version=; reboot\n"); version != "" {
		t.Fatalf("version = %q, want empty for an invalid tag", version)
	}
	if version := requestedMarkerVersion("version=\"v1.2.3\"\n"); version != "v1.2.3" {
		t.Fatalf("version = %q, want v1.2.3", version)
	}
}

func TestExtractBundleRejectsPathTraversal(t *testing.T) {
	archive := archiveWithFiles(t, map[string][]byte{"../outside": []byte("no")})
	if err := extractBundle(archive, t.TempDir(), "agent"); err == nil {
		t.Fatal("extractBundle() accepted a path traversal entry")
	}
}

func TestVerifyChecksumRejectsDuplicateEntries(t *testing.T) {
	content := []byte("agent bundle")
	digest := fmt.Sprintf("%x", sha256.Sum256(content))
	checksums := []byte(fmt.Sprintf("%s  agent.tar.gz\n%s  agent.tar.gz\n", digest, digest))
	if err := verifyChecksum(checksums, "agent.tar.gz", content); err == nil {
		t.Fatal("verifyChecksum() accepted duplicate checksum entries")
	}
}

func TestExtractCoreBundleIncludesReviewedAssets(t *testing.T) {
	directory := t.TempDir()
	var extractErr error
	func() {
		previousUmask := syscall.Umask(0o077)
		defer syscall.Umask(previousUmask)
		extractErr = extractBundle(testBundle(t, "core"), directory, "core")
	}()
	if extractErr != nil {
		t.Fatalf("extractBundle(): %v", extractErr)
	}
	for _, name := range []string{directory, filepath.Join(directory, "assets")} {
		info, err := os.Stat(name)
		if err != nil {
			t.Fatalf("core bundle directory %q: %v", name, err)
		}
		if got, want := info.Mode().Perm(), os.FileMode(0o755); got != want {
			t.Fatalf("core bundle directory %q mode = %04o, want %04o", name, got, want)
		}
	}
	for _, name := range requiredBundleFiles("core") {
		info, err := os.Stat(filepath.Join(directory, filepath.FromSlash(name)))
		if err != nil {
			t.Fatalf("core bundle file %q: %v", name, err)
		}
		if got, want := info.Mode().Perm(), bundleFileMode(name); got != want {
			t.Fatalf("core bundle file %q mode = %04o, want %04o", name, got, want)
		}
	}
}

func TestCoreBundleRemainsStageableByV062Warden(t *testing.T) {
	legacyRequired := map[string]bool{
		"swarmops-core": true, "swarmops-warden": true,
		"assets/agent.yml": true, "assets/logs.yml": true,
		"assets/mongo.yml": true, "assets/observability.yml": true,
		"assets/postgres.yml": true, "assets/redis.yml": true,
		"assets/traefik.yml": true,
	}
	for _, name := range requiredBundleFiles("core") {
		if legacyRequired[name] {
			continue
		}
		if !strings.HasPrefix(name, "assets/") || strings.Count(name, "/") != 1 || !strings.HasSuffix(name, ".yml") {
			t.Fatalf("Core release path %q is rejected by the v0.6.2 Warden", name)
		}
	}
}

func TestExtractCoreBundleAllowsFutureReviewedAsset(t *testing.T) {
	files := map[string][]byte{}
	for _, name := range requiredBundleFiles("core") {
		files[name] = []byte(name)
	}
	const futureAsset = "assets/swarmops-valkey-sentinel.yml"
	files[futureAsset] = []byte("services: {}\n")
	directory := t.TempDir()
	if err := extractBundle(archiveWithFiles(t, files), directory, "core"); err != nil {
		t.Fatalf("extractBundle() rejected a safely named future Core asset: %v", err)
	}
	info, err := os.Stat(filepath.Join(directory, futureAsset))
	if err != nil {
		t.Fatal(err)
	}
	if got, want := info.Mode().Perm(), os.FileMode(0o644); got != want {
		t.Fatalf("future Core asset mode = %04o, want %04o", got, want)
	}
}

func TestExtractCoreBundleRejectsUnreviewableExtraPaths(t *testing.T) {
	for _, name := range []string{
		"assets/nested/stack.yml",
		"assets/stack.yaml",
		"assets/Stack.yml",
		"assets/-stack.yml",
		"swarmops-helper",
	} {
		t.Run(name, func(t *testing.T) {
			files := map[string][]byte{}
			for _, required := range requiredBundleFiles("core") {
				files[required] = []byte(required)
			}
			files[name] = []byte("unexpected")
			if err := extractBundle(archiveWithFiles(t, files), t.TempDir(), "core"); err == nil {
				t.Fatalf("extractBundle() accepted unsupported Core path %q", name)
			}
		})
	}
}

func TestValidateLoopbackHealthURL(t *testing.T) {
	if err := validateLoopbackHealthURL("https://control.example.test/healthz"); err == nil {
		t.Fatal("validateLoopbackHealthURL() accepted a remote host")
	}
	if err := validateLoopbackHealthURL("https://[::1]:9180/healthz"); err != nil {
		t.Fatalf("validateLoopbackHealthURL() rejected IPv6 loopback: %v", err)
	}
}

type fakeService struct {
	stops  int
	starts int
}

func (service *fakeService) Stop(context.Context) error {
	service.stops++
	return nil
}

func (service *fakeService) Start(context.Context) error {
	service.starts++
	return nil
}

func releaseServer(t *testing.T, version, component, operatingSystem, architecture string, bundle []byte) *httptest.Server {
	t.Helper()
	assetName := fmt.Sprintf("swarmops-%s_%s_%s_%s.tar.gz", component, version, operatingSystem, architecture)
	digest := fmt.Sprintf("%x", sha256.Sum256(bundle))
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/repos/nimasrn/SwarmOps/releases/latest", "/repos/nimasrn/SwarmOps/releases/tags/" + version:
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(releasePayload{TagName: version, Assets: []releaseAsset{
				{Name: "checksums.txt", BrowserDownloadURL: server.URL + "/checksums.txt"},
				{Name: assetName, BrowserDownloadURL: server.URL + "/bundle.tar.gz"},
			}})
		case "/checksums.txt":
			_, _ = fmt.Fprintf(writer, "%s  %s\n", digest, assetName)
		case "/bundle.tar.gz":
			_, _ = writer.Write(bundle)
		default:
			writer.WriteHeader(http.StatusNotFound)
		}
	}))
	return server
}

func installRelease(t *testing.T, releaseDir, version string) {
	t.Helper()
	directory := filepath.Join(releaseDir, version)
	if err := os.MkdirAll(directory, 0o755); err != nil {
		t.Fatal(err)
	}
	for _, name := range requiredBundleFiles("agent") {
		if err := os.WriteFile(filepath.Join(directory, name), []byte("binary"), 0o755); err != nil {
			t.Fatal(err)
		}
	}
}

func linkCurrent(t *testing.T, releaseDir, version string) {
	t.Helper()
	if err := os.Symlink(version, filepath.Join(releaseDir, "current")); err != nil {
		t.Fatal(err)
	}
}

func testBundle(t *testing.T, component string) []byte {
	t.Helper()
	files := map[string][]byte{}
	for _, name := range requiredBundleFiles(component) {
		files[name] = []byte(name)
	}
	return archiveWithFiles(t, files)
}

func archiveWithFiles(t *testing.T, files map[string][]byte) []byte {
	t.Helper()
	var buffer bytes.Buffer
	gzipWriter := gzip.NewWriter(&buffer)
	tarWriter := tar.NewWriter(gzipWriter)
	for name, content := range files {
		if err := tarWriter.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(content))}); err != nil {
			t.Fatal(err)
		}
		if _, err := tarWriter.Write(content); err != nil {
			t.Fatal(err)
		}
	}
	if err := tarWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := gzipWriter.Close(); err != nil {
		t.Fatal(err)
	}
	return buffer.Bytes()
}
