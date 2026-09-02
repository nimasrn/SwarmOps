package apihttp

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/audit"
	"github.com/nimasrn/SwarmOps/internal/auth"
	"github.com/nimasrn/SwarmOps/internal/config"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/preflight"
	"github.com/nimasrn/SwarmOps/internal/remote"
	"github.com/nimasrn/SwarmOps/internal/source"
	"golang.org/x/crypto/bcrypt"
)

func TestSourceConnectionAPISealsAndNeverReturnsProviderToken(t *testing.T) {
	providerServer := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.URL.Path != "/user" || request.Header.Get("Authorization") != "Bearer github_pat_never_return_this_value" {
			http.Error(response, "invalid request", http.StatusUnauthorized)
			return
		}
		response.Header().Set("Content-Type", "application/json")
		_, _ = io.WriteString(response, `{"login":"nima"}`)
	}))
	defer providerServer.Close()
	providerURL, err := url.Parse(providerServer.URL)
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	key := bytes.Repeat([]byte{41}, 32)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(directory, key, 100)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(t.TempDir(), key)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           directory,
		DataEncryptionKey: key,
		MutationEnabled:   true,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
		SourceEnabled:     true,
	}
	api, err := New(cfg, TargetResolverFunc(func(string) (Target, error) { return Target{}, nil }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	connectionStore, err := source.NewStore(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	sourceService, err := source.NewService(connectionStore, source.Options{AllowedHosts: []string{providerURL.Host}, AllowHTTP: true, HTTPClient: providerServer.Client()})
	if err != nil {
		t.Fatal(err)
	}
	api.SetSourceService(sourceService)
	handler := api.Handler()

	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login = %d %s", loginResponse.Code, loginResponse.Body.String())
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookie := loginResponse.Result().Cookies()[0]
	token := "github_pat_never_return_this_value"
	create := httptest.NewRequest(http.MethodPost, "/api/v1/sources/connections", bytes.NewBufferString(`{"baseUrl":"`+providerServer.URL+`","kind":"github","name":"Work GitHub","token":"`+token+`"}`))
	create.Header.Set("Content-Type", "application/json")
	create.Header.Set("X-CSRF-Token", session.CSRFToken)
	create.AddCookie(cookie)
	createResponse := httptest.NewRecorder()
	handler.ServeHTTP(createResponse, create)
	if createResponse.Code != http.StatusCreated {
		t.Fatalf("create = %d %s", createResponse.Code, createResponse.Body.String())
	}
	if strings.Contains(createResponse.Body.String(), token) || strings.Contains(createResponse.Body.String(), "never_return") {
		t.Fatalf("create response leaked token: %s", createResponse.Body.String())
	}

	list := httptest.NewRequest(http.MethodGet, "/api/v1/sources/connections", nil)
	list.AddCookie(cookie)
	listResponse := httptest.NewRecorder()
	handler.ServeHTTP(listResponse, list)
	if listResponse.Code != http.StatusOK || strings.Contains(listResponse.Body.String(), token) {
		t.Fatalf("list = %d %s", listResponse.Code, listResponse.Body.String())
	}
	sealed, err := os.ReadFile(filepath.Join(directory, "source-connections.sealed"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte(token)) {
		t.Fatal("provider token was stored in plaintext")
	}
	events, err := auditStore.Recent(20)
	if err != nil {
		t.Fatal(err)
	}
	eventJSON, err := json.Marshal(events)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(eventJSON, []byte(token)) {
		t.Fatalf("audit event leaked provider token: %s", eventJSON)
	}
}

func TestSourceStatusIsAvailableWithoutExposingConfigurationValues(t *testing.T) {
	server := &Server{config: config.Config{BuildEnabled: true, SourceAllowedHosts: []string{"git.internal.example"}, SourceEnabled: true, SourceImagePrefix: "registry.example/team"}, sources: &source.Service{}}
	request := httptest.NewRequest(http.MethodGet, "/api/v1/sources/status", nil)
	response := httptest.NewRecorder()
	server.sourceStatus(response, request, auth.Claims{})
	if response.Code != http.StatusOK || strings.Contains(response.Body.String(), "git.internal.example") || strings.Contains(response.Body.String(), "registry.example") {
		t.Fatalf("unsafe source status: %d %s", response.Code, response.Body.String())
	}
}

func TestSourceApplicationSpecCannotOverrideDiscoveredImageDatabasesOrSharedTelemetry(t *testing.T) {
	requested := ops.ApplicationSpec{
		Databases: []string{"mongo"}, DatabaseDelivery: ops.DeliveryEnv,
		HealthPath: "", Image: "attacker.example/wrong:tag", Metrics: false,
		Name: "approved-slot", Port: 9999, Tracing: false,
	}
	candidate := source.ServicePlan{
		Databases: []string{"postgres", "redis"}, HealthPath: "/readyz",
		Image: "ghcr.io/acme/api:aaaaaaaaaaaa", Metrics: true, Port: 8080,
		SharedStacks: []string{"swarmops-logs"}, Tracing: true,
	}
	spec, stacks := sourceApplicationSpec(requested, candidate)
	if spec.Image != candidate.Image || strings.Join(spec.Databases, ",") != "postgres,redis" || spec.DatabaseDelivery != ops.DeliverySecret || spec.Port != 8080 || spec.HealthPath != "/readyz" || !spec.Metrics || !spec.Tracing {
		t.Fatalf("source spec was not fixed by server evidence: %#v", spec)
	}
	if strings.Join(stacks, ",") != "swarmops-logs,swarmops-observability" {
		t.Fatalf("shared stacks = %#v", stacks)
	}
}

func TestApplicationDomainEndpointUsesSelectedManagerAndRequiresRemovalConfirmation(t *testing.T) {
	key := bytes.Repeat([]byte{43}, 32)
	directory := t.TempDir()
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(directory, key, 100)
	if err != nil {
		t.Fatal(err)
	}
	manifest := preflight.Manifest{
		APIVersion: preflight.APIVersion,
		Kind:       preflight.Kind,
		Namespace:  "production",
		Registry:   preflight.Registry{Host: "ghcr.io", Mode: "ghcr", Namespace: "nimasrn"},
		DNS: preflight.DNS{
			Providers: []preflight.DNSProvider{{Name: "cloudflare", Type: "cloudflare", CredentialSecret: "traefik_cf_dns_token_v1"}},
			Resolvers: []preflight.CertificateResolver{{Name: "le", Challenge: "dns", Provider: "cloudflare"}},
		},
		Nodes: []preflight.Node{{Name: "manager-1", CPUCores: 4, AvailableCPUCores: 3, MemoryMiB: 4096, AvailableMemoryMiB: 3072, AvailableDiskGiB: 100, Labels: map[string]string{}}},
		Workloads: []preflight.Workload{{
			Name: "api", Profile: "application", Replicas: 1, Resolver: "le",
			DomainOptional: true, DomainSuffixes: []string{"apps.example.com"},
			Resources: preflight.Resources{CPUCores: 1, DiskGiB: 1, MemoryMiB: 256},
		}},
	}
	admission, err := ops.NewPlatformAdmission(manifest)
	if err != nil {
		t.Fatal(err)
	}
	applications, err := ops.NewApplicationStore(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	if err := applications.Put(ops.ApplicationSpec{
		CPUs: 1, Domain: "old.apps.example.com", Image: "ghcr.io/nimasrn/api:2026.08.26",
		MemoryMiB: 256, Name: "api", Port: 8080, Replicas: 1, Resolver: "le",
	}); err != nil {
		t.Fatal(err)
	}
	control := ops.NewControlPlane(nil, ops.DockerCLI{}, auditStore, ops.ControlPlaneOptions{Admission: admission, Apps: applications, DataDir: directory})
	serversDirectory := t.TempDir()
	serverProfiles, err := json.Marshal(map[string]any{
		"version": 1,
		"servers": []map[string]any{{
			"authentication":     remote.AuthenticationPassword,
			"host":               "127.0.0.1",
			"hostKeyFingerprint": "SHA256:" + strings.Repeat("A", 43),
			"id":                 "manager-b",
			"name":               "manager b",
			"port":               22,
			"username":           "operator",
		}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(serversDirectory, "servers.json"), serverProfiles, 0o600); err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(serversDirectory, key)
	if err != nil {
		t.Fatal(err)
	}
	var resolved string
	server, err := New(config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		DataDir:           directory,
		DataEncryptionKey: key,
		MutationEnabled:   true,
		SecureCookies:     false,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
	}, TargetResolverFunc(func(id string) (Target, error) {
		resolved = id
		if id != "manager-b" {
			return Target{}, fmt.Errorf("unexpected target")
		}
		return Target{Control: control}, nil
	}), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	handler := server.Handler()
	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login = %d %s", loginResponse.Code, loginResponse.Body.String())
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookie := loginResponse.Result().Cookies()[0]
	request := func(body, key string) *http.Request {
		result := httptest.NewRequest(http.MethodPost, "/api/v1/applications/api/domain", bytes.NewBufferString(body))
		result.Header.Set("Content-Type", "application/json")
		result.Header.Set("Idempotency-Key", key)
		result.Header.Set("X-SwarmOps-Cluster-ID", "default")
		result.Header.Set("X-CSRF-Token", session.CSRFToken)
		result.Header.Set("X-SwarmOps-Server-ID", "manager-b")
		result.AddCookie(cookie)
		return result
	}
	assigned := httptest.NewRecorder()
	handler.ServeHTTP(assigned, request(`{"domain":"new.apps.example.com","resolver":"le"}`, "assign-domain"))
	if assigned.Code != http.StatusAccepted || resolved != "manager-b" {
		t.Fatalf("assignment = %d target=%q body=%s", assigned.Code, resolved, assigned.Body.String())
	}
	var command struct {
		Action   string `json:"action"`
		ServerID string `json:"serverId"`
	}
	if err := json.NewDecoder(assigned.Body).Decode(&command); err != nil {
		t.Fatal(err)
	}
	if command.Action != commandApplicationDomain || command.ServerID != "manager-b" {
		t.Fatalf("domain command = %#v", command)
	}
	missingConfirmation := httptest.NewRecorder()
	handler.ServeHTTP(missingConfirmation, request(`{"domain":""}`, "remove-domain-missing-confirmation"))
	if missingConfirmation.Code != http.StatusUnprocessableEntity {
		t.Fatalf("unconfirmed removal = %d %s", missingConfirmation.Code, missingConfirmation.Body.String())
	}
	removed := httptest.NewRecorder()
	handler.ServeHTTP(removed, request(`{"domain":"","confirmation":"REMOVE_DOMAIN_API"}`, "remove-domain-confirmed"))
	if removed.Code != http.StatusAccepted {
		t.Fatalf("confirmed removal = %d %s", removed.Code, removed.Body.String())
	}
}

// A controller that ships with the boundary off must still be turnable on from
// the console: the whole point of sealed source settings is that an operator
// with a browser and no shell can finish setup.
func TestSourceSettingsEnableTheBoundaryWithoutRestart(t *testing.T) {
	directory := t.TempDir()
	key := bytes.Repeat([]byte{7}, 32)
	hash, err := bcrypt.GenerateFromPassword([]byte("test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	auditStore, err := audit.Open(directory, key, 100)
	if err != nil {
		t.Fatal(err)
	}
	servers, err := remote.NewManager(t.TempDir(), key)
	if err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{
		AdminPasswordHash: hash,
		AdminUsername:     "operator",
		BuildMaxBytes:     1 << 20,
		DataDir:           directory,
		DataEncryptionKey: key,
		MutationEnabled:   true,
		SessionKey:        []byte("01234567890123456789012345678901"),
		SessionTTL:        time.Hour,
		SourceEnabled:     false,
	}
	api, err := New(cfg, TargetResolverFunc(func(string) (Target, error) { return Target{}, nil }), servers, auditStore, slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	connectionStore, err := source.NewStore(directory, key)
	if err != nil {
		t.Fatal(err)
	}
	sourceService, err := source.NewService(connectionStore, source.Options{})
	if err != nil {
		t.Fatal(err)
	}
	settingsStore, err := source.NewSettingsStore(directory, key, source.Settings{})
	if err != nil {
		t.Fatal(err)
	}
	api.SetSourceService(sourceService)
	api.SetSourceSettings(settingsStore)
	handler := api.Handler()

	login := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"operator","password":"test-password"}`))
	login.Header.Set("Content-Type", "application/json")
	loginResponse := httptest.NewRecorder()
	handler.ServeHTTP(loginResponse, login)
	if loginResponse.Code != http.StatusOK {
		t.Fatalf("login = %d %s", loginResponse.Code, loginResponse.Body.String())
	}
	var session struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(loginResponse.Body).Decode(&session); err != nil {
		t.Fatal(err)
	}
	cookie := loginResponse.Result().Cookies()[0]

	before := httptest.NewRequest(http.MethodGet, "/api/v1/sources/connections", nil)
	before.AddCookie(cookie)
	beforeResponse := httptest.NewRecorder()
	handler.ServeHTTP(beforeResponse, before)
	if beforeResponse.Code != http.StatusServiceUnavailable {
		t.Fatalf("connections before setup = %d %s", beforeResponse.Code, beforeResponse.Body.String())
	}

	password := "registry-push-secret"
	apply := httptest.NewRequest(http.MethodPut, "/api/v1/sources/settings", bytes.NewBufferString(`{"buildEnabled":true,"enabled":true,"imagePrefix":"ghcr.io/acme","privateHosts":["git.example.com"],"registryPassword":"`+password+`","registryServer":"ghcr.io","registryUsername":"robot"}`))
	apply.Header.Set("Content-Type", "application/json")
	apply.Header.Set("X-CSRF-Token", session.CSRFToken)
	apply.AddCookie(cookie)
	applyResponse := httptest.NewRecorder()
	handler.ServeHTTP(applyResponse, apply)
	if applyResponse.Code != http.StatusOK {
		t.Fatalf("apply = %d %s", applyResponse.Code, applyResponse.Body.String())
	}
	if strings.Contains(applyResponse.Body.String(), password) {
		t.Fatalf("settings response leaked the registry password: %s", applyResponse.Body.String())
	}

	after := httptest.NewRequest(http.MethodGet, "/api/v1/sources/connections", nil)
	after.AddCookie(cookie)
	afterResponse := httptest.NewRecorder()
	handler.ServeHTTP(afterResponse, after)
	if afterResponse.Code != http.StatusOK {
		t.Fatalf("connections after setup = %d %s", afterResponse.Code, afterResponse.Body.String())
	}

	statusRequest := httptest.NewRequest(http.MethodGet, "/api/v1/sources/status", nil)
	statusRequest.AddCookie(cookie)
	statusResponse := httptest.NewRecorder()
	handler.ServeHTTP(statusResponse, statusRequest)
	var status struct {
		BuildEnabled          bool `json:"buildEnabled"`
		Enabled               bool `json:"enabled"`
		ImagePrefixConfigured bool `json:"imagePrefixConfigured"`
	}
	if err := json.NewDecoder(statusResponse.Body).Decode(&status); err != nil {
		t.Fatal(err)
	}
	if !status.Enabled || !status.BuildEnabled || !status.ImagePrefixConfigured {
		t.Fatalf("status did not reflect applied settings: %+v", status)
	}
	sealed, err := os.ReadFile(filepath.Join(directory, "source-settings.sealed"))
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte(password)) {
		t.Fatal("registry password was stored in plaintext")
	}
	if prefixes := api.sourceImagePrefixes(); len(prefixes) != 1 || prefixes[0] != "ghcr.io/acme/" {
		t.Fatalf("push allow-list did not cover the configured namespace: %v", prefixes)
	}
}
