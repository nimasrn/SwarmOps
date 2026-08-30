package apihttp

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/queue"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"golang.org/x/crypto/bcrypt"
)

type fakeProvisioner struct {
	last   agentcontrol.ProvisioningRequest
	status agentcontrol.ProvisioningStatus
}

func (f *fakeProvisioner) Provision(_ context.Context, input agentcontrol.ProvisioningRequest) error {
	f.last = input
	return nil
}

func (f *fakeProvisioner) ProvisioningStatus(context.Context) (agentcontrol.ProvisioningStatus, error) {
	return f.status, nil
}

type fakeHostInspector struct{ snapshot agent.Snapshot }

func (f fakeHostInspector) Snapshot(context.Context) (agent.Snapshot, error) { return f.snapshot, nil }

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

func TestRemoteMutationAdmissionIsDisabledByDefault(t *testing.T) {
	t.Parallel()

	server := &Server{config: config.Config{MutationEnabled: false}}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/networks", nil)
	response := httptest.NewRecorder()

	_, _, accepted := server.commandSubmissionContext(response, request)
	if accepted {
		t.Fatal("disabled remote mutation was admitted to the command ledger")
	}
	if response.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusForbidden)
	}
	var payload struct {
		Error string `json:"error"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if payload.Error != "Remote mutations are disabled on this control plane" {
		t.Fatalf("error = %q", payload.Error)
	}

	retryResponse := httptest.NewRecorder()
	server.commandRetry(retryResponse, httptest.NewRequest(http.MethodPost, "/api/v1/commands/cmd-1/retry", nil), auth.Claims{Username: "operator"})
	if retryResponse.Code != http.StatusForbidden {
		t.Fatalf("retry status = %d, want %d", retryResponse.Code, http.StatusForbidden)
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
	store, err := audit.Open(t.TempDir(), dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		MutationEnabled:   true,
		SecureCookies:     true,
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
	handler := PlaintextHTTPHandler(server.Handler())

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
	if got, want := cookies[0].Name, plaintextSessionCookie; got != want {
		t.Fatalf("plaintext session cookie = %q, want %q", got, want)
	}
	if got := loginResponse.Header().Get("Strict-Transport-Security"); got != "" {
		t.Fatalf("plaintext response set HSTS: %q", got)
	}
	if got := loginResponse.Header().Get("X-SwarmOps-Transport"); got != "plaintext-http" {
		t.Fatalf("plaintext transport header = %q", got)
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

func TestHTTPSHandlerKeepsSecureSessionAndPlaintextBlocksAgents(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{7}, 32)
	store, err := audit.Open(t.TempDir(), dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		SecureCookies:     true,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(string) (Target, error) { return Target{}, nil }), servers, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}

	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, login)
	if response.Code != http.StatusOK {
		t.Fatalf("login = %d: %s", response.Code, response.Body.String())
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 || !cookies[0].Secure {
		t.Fatalf("HTTPS session cookie = %#v, want Secure", cookies)
	}
	if got, want := cookies[0].Name, sessionCookie; got != want {
		t.Fatalf("HTTPS session cookie = %q, want %q", got, want)
	}
	if got := response.Header().Get("Strict-Transport-Security"); got == "" {
		t.Fatal("HTTPS response did not set HSTS")
	}

	agentRequest := httptest.NewRequest(http.MethodPost, "/agent/v1/poll", nil)
	agentResponse := httptest.NewRecorder()
	PlaintextHTTPHandler(server.Handler()).ServeHTTP(agentResponse, agentRequest)
	if agentResponse.Code != http.StatusUpgradeRequired {
		t.Fatalf("plaintext agent poll = %d, want %d", agentResponse.Code, http.StatusUpgradeRequired)
	}
}

func TestServerReadinessUsesPathTargetAndDurableQueue(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{11}, 32)
	auditStore, err := audit.Open(t.TempDir(), dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	machineKey := "test-machine-api-key"
	machine := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer "+machineKey {
			http.Error(response, "unauthorized", http.StatusUnauthorized)
			return
		}
		if request.URL.Path != "/v1/status" {
			http.NotFound(response, request)
			return
		}
		_, _ = io.WriteString(response, `{"nodeName":"bootstrap-1","remoteControlEnabled":true}`)
	}))
	defer machine.Close()
	parsed, err := url.Parse(machine.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(parsed.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(machine.Certificate().Raw)
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	profile, err := servers.Add(context.Background(), remote.AddInput{
		APIKey:                    machineKey,
		APIURL:                    parsed.Scheme + "://" + parsed.Hostname(),
		Name:                      "bootstrap-1",
		Port:                      uint16(port),
		TLSCertificateFingerprint: fmt.Sprintf("SHA256:%X", fingerprint),
	})
	if err != nil {
		t.Fatal(err)
	}
	provisioner := &fakeProvisioner{status: agentcontrol.ProvisioningStatus{
		Capabilities: agentcontrol.ProvisioningCapabilities{InstallDocker: true},
		OS:           agentcontrol.ProvisioningOS{ID: "ubuntu", Name: "Ubuntu", Supported: true},
	}}
	hostSnapshot := agent.Snapshot{
		CollectedAt: time.Date(2026, time.August, 27, 12, 0, 0, 0, time.UTC),
		Disk:        agent.Disk{AvailableBytes: 75 << 30, TotalBytes: 100 << 30, UsedBytes: 25 << 30},
		Hardware:    agent.Hardware{CPUCores: 8, MemoryAvailable: 12 << 30, MemoryTotal: 16 << 30, UptimeSeconds: 86400},
		NodeName:    "bootstrap-1",
		OS:          agent.OS{Architecture: "amd64", Kernel: "6.8.0", Name: "Ubuntu 24.04 LTS"},
		Version:     "0.5.0",
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		MutationEnabled:   true,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}
	server, err := New(cfg, TargetResolverFunc(func(id string) (Target, error) {
		if id != profile.ID {
			return Target{}, fmt.Errorf("unexpected target %q", id)
		}
		return Target{Host: fakeHostInspector{snapshot: hostSnapshot}, Provisioner: provisioner}, nil
	}), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login = %d: %s", loginResponse.Code, loginResponse.Body.String())
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookie := loginResponse.Result().Cookies()[0]
	readiness := httptest.NewRequest(http.MethodGet, "/api/v1/servers/"+profile.ID+"/readiness", nil)
	readiness.AddCookie(cookie)
	readinessResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(readinessResponse, readiness)
	if readinessResponse.Code != http.StatusOK {
		t.Fatalf("readiness = %d: %s", readinessResponse.Code, readinessResponse.Body.String())
	}
	var readinessPayload serverReadinessResponse
	if err := json.NewDecoder(readinessResponse.Body).Decode(&readinessPayload); err != nil {
		t.Fatal(err)
	}
	if readinessPayload.Host == nil || readinessPayload.Host.NodeName != "bootstrap-1" || readinessPayload.Host.Hardware.CPUCores != 8 {
		t.Fatalf("readiness host snapshot = %#v", readinessPayload.Host)
	}
	queueRequest := httptest.NewRequest(http.MethodPost, "/api/v1/servers/"+profile.ID+"/readiness", strings.NewReader(`{"confirmation":"PREPARE_SERVER","installDocker":true}`))
	queueRequest.AddCookie(cookie)
	queueRequest.Header.Set("Content-Type", "application/json")
	queueRequest.Header.Set("Idempotency-Key", "server-readiness-1")
	queueRequest.Header.Set("X-SwarmOps-Cluster-ID", "default")
	queueRequest.Header.Set("X-CSRF-Token", session.CSRFToken)
	queueResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(queueResponse, queueRequest)
	if queueResponse.Code != http.StatusAccepted {
		t.Fatalf("queue readiness = %d: %s", queueResponse.Code, queueResponse.Body.String())
	}
	record, found, err := server.CommandStore().ClaimDue()
	if err != nil || !found || record.Command.Action != commandServerReadiness || record.Command.ServerID != profile.ID {
		t.Fatalf("queued record = %#v found=%t err=%v", record, found, err)
	}
	if err := server.ExecuteCommand(context.Background(), record); err != nil {
		t.Fatal(err)
	}
	if !provisioner.last.InstallDocker || provisioner.last.Confirmation != agentcontrol.ProvisionConfirmation {
		t.Fatalf("provisioning request = %#v", provisioner.last)
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
	store, err := audit.Open(t.TempDir(), dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataEncryptionKey,
		MutationEnabled:   true,
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

func TestCoreTopologyIsSeparateFromManagedServers(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{13}, 32)
	dataDir := t.TempDir()
	auditStore, err := audit.Open(dataDir, dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		CoreEndpoint:      "https://core-primary.example.test",
		CoreID:            "core-primary",
		CoreMode:          "active",
		CoreName:          "Primary control plane",
		DataDir:           dataDir,
		DataEncryptionKey: dataEncryptionKey,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(string) (Target, error) { return Target{}, fmt.Errorf("no managed server") }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	cookie, csrf := authenticatedSession(t, handler)

	coreRequest := httptest.NewRequest(http.MethodGet, "/api/v1/core", nil)
	coreRequest.AddCookie(cookie)
	coreResponse := httptest.NewRecorder()
	handler.ServeHTTP(coreResponse, coreRequest)
	if coreResponse.Code != http.StatusOK {
		t.Fatalf("core status = %d: %s", coreResponse.Code, coreResponse.Body.String())
	}
	var topology domain.CoreTopology
	if err := json.NewDecoder(coreResponse.Body).Decode(&topology); err != nil {
		t.Fatal(err)
	}
	if topology.LocalID != "core-primary" || !topology.ControlEnabled || len(topology.Members) != 1 {
		t.Fatalf("core topology = %#v", topology)
	}

	addReplica := httptest.NewRequest(http.MethodPost, "/api/v1/core/replicas", strings.NewReader(`{"confirmation":"PREPARE_CORE_REPLICA","endpoint":"https://core-standby.example.test","id":"core-standby","name":"Standby control plane"}`))
	addReplica.AddCookie(cookie)
	addReplica.Header.Set("Content-Type", "application/json")
	addReplica.Header.Set("X-CSRF-Token", csrf)
	addReplicaResponse := httptest.NewRecorder()
	handler.ServeHTTP(addReplicaResponse, addReplica)
	if addReplicaResponse.Code != http.StatusCreated {
		t.Fatalf("add core replica = %d: %s", addReplicaResponse.Code, addReplicaResponse.Body.String())
	}

	serversRequest := httptest.NewRequest(http.MethodGet, "/api/v1/servers", nil)
	serversRequest.AddCookie(cookie)
	serversResponse := httptest.NewRecorder()
	handler.ServeHTTP(serversResponse, serversRequest)
	if serversResponse.Code != http.StatusOK {
		t.Fatalf("servers = %d: %s", serversResponse.Code, serversResponse.Body.String())
	}
	var profiles []domain.Server
	if err := json.NewDecoder(serversResponse.Body).Decode(&profiles); err != nil {
		t.Fatal(err)
	}
	if len(profiles) != 0 {
		t.Fatalf("core members leaked into managed servers: %#v", profiles)
	}
}

func TestStandbyBlocksAgentOperationsUntilExplicitPromotion(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataEncryptionKey := bytes.Repeat([]byte{14}, 32)
	dataDir := t.TempDir()
	auditStore, err := audit.Open(dataDir, dataEncryptionKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(t.TempDir(), dataEncryptionKey)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		CoreID:            "core-standby",
		CoreMode:          "standby",
		DataDir:           dataDir,
		DataEncryptionKey: dataEncryptionKey,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(string) (Target, error) { return Target{}, fmt.Errorf("no managed server") }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	cookie, csrf := authenticatedSession(t, handler)

	blocked := httptest.NewRequest(http.MethodPost, "/api/v1/servers", strings.NewReader(`{}`))
	blocked.AddCookie(cookie)
	blocked.Header.Set("Content-Type", "application/json")
	blocked.Header.Set("X-CSRF-Token", csrf)
	blockedResponse := httptest.NewRecorder()
	handler.ServeHTTP(blockedResponse, blocked)
	if blockedResponse.Code != http.StatusConflict {
		t.Fatalf("standby server mutation = %d: %s", blockedResponse.Code, blockedResponse.Body.String())
	}

	promote := httptest.NewRequest(http.MethodPost, "/api/v1/core/promote", strings.NewReader(`{"confirmation":"PROMOTE_CORE:core-standby","primaryConfirmedStopped":true}`))
	promote.AddCookie(cookie)
	promote.Header.Set("Content-Type", "application/json")
	promote.Header.Set("X-CSRF-Token", csrf)
	promoteResponse := httptest.NewRecorder()
	handler.ServeHTTP(promoteResponse, promote)
	if promoteResponse.Code != http.StatusOK {
		t.Fatalf("emergency promote = %d: %s", promoteResponse.Code, promoteResponse.Body.String())
	}
	if !server.CanExecuteCommands() {
		t.Fatal("promoted core cannot execute commands")
	}
}

func authenticatedSession(t *testing.T, handler http.Handler) (*http.Cookie, string) {
	t.Helper()
	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, login)
	if response.Code != http.StatusOK {
		t.Fatalf("login = %d: %s", response.Code, response.Body.String())
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(response.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookies := response.Result().Cookies()
	if len(cookies) != 1 || session.CSRFToken == "" {
		t.Fatalf("login session = cookies:%#v csrf:%q", cookies, session.CSRFToken)
	}
	return cookies[0], session.CSRFToken
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

func TestLoginAttemptKeyUsesTrustedProxyForwardedAddress(t *testing.T) {
	t.Parallel()
	proxies := []netip.Prefix{netip.MustParsePrefix("10.30.0.0/16")}

	newRequest := func(remoteAddr, forwarded string) *http.Request {
		request := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", nil)
		request.RemoteAddr = remoteAddr
		if forwarded != "" {
			request.Header.Set("X-Forwarded-For", forwarded)
		}
		return request
	}

	// Without trusted proxies the socket peer is used even if a header lies.
	if got := loginAttemptKey(newRequest("203.0.113.9:5555", "198.51.100.1"), "Operator", nil); !strings.HasSuffix(got, "|203.0.113.9") {
		t.Fatalf("untrusted proxy key = %q", got)
	}
	// A trusted proxy chain resolves to the first untrusted hop from the right.
	key := loginAttemptKey(newRequest("10.30.4.7:5555", "198.51.100.1, 10.30.4.7"), "operator", proxies)
	if got, want := key, "operator|198.51.100.1"; got != want {
		t.Fatalf("trusted proxy key = %q, want %q", got, want)
	}
	// A fully trusted or malformed chain falls back to the socket peer.
	if got := loginAttemptKey(newRequest("10.30.4.7:5555", "10.30.4.7"), "operator", proxies); !strings.HasSuffix(got, "|10.30.4.7") {
		t.Fatalf("fully trusted chain key = %q", got)
	}
	if got := loginAttemptKey(newRequest("10.30.4.7:5555", "not-an-address"), "operator", proxies); !strings.HasSuffix(got, "|10.30.4.7") {
		t.Fatalf("malformed forwarded header key = %q", got)
	}
}

func TestClassifyCommandErrorRespectsExplicitlyPermanentOutcomes(t *testing.T) {
	t.Parallel()
	permanent := queue.PermanentError(errors.New("remote outcome is unknowable"))
	if classified := classifyCommandError(permanent); classified != permanent {
		t.Fatalf("permanent error was reclassified: %v", classified)
	}
	retriable := errors.New("connection reset by machine API")
	if classified := classifyCommandError(retriable); queue.IsPermanent(classified) {
		t.Fatalf("transient error became permanent: %v", classified)
	}
	policy := errors.New("image registry is not allow-listed")
	if classified := classifyCommandError(policy); !queue.IsPermanent(classified) {
		t.Fatalf("policy error stayed retriable: %v", classified)
	}
	typed := testCommandFailure{code: agentcontrol.CommandFailureNetworkMissing}
	if classified := classifyCommandError(typed); !queue.IsPermanent(classified) {
		t.Fatalf("deterministic machine failure stayed retriable: %v", classified)
	}
	if classified := classifyCommandError(nil); classified != nil {
		t.Fatalf("nil error classified = %v", classified)
	}
}

type testCommandFailure struct{ code string }

func (err testCommandFailure) Error() string           { return "machine API returned HTTP 502" }
func (err testCommandFailure) SafeFailureCode() string { return err.code }
