package agent

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestReadRunStatusReadsOnlyValidatedFixedPath(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	statusDir := filepath.Join(root, "var/lib/swarmops/fleet/run-123")
	if err := os.MkdirAll(statusDir, 0o700); err != nil {
		t.Fatal(err)
	}
	contents := []byte(`{"id":"run-123","node":"node-01","operation":"node-health-report","state":"succeeded","startedAt":"2026-08-23T01:00:00Z","finishedAt":"2026-08-23T01:00:01Z","exitCode":0}`)
	if err := os.WriteFile(filepath.Join(statusDir, "status.json"), contents, 0o600); err != nil {
		t.Fatal(err)
	}
	status, err := ReadRunStatus(Config{HostRoot: root}, "run-123")
	if err != nil || status.State != "succeeded" || status.ExitCode == nil || *status.ExitCode != 0 {
		t.Fatalf("status = %#v, %v", status, err)
	}
	if _, err := ReadRunStatus(Config{HostRoot: root}, "../etc/passwd"); err == nil {
		t.Fatal("unsafe run ID was accepted")
	}
	if _, err := ReadRunStatus(Config{HostRoot: root}, "missing"); !errors.Is(err, ErrRunNotFound) {
		t.Fatalf("missing status error = %v, want ErrRunNotFound", err)
	}
}

func TestReadRunStatusAcceptsBoundedRetryMetadata(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	statusDir := filepath.Join(root, "var/lib/swarmops/fleet/run-456")
	if err := os.MkdirAll(statusDir, 0o700); err != nil {
		t.Fatal(err)
	}
	contents := []byte(`{"id":"run-456","node":"node-01","operation":"warm-docker-cache","state":"retrying","startedAt":"2026-08-24T01:00:00Z","attempt":2,"maxAttempts":8,"nextAttemptAt":"2026-08-24T01:00:04Z"}`)
	if err := os.WriteFile(filepath.Join(statusDir, "status.json"), contents, 0o600); err != nil {
		t.Fatal(err)
	}
	status, err := ReadRunStatus(Config{HostRoot: root}, "run-456")
	if err != nil || status.State != "retrying" || status.Attempt != 2 || status.MaxAttempts != 8 || status.NextAttemptAt == nil {
		t.Fatalf("status = %#v, err=%v", status, err)
	}
}
