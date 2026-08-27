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
	result, err := Update(context.Background(), Config{
		Repository:     "nimasrn/SwarmOps",
		Component:      "agent",
		ReleaseDir:     releaseDir,
		HealthURL:      health.URL,
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

func TestExtractBundleRejectsPathTraversal(t *testing.T) {
	archive := archiveWithFiles(t, map[string][]byte{"../outside": []byte("no")})
	if err := extractBundle(archive, t.TempDir(), "agent"); err == nil {
		t.Fatal("extractBundle() accepted a path traversal entry")
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
		case "/repos/nimasrn/SwarmOps/releases/latest":
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
