package remote

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

func TestManagerConnectsThroughPinnedMachineAPIWithoutPersistingKey(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key"
	endpoint, fingerprint := newTestMachineAPI(t, apiKey)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		APIKey:                    apiKey,
		APIURL:                    endpoint.origin,
		Name:                      "manager one",
		Port:                      endpoint.port,
		TLSCertificateFingerprint: fingerprint,
	})
	if err != nil {
		t.Fatalf("add machine API: %v", err)
	}
	if profile.ConnectionType != ConnectionAgentAPI || profile.Authentication != AuthenticationAPIKey || profile.ConnectionState != connectedState || !profile.DockerAvailable || profile.DockerVersion != "27.0.0" || !profile.SwarmControlAvailable {
		t.Fatalf("profile = %#v", profile)
	}
	connection, err := manager.Resolve(profile.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Docker.Ping(context.Background()); err != nil {
		t.Fatalf("machine Docker ping: %v", err)
	}
	runner, ok := connection.Runner.(*AgentRunner)
	if !ok {
		t.Fatalf("runner = %T, want AgentRunner", connection.Runner)
	}
	readiness, err := runner.ProvisioningStatus(context.Background())
	if err != nil || !readiness.Docker.Running || readiness.Capabilities.InstallDocker {
		t.Fatalf("readiness = %#v, err=%v", readiness, err)
	}
	if err := manager.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Connect(context.Background(), profile.ID, Credentials{APIKey: apiKey}); err != nil {
		t.Fatalf("reconnect machine API: %v", err)
	}

	sealed, err := os.ReadFile(manager.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte(apiKey)) {
		t.Fatal("machine API key was persisted")
	}
}

func TestManagerRejectsWrongMachineAPICertificatePin(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key"
	endpoint, _ := newTestMachineAPI(t, apiKey)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	_, err = manager.Add(context.Background(), AddInput{
		APIKey:                    apiKey,
		APIURL:                    endpoint.origin,
		Port:                      endpoint.port,
		TLSCertificateFingerprint: "SHA256:" + strings.Repeat("0", 64),
	})
	if !errors.Is(err, ErrAgentAPIFingerprint) {
		t.Fatalf("wrong certificate pin error = %v", err)
	}
	if profiles := manager.List(); len(profiles) != 0 {
		t.Fatalf("untrusted machine API was persisted: %#v", profiles)
	}
}

func TestManagerReconnectsWithVerifiedReplacementMachineCertificatePin(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key"
	endpoint, fingerprint := newTestMachineAPI(t, apiKey)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		APIKey:                    apiKey,
		APIURL:                    endpoint.origin,
		Port:                      endpoint.port,
		TLSCertificateFingerprint: fingerprint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}
	stale := "SHA256:" + strings.Repeat("0", 64)
	manager.mu.Lock()
	stored := manager.profiles[profile.ID]
	stored.TLSCertificateFingerprint = stale
	manager.profiles[profile.ID] = stored
	err = manager.saveLocked()
	manager.mu.Unlock()
	if err != nil {
		t.Fatal(err)
	}
	reconnected, err := manager.Connect(context.Background(), profile.ID, Credentials{APIKey: apiKey, TLSCertificateFingerprint: strings.ToLower(fingerprint)})
	if err != nil {
		t.Fatalf("reconnect with verified replacement pin: %v", err)
	}
	if reconnected.TLSCertificateFingerprint != fingerprint {
		t.Fatalf("saved replacement fingerprint = %q, want %q", reconnected.TLSCertificateFingerprint, fingerprint)
	}
}

func TestManagerDoesNotSaveUnverifiedReplacementMachineCertificatePin(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key"
	endpoint, fingerprint := newTestMachineAPI(t, apiKey)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		APIKey:                    apiKey,
		APIURL:                    endpoint.origin,
		Port:                      endpoint.port,
		TLSCertificateFingerprint: fingerprint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := manager.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}
	_, err = manager.Connect(context.Background(), profile.ID, Credentials{APIKey: apiKey, TLSCertificateFingerprint: "SHA256:" + strings.Repeat("0", 64)})
	if !errors.Is(err, ErrAgentAPIFingerprint) {
		t.Fatalf("wrong replacement certificate pin error = %v", err)
	}
	profiles := manager.List()
	if len(profiles) != 1 || profiles[0].TLSCertificateFingerprint != fingerprint {
		t.Fatalf("unverified replacement pin was saved: %#v", profiles)
	}
}

