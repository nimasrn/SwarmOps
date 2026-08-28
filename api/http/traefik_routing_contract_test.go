package apihttp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"golang.org/x/crypto/bcrypt"
)

func TestTraefikSettingsEndpointRequiresAuthAndCSRF(t *testing.T) {
	t.Parallel()
	server, csrf, cookie := buildTraefikContractServer(t, "manager-1")
	handler := server.Handler()
	payload, err := json.Marshal(map[string]any{
		"confirmation": "RESTART_SINGLETON_TRAEFIK",
		"settings":     ops.DefaultTraefikSettings("ops@example.com"),
	})
	if err != nil {
		t.Fatal(err)
	}

	noAuth := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	noAuth.Header.Set("Content-Type", "application/json")
	noAuth.Header.Set("Idempotency-Key", "settings-auth")
	noAuth.Header.Set("X-SwarmOps-Cluster-ID", "default")
	noAuth.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	noAuth.Header.Set("X-CSRF-Token", csrf)
	noAuthResponse := httptest.NewRecorder()
	handler.ServeHTTP(noAuthResponse, noAuth)
	if noAuthResponse.Code != http.StatusUnauthorized {
		t.Fatalf("no auth status = %d body=%s", noAuthResponse.Code, noAuthResponse.Body.String())
	}

	noCSRF := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	noCSRF.Header.Set("Content-Type", "application/json")
	noCSRF.Header.Set("Idempotency-Key", "settings-no-csrf")
	noCSRF.Header.Set("X-SwarmOps-Cluster-ID", "default")
	noCSRF.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	noCSRF.AddCookie(cookie)
	noCSRFResponse := httptest.NewRecorder()
	handler.ServeHTTP(noCSRFResponse, noCSRF)
	if noCSRFResponse.Code != http.StatusForbidden {
		t.Fatalf("no csrf status = %d body=%s", noCSRFResponse.Code, noCSRFResponse.Body.String())
	}
}

func TestTraefikSettingsCommandHeadersMustBePresent(t *testing.T) {
	t.Parallel()
	server, csrf, cookie := buildTraefikContractServer(t, "manager-1")
	handler := server.Handler()
	payload, err := json.Marshal(map[string]any{
		"confirmation": "RESTART_SINGLETON_TRAEFIK",
		"settings":     ops.DefaultTraefikSettings("ops@example.com"),
	})
	if err != nil {
		t.Fatal(err)
	}

	missingIdempotency := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	missingIdempotency.Header.Set("Content-Type", "application/json")
	missingIdempotency.Header.Set("X-SwarmOps-Cluster-ID", "default")
	missingIdempotency.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	missingIdempotency.Header.Set("X-CSRF-Token", csrf)
	missingIdempotency.AddCookie(cookie)
	missingIdempotencyResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingIdempotencyResponse, missingIdempotency)
	if missingIdempotencyResponse.Code != http.StatusBadRequest {
		t.Fatalf("missing idempotency status = %d body=%s", missingIdempotencyResponse.Code, missingIdempotencyResponse.Body.String())
	}

	missingCluster := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	missingCluster.Header.Set("Content-Type", "application/json")
	missingCluster.Header.Set("Idempotency-Key", "settings-missing-cluster")
	missingCluster.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	missingCluster.Header.Set("X-CSRF-Token", csrf)
	missingCluster.AddCookie(cookie)
	missingClusterResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingClusterResponse, missingCluster)
	if missingClusterResponse.Code != http.StatusConflict {
		t.Fatalf("missing cluster status = %d body=%s", missingClusterResponse.Code, missingClusterResponse.Body.String())
	}

	missingServer := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	missingServer.Header.Set("Content-Type", "application/json")
	missingServer.Header.Set("Idempotency-Key", "settings-header-test")
	missingServer.Header.Set("X-SwarmOps-Cluster-ID", "default")
	missingServer.Header.Set("X-CSRF-Token", csrf)
	missingServer.AddCookie(cookie)
	missingServerResponse := httptest.NewRecorder()
	handler.ServeHTTP(missingServerResponse, missingServer)
	if missingServerResponse.Code != http.StatusConflict {
		t.Fatalf("missing server status = %d body=%s", missingServerResponse.Code, missingServerResponse.Body.String())
	}

	unknownServer := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(payload))
	unknownServer.Header.Set("Content-Type", "application/json")
	unknownServer.Header.Set("Idempotency-Key", "settings-unknown-server")
	unknownServer.Header.Set("X-SwarmOps-Cluster-ID", "default")
	unknownServer.Header.Set("X-CSRF-Token", csrf)
	unknownServer.Header.Set("X-SwarmOps-Server-ID", "manager-does-not-exist")
	unknownServer.AddCookie(cookie)
	unknownServerResponse := httptest.NewRecorder()
	handler.ServeHTTP(unknownServerResponse, unknownServer)
	if unknownServerResponse.Code != http.StatusNotFound {
		t.Fatalf("unknown server status = %d body=%s", unknownServerResponse.Code, unknownServerResponse.Body.String())
	}
}

