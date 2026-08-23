package apihttp

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/build"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"golang.org/x/crypto/bcrypt"
)

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
	store, err := audit.Open(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           t.TempDir(),
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}
	control := ops.NewControlPlane(docker, ops.DockerCLI{}, store, nil, "", false, cfg.DataDir, "", "", "")
	server, err := New(cfg, control, build.Service{}, store, slog.New(slog.NewTextHandler(io.Discard, nil)))
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
