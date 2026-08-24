package remote

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
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