func TestTraefikSettingsSubmissionReturnsCommandWithoutMutationPayload(t *testing.T) {
	t.Parallel()
	server, csrf, cookie := buildTraefikContractServer(t, "manager-1")
	handler := server.Handler()
	settingsOne := ops.DefaultTraefikSettings("alpha@example.com")
	settingsTwo := ops.DefaultTraefikSettings("beta@example.com")
	bodyOne, err := json.Marshal(map[string]any{
		"confirmation": "RESTART_SINGLETON_TRAEFIK",
		"settings":     settingsOne,
	})
	if err != nil {
		t.Fatal(err)
	}
	bodyTwo, err := json.Marshal(map[string]any{
		"confirmation": "RESTART_SINGLETON_TRAEFIK",
		"settings":     settingsTwo,
	})
	if err != nil {
		t.Fatal(err)
	}

	first := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(bodyOne))
	first.Header.Set("Content-Type", "application/json")
	first.Header.Set("Idempotency-Key", "settings-conflict-1")
	first.Header.Set("X-SwarmOps-Cluster-ID", "default")
	first.Header.Set("X-CSRF-Token", csrf)
	first.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	first.AddCookie(cookie)
	firstResponse := httptest.NewRecorder()
	handler.ServeHTTP(firstResponse, first)
	if firstResponse.Code != http.StatusAccepted {
		t.Fatalf("first submit status = %d body=%s", firstResponse.Code, firstResponse.Body.String())
	}
	var command map[string]any
	if err := json.NewDecoder(firstResponse.Body).Decode(&command); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"settings", "route", "binding", "record", "payload"} {
		if _, found := command[key]; found {
			t.Fatalf("command response leaked internal payload field %q", key)
		}
	}
	if action, _ := command["action"].(string); action != commandTraefikSettingsApply {
		t.Fatalf("command action = %q", action)
	}
	if serverID, _ := command["serverId"].(string); serverID != "manager-1" {
		t.Fatalf("command server = %q", serverID)
	}

	conflict := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/settings", bytes.NewReader(bodyTwo))
	conflict.Header.Set("Content-Type", "application/json")
	conflict.Header.Set("Idempotency-Key", "settings-conflict-1")
	conflict.Header.Set("X-SwarmOps-Cluster-ID", "default")
	conflict.Header.Set("X-CSRF-Token", csrf)
	conflict.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	conflict.AddCookie(cookie)
	conflictResponse := httptest.NewRecorder()
	handler.ServeHTTP(conflictResponse, conflict)
	if conflictResponse.Code != http.StatusConflict {
		t.Fatalf("conflict status = %d body=%s", conflictResponse.Code, conflictResponse.Body.String())
	}
}

