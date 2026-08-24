package scripts

import (
	"bytes"
	"crypto/x509"
	"encoding/pem"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
	"time"
)

func TestPrepareDevMachineAgent(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the local development machine agent supports Linux and macOS")
	}
	if _, err := exec.LookPath("openssl"); err != nil {
		t.Skip("openssl is required by the local development machine agent")
	}
	devRoot := t.TempDir()
	command := exec.Command("bash", "./run-dev-machine-agent.sh", "--prepare")
	command.Env = append(os.Environ(), "SWARMOPS_DEV_DIR="+devRoot)
	output, err := command.CombinedOutput()
	if err != nil {
		t.Fatalf("prepare local development machine agent: %v\n%s", err, output)
	}
	if len(output) != 0 {
		t.Fatalf("prepare local development machine agent wrote output: %q", output)
	}

	machineDir := filepath.Join(devRoot, "machine-agent")
	assertMode(t, filepath.Join(machineDir, "api-key"), 0o600)
	coreSessionKeyPath := filepath.Join(devRoot, "core-session-key")
	assertMode(t, coreSessionKeyPath, 0o600)
	initialSessionKey, err := os.ReadFile(coreSessionKeyPath)
	if err != nil {
		t.Fatal(err)
	}
	assertMode(t, filepath.Join(machineDir, "tls.key"), 0o600)
	certificatePath := filepath.Join(machineDir, "tls.crt")
	assertMode(t, certificatePath, 0o644)
	data, err := os.ReadFile(certificatePath)
	if err != nil {
		t.Fatal(err)
	}
	block, rest := pem.Decode(data)
	if block == nil || block.Type != "CERTIFICATE" || len(rest) != 0 {
		t.Fatalf("development certificate = %#v", block)
	}
	certificate, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	if !certificate.NotAfter.After(time.Now()) {
		t.Fatalf("development certificate expired at %s", certificate.NotAfter)
	}
	if len(certificate.ExtKeyUsage) != 1 || certificate.ExtKeyUsage[0] != x509.ExtKeyUsageServerAuth {
		t.Fatalf("development certificate extended key usages = %#v", certificate.ExtKeyUsage)
	}

	command = exec.Command("bash", "./run-dev-machine-agent.sh", "--prepare")
	command.Env = append(os.Environ(), "SWARMOPS_DEV_DIR="+devRoot)
	if output, err := command.CombinedOutput(); err != nil {
		t.Fatalf("repeat prepare local development machine agent: %v\n%s", err, output)
	}
	reusedSessionKey, err := os.ReadFile(coreSessionKeyPath)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(initialSessionKey, reusedSessionKey) {
		t.Fatal("local development Core session key changed during repeated preparation")
	}
}

func assertMode(t *testing.T, path string, want os.FileMode) {
	t.Helper()
	info, err := os.Lstat(path)
	if err != nil {
		t.Fatal(err)
	}
	if !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 {
		t.Fatalf("%s is not a regular file", path)
	}
	if got := info.Mode().Perm(); got != want {
		t.Fatalf("%s permissions = %o, want %o", path, got, want)
	}
}
