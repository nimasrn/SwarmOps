package apihttp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"golang.org/x/crypto/bcrypt"
)

func TestConnectionErrorReturnsSafeDiagnostic(t *testing.T) {
	t.Parallel()
	server := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/servers", nil)
	request = request.WithContext(context.WithValue(request.Context(), requestIDKey{}, "request-123"))
	response := httptest.NewRecorder()

	server.connectionError(response, request, fmt.Errorf("connect server: %w", &remote.HostKeyMismatchError{
		Actual:   "SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
		Expected: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
	}))

	if response.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusBadGateway)
	}
	var payload struct {
		Detail    string `json:"detail"`
		Error     string `json:"error"`
		RequestID string `json:"requestId"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Error != "SSH host key fingerprint mismatch" || payload.RequestID != "request-123" || !strings.Contains(payload.Detail, "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") || !strings.Contains(payload.Detail, "SHA256:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB") {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestConnectionErrorExplainsMachineAPIPinReplacement(t *testing.T) {
	t.Parallel()
	server := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/servers/test/connect", nil)
	response := httptest.NewRecorder()

	server.connectionError(response, request, remote.ErrAgentAPIFingerprint)

	var payload struct {
		Detail string `json:"detail"`
		Error  string `json:"error"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Error != "Machine API certificate fingerprint mismatch" || !strings.Contains(payload.Detail, "Servers > Reconnect") {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestOperationErrorExplainsWhenDockerBootstrapIsRequired(t *testing.T) {
	t.Parallel()
	server := &Server{logger: slog.New(slog.NewTextHandler(io.Discard, nil))}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/overview", nil)
	request = request.WithContext(context.WithValue(request.Context(), requestIDKey{}, "request-123"))
	response := httptest.NewRecorder()

	server.operationError(response, request, fmt.Errorf("%w: selected server is connected over SSH", remote.ErrDockerUnavailable))

	if response.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusUnprocessableEntity)
	}
	var payload struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(payload.Error, "Docker is not ready") || !strings.Contains(payload.Error, "Provisioning") {
		t.Fatalf("payload = %#v", payload)
	}
}

func TestLoginMeAndCSRFProtection(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dockerServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path == "/_ping" {
			_, _ = io.WriteString(response, "OK")
			return
		}
		http.NotFound(response, request)
	}))
	defer dockerServer.Close()
	docker, err := dockerapi.NewForURL(dockerServer.URL, dockerServer.Client())
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{5}, 32)
	store, err := audit.Open(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}
	control := ops.NewControlPlane(docker, ops.DockerCLI{}, store, ops.ControlPlaneOptions{DataDir: cfg.DataDir})
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	targets := TargetResolverFunc(func(id string) (Target, error) {
		if id != "test" {
			return Target{}, fmt.Errorf("select a connected server")
		}
		return Target{Build: build.Service{}, Control: control}, nil
	})
	server, err := New(cfg, targets, servers, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"operator","password":"test-password"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResponse.Code, loginResponse.Body.String())
	}
	cookies := loginResponse.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].HttpOnly || cookies[0].Secure {
		t.Fatalf("unexpected cookie: %#v", cookies)
	}

	meRequest := httptest.NewRequest(http.MethodGet, "/api/v1/auth/me", nil)
	meRequest.AddCookie(cookies[0])
	meResponse := httptest.NewRecorder()
	handler.ServeHTTP(meResponse, meRequest)
	if meResponse.Code != http.StatusOK {
		t.Fatalf("me status = %d body=%s", meResponse.Code, meResponse.Body.String())
	}

	logoutRequest := httptest.NewRequest(http.MethodPost, "/api/v1/auth/logout", nil)
	logoutRequest.AddCookie(cookies[0])
	logoutResponse := httptest.NewRecorder()
	handler.ServeHTTP(logoutResponse, logoutRequest)
	if logoutResponse.Code != http.StatusForbidden {
		t.Fatalf("logout without csrf = %d", logoutResponse.Code)
	}
}

