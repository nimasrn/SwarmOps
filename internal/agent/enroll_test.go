package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
)

type recordingBootstrapper struct {
	request agentcontrol.BootstrapRequest
}

func (b *recordingBootstrapper) Bootstrap(_ context.Context, request agentcontrol.BootstrapRequest) (string, error) {
	b.request = request
	return "Docker Engine is already installed.", nil
}

func (*recordingBootstrapper) ManagerJoinToken(context.Context) (string, error) {
	return "SWMTKN-1-abcdefgh-abcdefghijklmnop", nil
}

func newEnrollmentServer(t *testing.T) (*Server, string) {
	t.Helper()
	secretFile := filepath.Join(t.TempDir(), "enrollment-secret")
	if err := os.WriteFile(secretFile, []byte("one-time-enrollment-secret-value"), 0o600); err != nil {
		t.Fatalf("write enrollment secret: %v", err)
	}
	server, err := NewServer(Config{
		EnrollmentSecret:     []byte("one-time-enrollment-secret-value"),
		EnrollmentSecretFile: secretFile,
		NodeName:             "manager-1",
		Version:              "test",
	}, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatalf("create agent: %v", err)
	}
	return server, secretFile
}

func enrollRequest(secret string) *http.Request {
	request := httptest.NewRequest(http.MethodPost, "/v1/enroll", nil)
	if secret != "" {
		request.Header.Set("Authorization", "Bearer "+secret)
	}
	return request
}

func TestEnrollExchangesSecretForAPIKeyExactlyOnce(t *testing.T) {
	server, secretFile := newEnrollmentServer(t)
	handler := server.Handler()

	first := httptest.NewRecorder()
	handler.ServeHTTP(first, enrollRequest("one-time-enrollment-secret-value"))
	if first.Code != http.StatusOK {
		t.Fatalf("first enrollment: got %d, want 200", first.Code)
	}
	var payload struct {
		APIKey string `json:"apiKey"`
	}
	if err := json.NewDecoder(first.Body).Decode(&payload); err != nil {
		t.Fatalf("decode enrollment response: %v", err)
	}
	if payload.APIKey != "machine-api-key-value-32-bytes!!" {
		t.Fatalf("enrollment returned the wrong key")
	}
	if _, err := os.Lstat(secretFile); !os.IsNotExist(err) {
		t.Fatalf("a spent enrollment secret file must be removed, stat error: %v", err)
	}

	second := httptest.NewRecorder()
	handler.ServeHTTP(second, enrollRequest("one-time-enrollment-secret-value"))
	if second.Code != http.StatusGone {
		t.Fatalf("replayed enrollment: got %d, want 410", second.Code)
	}
}

func TestEnrollRejectsWrongSecretAndBurnsAfterRepeatedFailures(t *testing.T) {
	server, _ := newEnrollmentServer(t)
	handler := server.Handler()
	for attempt := 0; attempt < maxEnrollmentAttempts; attempt++ {
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, enrollRequest("wrong-secret-value-that-is-long"))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: got %d, want 401", attempt, response.Code)
		}
	}
	// The window is closed even for the correct secret once the budget is spent.
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, enrollRequest("one-time-enrollment-secret-value"))
	if response.Code != http.StatusGone {
		t.Fatalf("after the attempt budget: got %d, want 410", response.Code)
	}
}

func TestEnrollRouteIsAbsentWithoutAnEnrollmentSecret(t *testing.T) {
	server, err := NewServer(Config{NodeName: "manager-1", Version: "test"}, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatalf("create agent: %v", err)
	}
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, enrollRequest("anything-at-all-long-enough!!"))
	if response.Code != http.StatusNotFound {
		t.Fatalf("got %d, want 404 when no enrollment secret is configured", response.Code)
	}
}

func TestEnrollNeverLeaksTheKeyThroughStatus(t *testing.T) {
	server, _ := newEnrollmentServer(t)
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/status", nil)
	request.Header.Set("Authorization", "Bearer machine-api-key-value-32-bytes!!")
	server.Handler().ServeHTTP(response, request)
	if strings.Contains(response.Body.String(), "machine-api-key") {
		t.Fatalf("status must not disclose the machine API key")
	}
}

func TestManagedBootstrapRequiresEnrollment(t *testing.T) {
	directory := t.TempDir()
	secretFile := filepath.Join(directory, "enrollment-secret")
	managedFile := filepath.Join(directory, "managed")
	if err := os.WriteFile(secretFile, []byte("one-time-enrollment-secret-value"), 0o600); err != nil {
		t.Fatal(err)
	}
	bootstrapper := &recordingBootstrapper{}
	server, err := NewServer(Config{
		BootstrapEnabled:     true,
		Bootstrapper:         bootstrapper,
		Docker:               newTestDockerClient(t),
		EnrollmentSecret:     []byte("one-time-enrollment-secret-value"),
		EnrollmentSecretFile: secretFile,
		ManagedStateFile:     managedFile,
		RemoteControlEnabled: true,
		NodeName:             "manager-1",
	}, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatal(err)
	}
	request := func() *http.Request {
		value := httptest.NewRequest(http.MethodPost, "/v1/bootstrap", strings.NewReader(`{"action":"docker_install"}`))
		value.Header.Set("Authorization", "Bearer machine-api-key-value-32-bytes!!")
		value.Header.Set("Content-Type", "application/json")
		return value
	}
	before := httptest.NewRecorder()
	server.Handler().ServeHTTP(before, request())
	if before.Code != http.StatusConflict {
		t.Fatalf("bootstrap before enrollment = %d, want 409", before.Code)
	}
	enrolled := httptest.NewRecorder()
	server.Handler().ServeHTTP(enrolled, enrollRequest("one-time-enrollment-secret-value"))
	if enrolled.Code != http.StatusOK {
		t.Fatalf("enroll = %d: %s", enrolled.Code, enrolled.Body.String())
	}
	after := httptest.NewRecorder()
	server.Handler().ServeHTTP(after, request())
	if after.Code != http.StatusOK {
		t.Fatalf("managed bootstrap = %d: %s", after.Code, after.Body.String())
	}
	if bootstrapper.request.Action != agentcontrol.BootstrapDockerInstall {
		t.Fatalf("bootstrap request = %#v", bootstrapper.request)
	}
	if data, err := os.ReadFile(managedFile); err != nil || string(data) != "managed\n" {
		t.Fatalf("managed state = %q, err=%v", data, err)
	}
}