func TestTraefikInstallRejectsMissingACMEEmailBeforeQueueing(t *testing.T) {
	t.Parallel()
	server, csrf, cookie := buildTraefikContractServer(t, "manager-1")
	control := ops.NewControlPlane(nil, ops.DockerCLI{}, server.audit, ops.ControlPlaneOptions{
		Mutations:        true,
		TraefikSettings:  ops.TraefikStackSettings{},
		TraefikStackFile: filepath.Join(t.TempDir(), "traefik.yml"),
	})
	server.targets = TargetResolverFunc(func(id string) (Target, error) {
		if id != "manager-1" {
			return Target{}, fmt.Errorf("select a connected server")
		}
		return Target{Control: control}, nil
	})

	request := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/reconcile", strings.NewReader(`{"confirmation":"DEPLOY_TRAEFIK"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", "install-missing-acme")
	request.Header.Set("X-SwarmOps-Cluster-ID", "default")
	request.Header.Set("X-CSRF-Token", csrf)
	request.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)

	if response.Code != http.StatusUnprocessableEntity || !strings.Contains(response.Body.String(), "Traefik ACME email is not configured") {
		t.Fatalf("status = %d body=%s", response.Code, response.Body.String())
	}
	commands, err := server.commands.List(100)
	if err != nil {
		t.Fatal(err)
	}
	if len(commands) != 0 {
		t.Fatalf("invalid install was queued: %#v", commands)
	}
}

func TestTraefikPreflightUsesExplicitTargetAndReturnsSafeChecklist(t *testing.T) {
	t.Parallel()
	server, _, cookie := buildTraefikContractServer(t, "manager-1")
	machine := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		response.Header().Set("Content-Type", "application/json")
		switch request.URL.Path {
		case "/networks":
			_, _ = response.Write([]byte(`[{"Attachable":true,"Driver":"overlay","Name":"traefik","Options":{"encrypted":""},"Scope":"swarm"}]`))
		case "/nodes":
			_, _ = response.Write([]byte(`[{"ID":"manager-1","Spec":{"Availability":"active","Labels":{"nim.edge":"true"},"Role":"manager"},"Status":{"State":"ready"}}]`))
		case "/configs":
			_, _ = response.Write([]byte(`[{"Spec":{"Name":"nim_traefik_dynamic_v1"}}]`))
		case "/secrets":
			_, _ = response.Write([]byte(`[{"Spec":{"Name":"traefik_dashboard_auth_v1"}}]`))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(machine.Close)
	docker, err := dockerapi.NewForURL(machine.URL, machine.Client())
	if err != nil {
		t.Fatal(err)
	}
	control := ops.NewControlPlane(docker, ops.DockerCLI{}, server.audit, ops.ControlPlaneOptions{
		TraefikSettings: ops.TraefikStackSettings{
			ACMEEmail: "ops@example.com", ArvanAPIKeySecret: "traefik_arvan_api_key_v1", CFDNSTokenSecret: "traefik_cf_dns_token_v1",
			DashboardAuthSecret: "traefik_dashboard_auth_v1", DashboardHost: "traefik.example.com", DynamicConfigName: "nim_traefik_dynamic_v1", Image: "traefik:v3.6.13",
		},
	})
	server.targets = TargetResolverFunc(func(id string) (Target, error) {
		if id != "manager-1" {
			return Target{}, fmt.Errorf("select a connected server")
		}
		return Target{Control: control}, nil
	})

	request := httptest.NewRequest(http.MethodGet, "/api/v1/traefik/preflight", nil)
	request.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	server.Handler().ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("status = %d body=%s", response.Code, response.Body.String())
	}
	var preflight ops.TraefikInstallPreflight
	if err := json.NewDecoder(response.Body).Decode(&preflight); err != nil {
		t.Fatal(err)
	}
	if preflight.Challenge != "http-01" || len(preflight.Checks) < 9 {
		t.Fatalf("preflight = %#v", preflight)
	}
	foundAgent := false
	for _, check := range preflight.Checks {
		if check.ID == "agent-version" {
			foundAgent = true
			if !strings.Contains(check.Detail, "protocol") {
				t.Fatalf("agent check = %#v", check)
			}
		}
	}
	if !foundAgent {
		t.Fatal("agent compatibility check was omitted")
	}
}

