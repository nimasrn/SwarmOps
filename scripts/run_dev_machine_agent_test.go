package scripts

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"syscall"
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

func TestDevMachineAgentStartsWithoutDockerSocket(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("the local development machine agent supports Linux and macOS")
	}
	if _, err := exec.LookPath("openssl"); err != nil {
		t.Skip("openssl is required by the local development machine agent")
	}

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}

	devRoot := t.TempDir()
	command := exec.Command("bash", "./run-dev-machine-agent.sh")
	command.Env = append(os.Environ(),
		"SWARMOPS_DEV_DIR="+devRoot,
		"SWARMOPS_DEV_MACHINE_API_PORT="+strconv.Itoa(port),
		"SWARMOPS_DOCKER_SOCKET="+filepath.Join(devRoot, "missing-docker.sock"),
	)
	var output bytes.Buffer
	command.Stdout = &output
	command.Stderr = &output
	if err := command.Start(); err != nil {
		t.Fatalf("start local development machine agent: %v", err)
	}
	stopped := false
	defer func() {
		if !stopped {
			stopDevMachineAgent(t, command)
		}
	}()

	client := &http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}}} // #nosec G402 -- local test uses the generated self-signed certificate.
	defer client.CloseIdleConnections()
	healthURL := "https://127.0.0.1:" + strconv.Itoa(port) + "/healthz"
	deadline := time.Now().Add(20 * time.Second)
	for {
		response, err := client.Get(healthURL)
		if err == nil {
			if response.StatusCode != http.StatusOK {
				_ = response.Body.Close()
				t.Fatalf("agent health = %d: %s", response.StatusCode, output.String())
			}
			_ = response.Body.Close()
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("agent did not become healthy without Docker: %v\n%s", err, output.String())
		}
		time.Sleep(100 * time.Millisecond)
	}

	apiKey, err := os.ReadFile(filepath.Join(devRoot, "machine-agent", "api-key"))
	if err != nil {
		t.Fatal(err)
	}
	request, err := http.NewRequest(http.MethodGet, "https://127.0.0.1:"+strconv.Itoa(port)+"/v1/status", nil)
	if err != nil {
		t.Fatal(err)
	}
	request.Header.Set("Authorization", "Bearer "+strings.TrimSpace(string(apiKey)))
	response, err := client.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		t.Fatalf("agent status = %d: %s", response.StatusCode, output.String())
	}
	var status struct {
		DockerAvailable      bool `json:"dockerAvailable"`
		RemoteControlEnabled bool `json:"remoteControlEnabled"`
	}
	if err := json.NewDecoder(response.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if !status.RemoteControlEnabled || status.DockerAvailable {
		t.Fatalf("agent status without Docker = %#v", status)
	}

	stopDevMachineAgent(t, command)
	stopped = true
	listener, err = net.Listen("tcp", "127.0.0.1:"+strconv.Itoa(port))
	if err != nil {
		t.Fatalf("agent did not release its port: %v", err)
	}
	if err := listener.Close(); err != nil {
		t.Fatal(err)
	}
}

func stopDevMachineAgent(t *testing.T, command *exec.Cmd) {
	t.Helper()
	if command.Process == nil {
		return
	}
	_ = command.Process.Signal(syscall.SIGTERM)
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		_ = command.Process.Kill()
		<-done
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