func TestManagedJoinTokenRequiresEnrollmentAndNeverUsesARequestToken(t *testing.T) {
	directory := t.TempDir()
	secretFile := filepath.Join(directory, "enrollment-secret")
	managedFile := filepath.Join(directory, "managed")
	if err := os.WriteFile(secretFile, []byte("one-time-enrollment-secret-value"), 0o600); err != nil {
		t.Fatal(err)
	}
	server, err := NewServer(Config{
		BootstrapEnabled:     true,
		Bootstrapper:         &recordingBootstrapper{},
		Docker:               newTestDockerClient(t),
		EnrollmentSecret:     []byte("one-time-enrollment-secret-value"),
		EnrollmentSecretFile: secretFile,
		ManagedStateFile:     managedFile,
		RemoteControlEnabled: true,
		NodeName:             "manager-1",
	}, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatal(err)
	}
	request := func() *http.Request {
		value := httptest.NewRequest(http.MethodPost, "/v1/bootstrap/join-token", nil)
		value.Header.Set("Authorization", "Bearer machine-api-key-value-32-bytes!!")
		return value
	}
	before := httptest.NewRecorder()
	server.Handler().ServeHTTP(before, request())
	if before.Code != http.StatusConflict {
		t.Fatalf("join token before enrollment = %d, want 409", before.Code)
	}
	enrolled := httptest.NewRecorder()
	server.Handler().ServeHTTP(enrolled, enrollRequest("one-time-enrollment-secret-value"))
	if enrolled.Code != http.StatusOK {
		t.Fatalf("enroll = %d: %s", enrolled.Code, enrolled.Body.String())
	}
	after := httptest.NewRecorder()
	server.Handler().ServeHTTP(after, request())
	if after.Code != http.StatusOK {
		t.Fatalf("managed join token = %d: %s", after.Code, after.Body.String())
	}
	var payload struct {
		Token string `json:"token"`
	}
	if err := json.NewDecoder(after.Body).Decode(&payload); err != nil {
		t.Fatal(err)
	}
	if !agentcontrol.ValidSwarmJoinToken(payload.Token) {
		t.Fatalf("invalid join token response: %q", payload.Token)
	}
}

func TestSpentEnrollmentSecretNeverMarksRestartedHostManaged(t *testing.T) {
	directory := t.TempDir()
	secretFile := filepath.Join(directory, "enrollment-secret")
	managedFile := filepath.Join(directory, "managed")
	if err := os.WriteFile(secretFile, []byte("one-time-enrollment-secret-value"), 0o600); err != nil {
		t.Fatal(err)
	}
	config := Config{
		BootstrapEnabled:     true,
		Bootstrapper:         &recordingBootstrapper{},
		Docker:               newTestDockerClient(t),
		EnrollmentSecret:     []byte("one-time-enrollment-secret-value"),
		EnrollmentSecretFile: secretFile,
		ManagedStateFile:     managedFile,
		RemoteControlEnabled: true,
		NodeName:             "manager-1",
	}
	server, err := NewServer(config, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatal(err)
	}
	for attempt := 0; attempt < maxEnrollmentAttempts; attempt++ {
		response := httptest.NewRecorder()
		server.Handler().ServeHTTP(response, enrollRequest("wrong-secret-value-that-is-long"))
	}
	if _, err := os.Lstat(secretFile); !os.IsNotExist(err) {
		t.Fatalf("spent enrollment secret remained: %v", err)
	}

	config.EnrollmentSecret = nil
	restarted, err := NewServer(config, []byte("machine-api-key-value-32-bytes!!"))
	if err != nil {
		t.Fatal(err)
	}
	statusRequest := httptest.NewRequest(http.MethodGet, "/v1/status", nil)
	statusRequest.Header.Set("Authorization", "Bearer machine-api-key-value-32-bytes!!")
	statusResponse := httptest.NewRecorder()
	restarted.Handler().ServeHTTP(statusResponse, statusRequest)
	var status Status
	if err := json.NewDecoder(statusResponse.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if status.Managed || status.BootstrapAvailable {
		t.Fatalf("spent enrollment made restarted host managed: %#v", status)
	}
}

func TestManagedBootstrapRequiresDurableMarkerPath(t *testing.T) {
	if _, err := NewServer(Config{
		BootstrapEnabled:     true,
		Bootstrapper:         &recordingBootstrapper{},
		Docker:               newTestDockerClient(t),
		RemoteControlEnabled: true,
	}, []byte("machine-api-key-value-32-bytes!!")); err == nil {
		t.Fatal("managed bootstrap started without a durable state marker path")
	}
}