func TestTraefikBindingRejectsUnknownFields(t *testing.T) {
	t.Parallel()
	server, csrf, cookie := buildTraefikContractServer(t, "manager-1")
	handler := server.Handler()

	body := `{"callerService":"svc","delivery":"existing","targetRoute":"api","version":1,"unexpected":42}`
	request := httptest.NewRequest(http.MethodPost, "/api/v1/traefik/bindings", strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", "binding-unknown-fields")
	request.Header.Set("X-SwarmOps-Cluster-ID", "default")
	request.Header.Set("X-CSRF-Token", csrf)
	request.Header.Set("X-SwarmOps-Server-ID", "manager-1")
	request.AddCookie(cookie)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d body=%s", response.Code, response.Body.String())
	}
}

func TestTraefikLogsValidateBoundsBeforeTargetState(t *testing.T) {
	t.Parallel()
	server, _, cookie := buildTraefikContractServer(t, "manager-1")
	handler := server.Handler()

	tooMany := httptest.NewRequest(http.MethodGet, "/api/v1/traefik/logs?limit=2001", nil)
	tooMany.AddCookie(cookie)
	tooManyResponse := httptest.NewRecorder()
	handler.ServeHTTP(tooManyResponse, tooMany)
	if tooManyResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("limit bound status = %d body=%s", tooManyResponse.Code, tooManyResponse.Body.String())
	}

	now := time.Now().UTC()
	from := now.Add(-8 * 24 * time.Hour).Format(time.RFC3339)
	to := now.Format(time.RFC3339)
	wideWindowURL := fmt.Sprintf("/api/v1/traefik/logs?from=%s&to=%s&level=INFO&limit=20", from, to)
	wideWindow := httptest.NewRequest(http.MethodGet, wideWindowURL, nil)
	wideWindow.AddCookie(cookie)
	wideWindowResponse := httptest.NewRecorder()
	handler.ServeHTTP(wideWindowResponse, wideWindow)
	if wideWindowResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("window bound status = %d body=%s", wideWindowResponse.Code, wideWindowResponse.Body.String())
	}

	invalidLevel := httptest.NewRequest(http.MethodGet, "/api/v1/traefik/logs?level=TRACE", nil)
	invalidLevel.AddCookie(cookie)
	invalidLevelResponse := httptest.NewRecorder()
	handler.ServeHTTP(invalidLevelResponse, invalidLevel)
	if invalidLevelResponse.Code != http.StatusUnprocessableEntity {
		t.Fatalf("level validation status = %d body=%s", invalidLevelResponse.Code, invalidLevelResponse.Body.String())
	}
}

func buildTraefikContractServer(t *testing.T, serverID string) (*Server, string, *http.Cookie) {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	dataKey := bytes.Repeat([]byte{2}, 32)
	dataDir := t.TempDir()
	auditStore, err := audit.Open(dataDir, dataKey, 100)
	if err != nil {
		t.Fatal(err)
	}
	if err := writeLegacyServersFile(dataDir, serverID); err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(dataDir, dataKey)
	if err != nil {
		t.Fatal(err)
	}
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           dataDir,
		DataEncryptionKey: dataKey,
		MutationEnabled:   true,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(id string) (Target, error) {
		return Target{}, nil
	}), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", strings.NewReader(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	server.Handler().ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login status = %d body=%s", loginResponse.Code, loginResponse.Body.String())
	}
	var loginPayload struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&loginPayload); err != nil {
		t.Fatal(err)
	}
	cookies := loginResponse.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("cookies = %#v", cookies)
	}
	return server, loginPayload.CSRFToken, cookies[0]
}

func writeLegacyServersFile(dataDir, serverID string) error {
	profiles := map[string]any{
		"version": 1,
		"servers": []map[string]any{{
			"authentication":        remote.AuthenticationPassword,
			"connectionState":       "connected",
			"dockerAvailable":       true,
			"host":                  "127.0.0.1",
			"hostKeyFingerprint":    "SHA256:" + strings.Repeat("A", 43),
			"id":                    serverID,
			"name":                  "controller",
			"port":                  22,
			"swarmControlAvailable": true,
			"swarmState":            "active",
			"username":              "operator",
		}},
	}
	encoded, err := json.Marshal(profiles)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dataDir, "servers.json"), encoded, 0o600)
}
