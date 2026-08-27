package apihttp

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"golang.org/x/crypto/bcrypt"
)

func TestServerUpdateExplainsDisabledAutomaticUpdates(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	dataKey := bytes.Repeat([]byte{31}, 32)
	profiles, err := json.Marshal(map[string]any{
		"version": 1,
		"servers": []domain.Server{{
			ID:              "pull-agent",
			Name:            "pull agent",
			Authentication:  remote.AuthenticationMTLS,
			ConnectionType:  remote.ConnectionAgentPull,
			ConnectionState: "connected",
			AgentHealth: domain.AgentHealth{
				Update: domain.AgentUpdateStatus{Automatic: false},
			},
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "servers.json"), profiles, 0o600); err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(dataDir, dataKey)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(t.TempDir(), dataKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: passwordHash,
		AdminUsername:     "operator",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataKey,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(string) (Target, error) { return Target{}, nil }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodPost, "/api/v1/servers/pull-agent/agent-update", nil)
	request.SetPathValue("id", "pull-agent")
	response := httptest.NewRecorder()
	server.serverUpdate(response, request, auth.Claims{Username: "operator"})
	if response.Code != http.StatusConflict || !strings.Contains(response.Body.String(), "not configured") {
		t.Fatalf("update response = %d: %s", response.Code, response.Body.String())
	}
}

// The console's Agent diagnostics page must receive the retained safe failure
// after an agent stops responding. It must not replace it with a generic
// gateway error, which would recreate the misleading all-green server list.
func TestServerDiagnosticsReturnsRetainedFailureWhenMachineIsOffline(t *testing.T) {
	t.Parallel()
	const machineKey = "test-machine-api-key"
	machine := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer "+machineKey {
			http.Error(response, "unauthorized", http.StatusUnauthorized)
			return
		}
		if request.URL.Path != "/v1/status" {
			http.NotFound(response, request)
			return
		}
		_, _ = io.WriteString(response, `{"nodeName":"agent-1","remoteControlEnabled":true,"version":"test"}`)
	}))
	parsed, err := url.Parse(machine.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(parsed.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(machine.Certificate().Raw)
	dataKey := bytes.Repeat([]byte{23}, 32)
	servers, err := remote.NewManager(t.TempDir(), dataKey)
	if err != nil {
		t.Fatal(err)
	}
	profile, err := servers.Add(context.Background(), remote.AddInput{
		APIKey:                    machineKey,
		APIURL:                    parsed.Scheme + "://" + parsed.Hostname(),
		Name:                      "offline agent",
		Port:                      uint16(port),
		TLSCertificateFingerprint: "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:])),
	})
	if err != nil {
		t.Fatal(err)
	}
	machine.Close()
	if _, err := servers.AgentDiagnostics(context.Background(), profile.ID); err == nil {
		t.Fatal("offline machine probe unexpectedly succeeded")
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(t.TempDir(), dataKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: passwordHash,
		AdminUsername:     "operator",
		CoreID:            "core-diagnostics",
		CoreMode:          "standby",
		DataDir:           t.TempDir(),
		DataEncryptionKey: dataKey,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(string) (Target, error) { return Target{}, nil }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/servers/"+profile.ID+"/diagnostics", nil)
	request.SetPathValue("id", profile.ID)
	response := httptest.NewRecorder()
	server.serverDiagnostics(response, request, auth.Claims{Username: "operator"})
	if response.Code != http.StatusOK {
		t.Fatalf("diagnostics status = %d: %s", response.Code, response.Body.String())
	}
	var health domain.AgentHealth
	if err := json.NewDecoder(response.Body).Decode(&health); err != nil {
		t.Fatal(err)
	}
	if health.State != domain.HealthUnhealthy || health.Summary != "Machine API is unreachable" || health.LastFailureAt.IsZero() {
		t.Fatalf("retained health = %#v", health)
	}
	if strings.Contains(response.Body.String(), "connection refused") {
		t.Fatalf("diagnostics leaked transport detail: %s", response.Body.String())
	}
}
