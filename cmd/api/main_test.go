package main

import (
	"bytes"
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/bcrypt"
)

func TestReleasedCoreCommandsBypassAPIStartup(t *testing.T) {
	binary := filepath.Join(t.TempDir(), "swarmops-core")
	build := exec.Command("go", "build", "-o", binary, ".")
	if output, err := build.CombinedOutput(); err != nil {
		t.Fatalf("build released Core binary: %v\n%s", err, output)
	}

	t.Run("version", func(t *testing.T) {
		command := exec.Command(binary, "--version")
		output, err := command.CombinedOutput()
		if err != nil {
			t.Fatalf("run --version: %v\n%s", err, output)
		}
		if got := strings.TrimSpace(string(output)); got != version {
			t.Fatalf("--version = %q, want %q", got, version)
		}
	})

	t.Run("password hash", func(t *testing.T) {
		password := []byte("installer-test-password")
		command := exec.Command(binary, "password-hash")
		command.Stdin = bytes.NewReader(append(password, '\n'))
		output, err := command.CombinedOutput()
		if err != nil {
			t.Fatalf("run password-hash: %v\n%s", err, output)
		}
		if err := bcrypt.CompareHashAndPassword(bytes.TrimSpace(output), password); err != nil {
			t.Fatalf("password-hash returned an invalid bcrypt hash: %v", err)
		}
	})

	for _, test := range []struct {
		name string
		args []string
		want string
	}{
		{name: "upgrade", args: []string{"upgrade", "unexpected"}, want: "Usage: swarmops-core upgrade"},
		{name: "access", args: []string{"access"}, want: "Usage: swarmops-core access set-cidrs"},
	} {
		t.Run(test.name, func(t *testing.T) {
			command := exec.Command(binary, test.args...)
			output, err := command.CombinedOutput()
			var exitError *exec.ExitError
			if !errors.As(err, &exitError) || exitError.ExitCode() != 2 {
				t.Fatalf("run %v: exit error = %v, output = %s", test.args, err, output)
			}
			if !strings.Contains(string(output), test.want) {
				t.Fatalf("run %v output = %q, want %q", test.args, output, test.want)
			}
			if strings.Contains(string(output), "load configuration") {
				t.Fatalf("run %v entered API startup: %s", test.args, output)
			}
		})
	}
}
