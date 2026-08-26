package nativectl

import (
	"bytes"
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestStartWardenUsesOnlyFixedServiceUnits(t *testing.T) {
	var calls [][]string
	run := func(_ context.Context, executable string, arguments ...string) error {
		calls = append(calls, append([]string{executable}, arguments...))
		return nil
	}
	platform := Platform{OS: "linux", SystemctlPath: "systemctl"}
	if err := StartWarden(context.Background(), Agent, platform, run); err != nil {
		t.Fatal(err)
	}
	if err := StartWarden(context.Background(), Core, platform, run); err != nil {
		t.Fatal(err)
	}
	got := strings.Join(calls[0], " ") + "\n" + strings.Join(calls[1], " ")
	want := "systemctl start swarmops-agent-warden.service\nsystemctl start swarmops-core-warden.service"
	if got != want {
		t.Fatalf("Warden calls = %q, want %q", got, want)
	}
}

func TestRotateAgentKeyReplacesKeyAndRestarts(t *testing.T) {
	directory := t.TempDir()
	keyFile := filepath.Join(directory, "api-key")
	if err := os.WriteFile(keyFile, []byte("previous-key\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	restarts := 0
	key, err := RotateAgentKey(context.Background(), keyFile, bytes.NewReader(bytes.Repeat([]byte{7}, apiKeyBytes)), func(context.Context) error {
		restarts++
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
	if key == "previous-key" || key == "" {
		t.Fatalf("generated key = %q", key)
	}
	if restarts != 1 {
		t.Fatalf("restart count = %d, want 1", restarts)
	}
	data, err := os.ReadFile(keyFile)
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(data)) != key {
		t.Fatal("key file does not contain generated key")
	}
	info, err := os.Stat(keyFile)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("key file mode = %o, want 600", info.Mode().Perm())
	}
}

func TestRotateAgentKeyRestoresPreviousKeyWhenRestartFails(t *testing.T) {
	directory := t.TempDir()
	keyFile := filepath.Join(directory, "api-key")
	const previous = "previous-key\n"
	if err := os.WriteFile(keyFile, []byte(previous), 0o600); err != nil {
		t.Fatal(err)
	}
	restarts := 0
	_, err := RotateAgentKey(context.Background(), keyFile, bytes.NewReader(bytes.Repeat([]byte{9}, apiKeyBytes)), func(context.Context) error {
		restarts++
		if restarts == 1 {
			return errors.New("restart failed")
		}
		return nil
	})
	if err == nil || !strings.Contains(err.Error(), "restored prior key") {
		t.Fatalf("rotation error = %v", err)
	}
	data, readErr := os.ReadFile(keyFile)
	if readErr != nil {
		t.Fatal(readErr)
	}
	if string(data) != previous {
		t.Fatal("previous key was not restored")
	}
	if restarts != 2 {
		t.Fatalf("restart count = %d, want 2", restarts)
	}
}

func TestRotateAgentKeyRejectsSymlink(t *testing.T) {
	directory := t.TempDir()
	target := filepath.Join(directory, "target")
	if err := os.WriteFile(target, []byte("previous-key\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(directory, "api-key")
	if err := os.Symlink(target, link); err != nil {
		t.Fatal(err)
	}
	if _, err := RotateAgentKey(context.Background(), link, bytes.NewReader(bytes.Repeat([]byte{4}, apiKeyBytes)), func(context.Context) error { return nil }); err == nil {
		t.Fatal("RotateAgentKey accepted a symlink")
	}
}
