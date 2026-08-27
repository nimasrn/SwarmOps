package agent

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
)

func TestRemoteControlEndpointsAreAuthenticatedAndFixed(t *testing.T) {
	t.Parallel()
	docker := newTestDockerClient(t)
	server, err := NewServer(Config{Docker: docker, NodeName: "manager-1", RemoteControlEnabled: true, Version: "test"}, []byte("test-machine-api-key"))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/v1/status", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized status = %d, want %d", unauthorized.Code, http.StatusUnauthorized)
	}
	unauthorizedMetrics := httptest.NewRecorder()
	handler.ServeHTTP(unauthorizedMetrics, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	if unauthorizedMetrics.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized metrics = %d, want %d", unauthorizedMetrics.Code, http.StatusUnauthorized)
	}

	status := authenticatedRequest(http.MethodGet, "/v1/status")
	statusResponse := httptest.NewRecorder()
	handler.ServeHTTP(statusResponse, status)
	if statusResponse.Code != http.StatusOK {
		t.Fatalf("status = %d: %s", statusResponse.Code, statusResponse.Body.String())
	}
	var value Status
	if err := json.NewDecoder(statusResponse.Body).Decode(&value); err != nil {
		t.Fatal(err)
	}
	if !value.RemoteControlEnabled || !value.DockerAvailable || value.DockerVersion != "27.0.0" || value.NodeName != "manager-1" {
		t.Fatalf("status = %#v", value)
	}

	infoResponse := httptest.NewRecorder()
	handler.ServeHTTP(infoResponse, authenticatedRequest(http.MethodGet, "/v1/engine/info"))
	if infoResponse.Code != http.StatusOK {
		t.Fatalf("engine info = %d: %s", infoResponse.Code, infoResponse.Body.String())
	}

	arbitraryResponse := httptest.NewRecorder()
	handler.ServeHTTP(arbitraryResponse, authenticatedRequest(http.MethodGet, "/v1/engine/containers/abc/exec"))
	if arbitraryResponse.Code != http.StatusNotFound {
		t.Fatalf("arbitrary engine endpoint = %d, want %d", arbitraryResponse.Code, http.StatusNotFound)
	}
}

func TestNewServerRejectsRemoteControlWithoutDocker(t *testing.T) {
	t.Parallel()
	if _, err := NewServer(Config{RemoteControlEnabled: true}, []byte("test-machine-api-key")); err == nil {
		t.Fatal("remote control without Docker was accepted")
	}
}

func TestDiagnosticsAndFixedUpdateRequestAreAuthenticated(t *testing.T) {
	t.Parallel()
	temporary := t.TempDir()
	requestFile := filepath.Join(temporary, "update.request")
	server, err := NewServer(Config{
		AutomaticUpdates:     true,
		Docker:               newTestDockerClient(t),
		NodeName:             "manager-1",
		RemoteControlEnabled: true,
		UpdateBusyFile:       filepath.Join(temporary, "update.busy"),
		UpdateRequestFile:    requestFile,
		UpdateStatusFile:     filepath.Join(temporary, "update-status.json"),
		Version:              "test",
	}, []byte("test-machine-api-key"))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()

	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/v1/diagnostics", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized diagnostics = %d", unauthorized.Code)
	}

	diagnostics := httptest.NewRecorder()
	handler.ServeHTTP(diagnostics, authenticatedRequest(http.MethodGet, "/v1/diagnostics"))
	if diagnostics.Code != http.StatusOK {
		t.Fatalf("diagnostics = %d: %s", diagnostics.Code, diagnostics.Body.String())
	}
	var value Diagnostics
	if err := json.NewDecoder(diagnostics.Body).Decode(&value); err != nil {
		t.Fatal(err)
	}
	if !value.Update.Automatic || value.Status.ProtocolVersion != agentProtocolVersion || len(value.Events) == 0 || value.Events[0].Code != "agent_started" {
		t.Fatalf("diagnostics = %#v", value)
	}

	update := httptest.NewRecorder()
	handler.ServeHTTP(update, authenticatedRequest(http.MethodPost, "/v1/agent/update"))
	if update.Code != http.StatusOK {
		t.Fatalf("update request = %d: %s", update.Code, update.Body.String())
	}
	request, err := os.ReadFile(requestFile)
	if err != nil {
		t.Fatal(err)
	}
	if string(request) != "check\n" {
		t.Fatalf("update request = %q", request)
	}
}

func TestProvisioningEndpointIsAuthenticatedAndNeverFallsBackToShell(t *testing.T) {
	t.Parallel()
	docker := newTestDockerClient(t)
	server, err := NewServer(Config{Docker: docker, NodeName: "manager-1", RemoteControlEnabled: true, Version: "test"}, []byte("test-machine-api-key"))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	unauthorized := httptest.NewRecorder()
	handler.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/v1/provisioning/status", nil))
	if unauthorized.Code != http.StatusUnauthorized {
		t.Fatalf("unauthorized readiness = %d", unauthorized.Code)
	}
	status := httptest.NewRecorder()
	handler.ServeHTTP(status, authenticatedRequest(http.MethodGet, "/v1/provisioning/status"))
	if status.Code != http.StatusOK {
		t.Fatalf("readiness status = %d: %s", status.Code, status.Body.String())
	}
	// A configured helper is required. The agent must not silently execute an
	// arbitrary local fallback when the narrow privileged boundary is absent.
	apply := authenticatedRequest(http.MethodPost, "/v1/provisioning")
	apply.Header.Set("Content-Type", "application/json")
	apply.Body = io.NopCloser(strings.NewReader(`{"confirmation":"PREPARE_SERVER","installDocker":true}`))
	applyResponse := httptest.NewRecorder()
	handler.ServeHTTP(applyResponse, apply)
	if applyResponse.Code != http.StatusBadGateway {
		t.Fatalf("unconfigured helper apply = %d: %s", applyResponse.Code, applyResponse.Body.String())
	}
}

func authenticatedRequest(method, target string) *http.Request {
	request := httptest.NewRequest(method, target, nil)
	request.Header.Set("Authorization", "Bearer test-machine-api-key")
	return request
}

func newTestDockerClient(t *testing.T) *dockerapi.Client {
	t.Helper()
	backend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/_ping":
			_, _ = response.Write([]byte("OK"))
		case "/version":
			_, _ = response.Write([]byte(`{"Version":"27.0.0"}`))
		case "/info":
			_, _ = response.Write([]byte(`{"Swarm":{"ControlAvailable":true,"LocalNodeState":"active"}}`))
		case "/nodes", "/services", "/tasks":
			_, _ = response.Write([]byte(`[]`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(backend.Close)
	client, err := dockerapi.NewForURL(backend.URL, backend.Client())
	if err != nil {
		t.Fatal(err)
	}
	if err := client.Ping(context.Background()); err != nil {
		t.Fatal(err)
	}
	return client
}