func TestMachineAPIKeyRejectsWhitespace(t *testing.T) {
	t.Parallel()
	_, _, err := agentProfileFromInput(AddInput{
		APIKey:                    "valid-machine-key-with-space ",
		APIURL:                    "https://manager.example.com",
		Port:                      9180,
		TLSCertificateFingerprint: "SHA256:" + strings.Repeat("A", 64),
	})
	if err == nil {
		t.Fatal("machine API key containing whitespace was accepted")
	}
}

func TestManagerProbeMarksLegacyAgentAsUpdateRequired(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key"
	endpoint, fingerprint := newLegacyMachineAPI(t, apiKey)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		APIKey:                    apiKey,
		APIURL:                    endpoint.origin,
		Name:                      "legacy manager",
		Port:                      endpoint.port,
		TLSCertificateFingerprint: fingerprint,
	})
	if err != nil {
		t.Fatalf("add legacy machine API: %v", err)
	}
	profile, err = manager.Probe(context.Background(), profile.ID)
	if err == nil {
		t.Fatal("legacy agent diagnostics route was accepted")
	}
	if strings.Contains(err.Error(), "page not found") {
		t.Fatalf("legacy probe leaked remote response text: %v", err)
	}
	if profile.AgentHealth.State != domain.HealthDegraded || profile.AgentHealth.Summary != "Agent update required" || profile.DockerAvailable {
		t.Fatalf("legacy profile health = %#v", profile.AgentHealth)
	}
	if strings.Contains(profile.AgentHealth.Detail, "404") || !strings.Contains(profile.AgentHealth.Detail, "one-command installer") {
		t.Fatalf("legacy profile detail = %q", profile.AgentHealth.Detail)
	}
	connection, err := manager.Resolve(profile.ID)
	if err != nil {
		t.Fatal(err)
	}
	if connection.Docker != nil {
		t.Fatal("legacy machine API remained eligible for Docker operations")
	}
}

type machineAPIEndpoint struct {
	origin string
	port   uint16
}

func newTestMachineAPI(t *testing.T, apiKey string) (machineAPIEndpoint, string) {
	t.Helper()
	dockerBackend := httptest.NewServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
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
	t.Cleanup(dockerBackend.Close)
	docker, err := dockerapi.NewForURL(dockerBackend.URL, dockerBackend.Client())
	if err != nil {
		t.Fatal(err)
	}
	agentServer, err := agent.NewServer(agent.Config{Docker: docker, NodeName: "manager-1", RemoteControlEnabled: true, Version: "test"}, []byte(apiKey))
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewTLSServer(agentServer.Handler())
	t.Cleanup(server.Close)
	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(parsed.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(server.Certificate().Raw)
	return machineAPIEndpoint{origin: parsed.Scheme + "://" + parsed.Hostname(), port: uint16(port)}, "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:]))
}

func newLegacyMachineAPI(t *testing.T, apiKey string) (machineAPIEndpoint, string) {
	t.Helper()
	server := httptest.NewTLSServer(http.HandlerFunc(func(response http.ResponseWriter, request *http.Request) {
		if request.Header.Get("Authorization") != "Bearer "+apiKey {
			http.Error(response, "unauthorized", http.StatusUnauthorized)
			return
		}
		switch request.URL.Path {
		case "/v1/status":
			_ = json.NewEncoder(response).Encode(agent.Status{DockerAvailable: true, DockerVersion: "27.0.0", NodeName: "manager-1", RemoteControlEnabled: true, SwarmControlAvailable: true, SwarmState: "active", Version: "legacy"})
		case "/v1/engine/_ping":
			_, _ = response.Write([]byte("OK"))
		default:
			http.NotFound(response, request)
		}
	}))
	t.Cleanup(server.Close)
	parsed, err := url.Parse(server.URL)
	if err != nil {
		t.Fatal(err)
	}
	port, err := strconv.ParseUint(parsed.Port(), 10, 16)
	if err != nil {
		t.Fatal(err)
	}
	fingerprint := sha256.Sum256(server.Certificate().Raw)
	return machineAPIEndpoint{origin: parsed.Scheme + "://" + parsed.Hostname(), port: uint16(port)}, "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:]))
}