func TestOverviewUsesSelectedRemoteManager(t *testing.T) {
	t.Parallel()

	dockerServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/nodes":
			_, _ = io.WriteString(response, `[{"ID":"manager-1","Description":{"Hostname":"manager-1","Resources":{"NanoCPUs":4000000000,"MemoryBytes":8589934592}},"Spec":{"Availability":"active","Role":"manager"},"Status":{"Addr":"10.0.0.1","State":"ready"}}]`)
		case "/services":
			_, _ = io.WriteString(response, `[{"ID":"service-1","Spec":{"Labels":{"com.docker.stack.namespace":"demo"},"Mode":{"Replicated":{"Replicas":2}},"Name":"demo_web","TaskTemplate":{"ContainerSpec":{"Image":"ghcr.io/example/demo:1"}}}}]`)
		case "/tasks":
			_, _ = io.WriteString(response, `[{"ID":"task-1","NodeID":"manager-1","ServiceID":"service-1","Status":{"State":"running"}},{"ID":"task-2","NodeID":"manager-1","ServiceID":"service-1","Status":{"State":"running"}}]`)
		default:
			http.NotFound(response, request)
		}
	}))
	defer dockerServer.Close()

	docker, err := dockerapi.NewForURL(dockerServer.URL, dockerServer.Client())
	if err != nil {
		t.Fatal(err)
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{7}, 32)
	store, err := audit.Open(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}
	control := ops.NewControlPlane(docker, ops.DockerCLI{}, store, ops.ControlPlaneOptions{DataDir: cfg.DataDir})
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	var resolvedID string
	targets := TargetResolverFunc(func(id string) (Target, error) {
		resolvedID = id
		if id != "selected-manager" {
			return Target{}, fmt.Errorf("select a connected server")
		}
		return Target{Control: control}, nil
	})
	server, err := New(cfg, targets, servers, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}

	loginRequest := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"operator","password":"test-password"}`))
	loginRequest.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(loginResponse, loginRequest)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResponse.Code, loginResponse.Body.String())
	}

	overviewRequest := httptest.NewRequest(http.MethodGet, "/api/v1/overview", nil)
	overviewRequest.AddCookie(loginResponse.Result().Cookies()[0])
	overviewRequest.Header.Set("X-SwarmOps-Server-ID", "selected-manager")
	overviewResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(overviewResponse, overviewRequest)
	if overviewResponse.Code != http.StatusOK {
		t.Fatalf("overview status = %d body=%s", overviewResponse.Code, overviewResponse.Body.String())
	}
	if resolvedID != "selected-manager" {
		t.Fatalf("resolved server ID = %q, want selected-manager", resolvedID)
	}

	var overview domain.Overview
	if err := json.NewDecoder(overviewResponse.Body).Decode(&overview); err != nil {
		t.Fatal(err)
	}
	if overview.Summary.Nodes != 1 || overview.Summary.Managers != 1 || overview.Summary.ReadyNodes != 1 {
		t.Fatalf("node summary = %#v", overview.Summary)
	}
	if overview.Summary.Services != 1 || overview.Summary.RunningTasks != 2 || len(overview.Services) != 1 || overview.Services[0].Name != "demo_web" {
		t.Fatalf("service summary = %#v services=%#v", overview.Summary, overview.Services)
	}
}

func TestHandlerRestrictsDirectTLSClientNetworks(t *testing.T) {
	t.Parallel()
	allowed := netip.MustParsePrefix("198.51.100.10/32")
	server := &Server{config: config.Config{AllowedClientCIDRs: []netip.Prefix{allowed}}}
	handler := server.Handler()

	blocked := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	blocked.RemoteAddr = "203.0.113.7:443"
	blockedResponse := httptest.NewRecorder()
	handler.ServeHTTP(blockedResponse, blocked)
	if blockedResponse.Code != http.StatusForbidden {
		t.Fatalf("blocked client status = %d, want %d", blockedResponse.Code, http.StatusForbidden)
	}

	permitted := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	permitted.RemoteAddr = "198.51.100.10:443"
	permittedResponse := httptest.NewRecorder()
	handler.ServeHTTP(permittedResponse, permitted)
	if permittedResponse.Code != http.StatusOK {
		t.Fatalf("permitted client status = %d body=%s", permittedResponse.Code, permittedResponse.Body.String())
	}
	if got := permittedResponse.Header().Get("X-Content-Type-Options"); got != "nosniff" {
		t.Fatalf("security headers missing from direct response: %q", got)
	}
}
