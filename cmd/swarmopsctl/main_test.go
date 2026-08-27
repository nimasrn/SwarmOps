package main

import (
	"archive/tar"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

func TestArchiveContextRejectsDockerfileOutsideContext(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	for _, dockerfile := range []string{"../Dockerfile", "/tmp/Dockerfile", "."} {
		if _, _, err := archiveContext(root, dockerfile, 1<<20); err == nil {
			t.Fatalf("archiveContext(%q) accepted an unsafe Dockerfile path", dockerfile)
		}
	}
}

func TestArchiveContextHonorsDockerignoreButKeepsDockerfile(t *testing.T) {
	t.Parallel()
	root := t.TempDir()
	for name, content := range map[string]string{
		".dockerignore": "ignored.txt\nDockerfile\n",
		"Dockerfile":    "FROM scratch\n",
		"ignored.txt":   "secret\n",
		"visible.txt":   "included\n",
	} {
		if err := os.WriteFile(filepath.Join(root, name), []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
	}

	reader, finished, err := archiveContext(root, "Dockerfile", 1<<20)
	if err != nil {
		t.Fatal(err)
	}
	data, readErr := io.ReadAll(reader)
	closeErr := reader.Close()
	archiveErr := <-finished
	if readErr != nil || closeErr != nil || archiveErr != nil {
		t.Fatalf("archive errors: read=%v close=%v write=%v", readErr, closeErr, archiveErr)
	}

	entries := map[string]bool{}
	archive := tar.NewReader(bytes.NewReader(data))
	for {
		header, err := archive.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		entries[header.Name] = true
	}
	if !entries["Dockerfile"] || !entries["visible.txt"] || !entries[".dockerignore"] {
		t.Fatalf("expected Dockerfile, visible file, and .dockerignore; got %#v", entries)
	}
	if entries["ignored.txt"] {
		t.Fatalf("ignored file was included: %#v", entries)
	}
}

func TestPreflightNodesHTTPMapsAuthenticatedInventory(t *testing.T) {
	t.Parallel()
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/api/v1/auth/login":
			if request.Method != http.MethodPost {
				t.Fatalf("login method = %s", request.Method)
			}
			http.SetCookie(response, &http.Cookie{Name: "swarmops_session", Value: "session", Path: "/"})
			_ = json.NewEncoder(response).Encode(map[string]string{"csrfToken": "csrf"})
		case "/api/v1/nodes":
			if _, err := request.Cookie("swarmops_session"); err != nil {
				t.Fatalf("missing session cookie: %v", err)
			}
			if got := request.Header.Get("X-SwarmOps-Server-ID"); got != "server-test" {
				t.Fatalf("server header = %q", got)
			}
			nodes := []domain.Node{{Hostname: "node-01", State: "ready", Agent: domain.NodeAgent{Healthy: true}, Labels: map[string]string{"nim.mongo": "true"}}}
			nodes[0].CPU.Capacity = 8
			nodes[0].Memory.Capacity = 16 * 1024 * 1024 * 1024
			nodes[0].Memory.Available = 12 * 1024 * 1024 * 1024
			nodes[0].Disk.Available = 400 * 1024 * 1024 * 1024
			_ = json.NewEncoder(response).Encode(nodes)
		default:
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
	}))
	defer server.Close()

	endpoint, err := parseBaseURL(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	observed, err := preflightNodesHTTP(endpoint, "operator", "password", "server-test", "")
	if err != nil {
		t.Fatal(err)
	}
	if len(observed) != 1 || observed[0].Name != "node-01" || observed[0].AvailableMemoryMiB != 12288 || observed[0].AvailableDiskGiB != 400 {
		t.Fatalf("observed = %#v", observed)
	}
}

