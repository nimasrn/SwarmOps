package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
	handler.ServeHTTP(arbitraryResponse, authenticatedRequest(http.MethodGet, "/v1/engine/containers/json"))
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
