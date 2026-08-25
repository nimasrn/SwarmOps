package agent

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

const testManagedVolume = "swarmops-mongo_swarmops_mongo_data"

func TestSystemVolumeTransferCopiesOnlyReviewedLocalVolume(t *testing.T) {
	t.Parallel()
	sourceMount := filepath.Join(t.TempDir(), "source", "_data")
	targetMount := filepath.Join(t.TempDir(), "target", "_data")
	if err := os.MkdirAll(filepath.Join(sourceMount, "nested"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(targetMount, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sourceMount, "nested", "state"), []byte("durable data"), 0o600); err != nil {
		t.Fatal(err)
	}
	source := newVolumeDocker(t, testManagedVolume, sourceMount)
	target := newVolumeDocker(t, testManagedVolume, targetMount)
	sourceTransfer := newSystemVolumeTransfer(source, filepath.Join(t.TempDir(), "source-transfer"), 1<<20)
	targetTransfer := newSystemVolumeTransfer(target, filepath.Join(t.TempDir(), "target-transfer"), 1<<20)
	var archive bytes.Buffer
	exported, err := sourceTransfer.Export(context.Background(), testManagedVolume, &archive)
	if err != nil {
		t.Fatal(err)
	}
	restored, err := targetTransfer.Restore(context.Background(), testManagedVolume, "mig-"+strings.Repeat("a", 32), bytes.NewReader(archive.Bytes()))
	if err != nil {
		t.Fatal(err)
	}
	if restored != exported {
		t.Fatalf("restore receipt = %#v, export receipt = %#v", restored, exported)
	}
	data, err := os.ReadFile(filepath.Join(targetMount, "nested", "state"))
	if err != nil || string(data) != "durable data" {
		t.Fatalf("restored data = %q, err=%v", data, err)
	}
	if _, err := targetTransfer.Restore(context.Background(), "unrelated_volume", "mig-"+strings.Repeat("b", 32), bytes.NewReader(archive.Bytes())); err == nil {
		t.Fatal("unreviewed volume restore was accepted")
	}
}

func TestSystemVolumeTransferCreatesMissingTargetVolumeBeforeRestore(t *testing.T) {
	t.Parallel()
	sourceMount := filepath.Join(t.TempDir(), "source", "_data")
	targetMount := filepath.Join(t.TempDir(), "target", "_data")
	if err := os.MkdirAll(sourceMount, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(targetMount, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sourceMount, "state"), []byte("durable data"), 0o600); err != nil {
		t.Fatal(err)
	}
	source := newVolumeDocker(t, testManagedVolume, sourceMount)
	created := false
	backend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/volumes/" + testManagedVolume:
			if !created {
				http.NotFound(response, request)
				return
			}
			_, _ = response.Write([]byte(`{"Name":"` + testManagedVolume + `","Driver":"local","Mountpoint":"` + targetMount + `"}`))
		case "/volumes/create":
			if request.Method != http.MethodPost {
				http.NotFound(response, request)
				return
			}
			created = true
			_, _ = response.Write([]byte(`{"Name":"` + testManagedVolume + `","Driver":"local","Mountpoint":"` + targetMount + `"}`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(backend.Close)
	target, err := dockerapi.NewForURL(backend.URL, backend.Client())
	if err != nil {
		t.Fatal(err)
	}
	sourceTransfer := newSystemVolumeTransfer(source, filepath.Join(t.TempDir(), "source-transfer"), 1<<20)
	targetTransfer := newSystemVolumeTransfer(target, filepath.Join(t.TempDir(), "target-transfer"), 1<<20)
	var archive bytes.Buffer
	if _, err := sourceTransfer.Export(context.Background(), testManagedVolume, &archive); err != nil {
		t.Fatal(err)
	}
	if _, err := targetTransfer.Restore(context.Background(), testManagedVolume, "mig-"+strings.Repeat("e", 32), bytes.NewReader(archive.Bytes())); err != nil {
		t.Fatal(err)
	}
	if !created {
		t.Fatal("target volume was not created before restore")
	}
	if data, err := os.ReadFile(filepath.Join(targetMount, "state")); err != nil || string(data) != "durable data" {
		t.Fatalf("restored target data = %q, err=%v", data, err)
	}
}

func TestSystemVolumeTransferRejectsNonEmptyTarget(t *testing.T) {
	t.Parallel()
	mount := filepath.Join(t.TempDir(), "target", "_data")
	if err := os.MkdirAll(mount, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(mount, "existing"), []byte("keep"), 0o600); err != nil {
		t.Fatal(err)
	}
	transfer := newSystemVolumeTransfer(newVolumeDocker(t, testManagedVolume, mount), filepath.Join(t.TempDir(), "transfer"), 1<<20)
	if _, err := transfer.Restore(context.Background(), testManagedVolume, "mig-"+strings.Repeat("c", 32), strings.NewReader("not an archive")); err == nil || !strings.Contains(err.Error(), "not empty") {
		t.Fatalf("dirty target restore error = %v", err)
	}
}

func TestMobilityEndpointsRequireEnrollmentAndUseFixedVolume(t *testing.T) {
	t.Parallel()
	directory := t.TempDir()
	secretFile := filepath.Join(directory, "enrollment")
	if err := os.WriteFile(secretFile, []byte("one-time-enrollment-secret-value"), 0o600); err != nil {
		t.Fatal(err)
	}
	transfer := &recordingVolumeTransfer{}
	key := "test-machine-api-key"
	server, err := NewServer(Config{
		Docker:               newTestDockerClient(t),
		EnrollmentSecret:     []byte("one-time-enrollment-secret-value"),
		EnrollmentSecretFile: secretFile,
		ManagedStateFile:     filepath.Join(directory, "managed"),
		MobilityEnabled:      true,
		RemoteControlEnabled: true,
		VolumeTransfer:       transfer,
	}, []byte(key))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	before := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodPost, "/v1/mobility/volumes/"+testManagedVolume+"/restore", strings.NewReader("archive"))
	request.Header.Set("Authorization", "Bearer "+key)
	request.Header.Set("X-SwarmOps-Migration-ID", "mig-"+strings.Repeat("d", 32))
	handler.ServeHTTP(before, request)
	if before.Code != http.StatusConflict {
		t.Fatalf("restore before enrollment = %d, want 409", before.Code)
	}
	enroll := httptest.NewRecorder()
	enrollRequest := httptest.NewRequest(http.MethodPost, "/v1/enroll", nil)
	enrollRequest.Header.Set("Authorization", "Bearer one-time-enrollment-secret-value")
	handler.ServeHTTP(enroll, enrollRequest)
	if enroll.Code != http.StatusOK {
		t.Fatalf("enroll = %d: %s", enroll.Code, enroll.Body.String())
	}
	restore := httptest.NewRecorder()
	restoreRequest := httptest.NewRequest(http.MethodPost, "/v1/mobility/volumes/"+testManagedVolume+"/restore", strings.NewReader("archive"))
	restoreRequest.Header.Set("Authorization", "Bearer "+key)
	restoreRequest.Header.Set("X-SwarmOps-Migration-ID", "mig-"+strings.Repeat("d", 32))
	handler.ServeHTTP(restore, restoreRequest)
	if restore.Code != http.StatusOK || string(transfer.restored) != "archive" {
		t.Fatalf("restore = %d body=%s bytes=%q", restore.Code, restore.Body.String(), transfer.restored)
	}
	bad := httptest.NewRecorder()
	badRequest := httptest.NewRequest(http.MethodPost, "/v1/mobility/volumes/unrelated/restore", strings.NewReader("archive"))
	badRequest.Header.Set("Authorization", "Bearer "+key)
	badRequest.Header.Set("X-SwarmOps-Migration-ID", "mig-"+strings.Repeat("d", 32))
	handler.ServeHTTP(bad, badRequest)
	if bad.Code != http.StatusBadRequest {
		t.Fatalf("unreviewed restore = %d, want 400", bad.Code)
	}
}

type recordingVolumeTransfer struct{ restored []byte }

func (r *recordingVolumeTransfer) Export(_ context.Context, _ string, output io.Writer) (VolumeReceipt, error) {
	_, err := io.WriteString(output, "archive")
	return VolumeReceipt{Bytes: 7, Digest: strings.Repeat("a", 64)}, err
}

func (r *recordingVolumeTransfer) Restore(_ context.Context, _ string, _ string, input io.Reader) (VolumeReceipt, error) {
	r.restored, _ = io.ReadAll(input)
	return VolumeReceipt{Bytes: int64(len(r.restored)), Digest: strings.Repeat("a", 64)}, nil
}

func (r *recordingVolumeTransfer) Remove(context.Context, string) error { return nil }

func newVolumeDocker(t *testing.T, volume, mount string) *dockerapi.Client {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/volumes/create" && request.Method == http.MethodPost {
			response.Header().Set("Content-Type", "application/json")
			_, _ = response.Write([]byte(`{"Name":"` + volume + `","Driver":"local","Mountpoint":"` + mount + `"}`))
			return
		}
		if request.URL.Path == "/volumes/"+volume {
			response.Header().Set("Content-Type", "application/json")
			_, _ = response.Write([]byte(`{"Name":"` + volume + `","Driver":"local","Mountpoint":"` + mount + `"}`))
			return
		}
		http.NotFound(response, request)
	}))
	t.Cleanup(backend.Close)
	client, err := dockerapi.NewForURL(backend.URL, backend.Client())
	if err != nil {
		t.Fatal(err)
	}
	return client
}
