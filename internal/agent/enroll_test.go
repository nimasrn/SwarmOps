package agent

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

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