func TestPreflightNodesHTTPAcceptsExactSelfSignedCorePin(t *testing.T) {
	t.Parallel()
	server := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/api/v1/auth/login":
			http.SetCookie(response, &http.Cookie{Name: "swarmops_session", Value: "session", Path: "/"})
			_ = json.NewEncoder(response).Encode(map[string]string{"csrfToken": "csrf"})
		case "/api/v1/nodes":
			_ = json.NewEncoder(response).Encode([]domain.Node{{Hostname: "pinned-node", State: "ready"}})
		default:
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
	}))
	defer server.Close()
	endpoint, err := parseBaseURL(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	digest := sha256.Sum256(server.Certificate().Raw)
	fingerprint := "SHA256:" + hex.EncodeToString(digest[:])
	observed, err := preflightNodesHTTP(endpoint, "operator", "password", "server-test", fingerprint)
	if err != nil {
		t.Fatal(err)
	}
	if len(observed) != 1 || observed[0].Name != "pinned-node" {
		t.Fatalf("observed = %#v", observed)
	}
	wrong := "SHA256:" + strings.Repeat("0", 64)
	if _, err := preflightNodesHTTP(endpoint, "operator", "password", "server-test", wrong); err == nil || !strings.Contains(err.Error(), "does not match") {
		t.Fatalf("wrong pin error = %v", err)
	}
}

func TestHashPasswordUsesBcrypt(t *testing.T) {
	t.Parallel()
	password := []byte("a sufficiently long operator password")
	hash, err := hashPassword(password)
	if err != nil {
		t.Fatal(err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), password); err != nil {
		t.Fatalf("generated hash does not verify: %v", err)
	}
}

func TestNewCommandIdempotencyKey(t *testing.T) {
	t.Parallel()
	first, err := newCommandIdempotencyKey()
	if err != nil {
		t.Fatal(err)
	}
	second, err := newCommandIdempotencyKey()
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(first, "build-") || len(first) != len("build-")+32 || first == second {
		t.Fatalf("unexpected idempotency keys: %q, %q", first, second)
	}
}

func TestBuildQueuesAnIdempotentCommand(t *testing.T) {
	contextDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(contextDir, "Dockerfile"), []byte("FROM scratch\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	var sawBuild bool
	server := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/api/v1/auth/login":
			http.SetCookie(response, &http.Cookie{Name: "swarmops_session", Value: "session", Path: "/"})
			_ = json.NewEncoder(response).Encode(map[string]string{"csrfToken": "csrf"})
		case "/api/v1/builds":
			sawBuild = true
			if got := request.Header.Get("X-CSRF-Token"); got != "csrf" {
				t.Errorf("csrf header = %q", got)
			}
			if got := request.Header.Get("X-SwarmOps-Server-ID"); got != "server-test" {
				t.Errorf("server header = %q", got)
			}
			if got := request.Header.Get("X-SwarmOps-Cluster-ID"); got != "default" {
				t.Errorf("cluster header = %q", got)
			}
			key := request.Header.Get("Idempotency-Key")
			if !strings.HasPrefix(key, "build-") || len(key) != len("build-")+32 {
				t.Errorf("idempotency key = %q", key)
			}
			if _, err := io.ReadAll(request.Body); err != nil {
				t.Errorf("read archive: %v", err)
			}
			response.WriteHeader(http.StatusAccepted)
			_ = json.NewEncoder(response).Encode(domain.Command{ID: "cmd-0123456789abcdef0123456789abcdef", State: domain.CommandQueued})
		default:
			t.Errorf("unexpected path %s", request.URL.Path)
		}
	}))
	defer server.Close()

	stdin, input, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := input.WriteString("test-password\n"); err != nil {
		t.Fatal(err)
	}
	if err := input.Close(); err != nil {
		t.Fatal(err)
	}
	previousStdin := os.Stdin
	os.Stdin = stdin
	t.Cleanup(func() {
		os.Stdin = previousStdin
		_ = stdin.Close()
	})

	err = build([]string{
		"--url", server.URL,
		"--username", "operator",
		"--cluster-id", "default",
		"--server-id", "server-test",
		"--context", contextDir,
		"--image", "ghcr.io/nimasrn/demo:2026.08.24",
		"--password-stdin",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !sawBuild {
		t.Fatal("build endpoint was not called")
	}
}
