package coreself

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestDescribeReadsWardenStatus(t *testing.T) {
	dir := t.TempDir()
	status := filepath.Join(dir, "update-status.json")
	if err := os.WriteFile(status, []byte(`{"automatic":true,"checkedAt":"2026-01-02T03:04:05Z","lastUpdatedAt":"2026-01-01T00:00:00Z","state":"updated","version":"v0.13.0"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	described := Describe(Config{StateDir: dir, UpdateRequestFile: filepath.Join(dir, "update.request"), UpdateStatusFile: status, Version: "v0.12.2"}, time.Now(), time.Now())
	if !described.Update.Configured || !described.Update.Automatic {
		t.Fatalf("update = %#v, want configured and automatic", described.Update)
	}
	if described.Update.Available != "v0.13.0" || described.Update.State != "updated" {
		t.Fatalf("update = %#v, want v0.13.0 updated", described.Update)
	}
	if described.Update.CheckedAt.IsZero() || described.Update.LastUpdatedAt.IsZero() {
		t.Fatalf("update timestamps = %#v, want both parsed", described.Update)
	}
}

func TestDescribeStillReadsKeyValueStatus(t *testing.T) {
	dir := t.TempDir()
	status := filepath.Join(dir, "update-status")
	if err := os.WriteFile(status, []byte("automatic=true\navailable=v0.13.0\nstate=up_to_date\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	described := Describe(Config{StateDir: dir, UpdateStatusFile: status, Version: "v0.12.2"}, time.Now(), time.Now())
	if described.Update.Available != "v0.13.0" || !described.Update.Automatic {
		t.Fatalf("update = %#v, want the legacy shell format parsed", described.Update)
	}
}

func TestRequestUpdateWritesPinnedVersion(t *testing.T) {
	request := filepath.Join(t.TempDir(), "update.request")
	if err := RequestUpdate(Config{UpdateRequestFile: request}, "v0.11.0"); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(request)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(data), "version=v0.11.0") {
		t.Fatalf("marker = %q, want the requested release", data)
	}
	if err := RequestUpdate(Config{UpdateRequestFile: request}, "; reboot"); !errors.Is(err, ErrVersion) {
		t.Fatalf("err = %v, want ErrVersion", err)
	}
}
