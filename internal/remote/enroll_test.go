package remote

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strconv"
	"strings"
	"testing"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/enroll"
)

func TestEnrollConnectsFromOneTokenWithoutTheOperatorSeeingTheKey(t *testing.T) {
	t.Parallel()
	const apiKey = "test-machine-api-key-value"
	const secret = "one-time-enrollment-secret-value"
	endpoint, fingerprint := newEnrollableMachineAPI(t, apiKey, secret)
	token, err := enroll.Encode(enroll.Token{Fingerprint: fingerprint, Host: endpoint.host, Port: endpoint.port, Secret: secret})
	if err != nil {
		t.Fatalf("encode token: %v", err)
	}
	dataDir := t.TempDir()
	manager, err := NewManagerWithOptions(dataDir, testDataEncryptionKey(), ManagerOptions{RetainKeys: true})
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Enroll(context.Background(), token, "manager one")
	if err != nil {
		t.Fatalf("enroll: %v", err)
	}
	if profile.ConnectionType != ConnectionAgentAPI || profile.ConnectionState != connectedState || !profile.SwarmControlAvailable {
		t.Fatalf("profile = %#v", profile)
	}

	// The one-time secret is spent: the same token cannot enrol a second time.
	if _, err := manager.Enroll(context.Background(), token, "manager two"); err == nil {
		t.Fatal("a replayed enrollment token was accepted")
	}

	// The retained key is sealed, never stored beside the non-secret profile.
	sealedProfiles, err := os.ReadFile(manager.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealedProfiles, []byte(apiKey)) || bytes.Contains(sealedProfiles, []byte(secret)) {
		t.Fatal("credentials leaked into the server profile file")
	}
	sealedKeys, err := os.ReadFile(manager.keysPath)
	if err != nil {
		t.Fatalf("read sealed keys: %v", err)
	}
	if bytes.Contains(sealedKeys, []byte(apiKey)) {
		t.Fatal("the machine API key was written in the clear")
	}

	// A restarted controller reconnects on its own from the sealed key.
	restarted, err := NewManagerWithOptions(dataDir, testDataEncryptionKey(), ManagerOptions{RetainKeys: true})
	if err != nil {
		t.Fatal(err)
	}
	if failures := restarted.Resume(context.Background()); len(failures) != 0 {
		t.Fatalf("resume failures: %v", failures)
	}
	if _, err := restarted.Resolve(profile.ID); err != nil {
		t.Fatalf("resume did not reconnect the enrolled server: %v", err)
	}

	// Disconnecting is the operator withdrawing the credential entirely.
	if err := restarted.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}
	reloaded, err := NewManagerWithOptions(dataDir, testDataEncryptionKey(), ManagerOptions{RetainKeys: true})
	if err != nil {
		t.Fatal(err)
	}
	if failures := reloaded.Resume(context.Background()); len(failures) != 0 {
		t.Fatalf("resume after disconnect must be a no-op, got %v", failures)
	}
	if _, err := reloaded.Resolve(profile.ID); err == nil {
		t.Fatal("a disconnected server must not reconnect from a retained key")
	}
}

func TestEnrollRejectsATamperedFingerprint(t *testing.T) {
	t.Parallel()
	const secret = "one-time-enrollment-secret-value"
	endpoint, _ := newEnrollableMachineAPI(t, "test-machine-api-key-value", secret)
	token, err := enroll.Encode(enroll.Token{Fingerprint: "SHA256:" + strings.Repeat("0", 64), Host: endpoint.host, Port: endpoint.port, Secret: secret})
	if err != nil {
		t.Fatal(err)
	}
	manager, err := NewManagerWithOptions(t.TempDir(), testDataEncryptionKey(), ManagerOptions{RetainKeys: true})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Enroll(context.Background(), token, ""); err == nil {
		t.Fatal("an enrollment token with the wrong certificate pin was accepted")
	}
	if profiles := manager.List(); len(profiles) != 0 {
		t.Fatalf("a rejected enrollment was persisted: %#v", profiles)
	}
}

func TestEnrollRejectsMalformedTokens(t *testing.T) {
	t.Parallel()
	manager, err := NewManagerWithOptions(t.TempDir(), testDataEncryptionKey(), ManagerOptions{RetainKeys: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, value := range []string{"", "not-a-token", "swarmops1.zzzz"} {
		if _, err := manager.Enroll(context.Background(), value, ""); err == nil {
			t.Fatalf("token %q was accepted", value)
		}
	}
}

type enrollableEndpoint struct {
	host string
	port uint16
}

func newEnrollableMachineAPI(t *testing.T, apiKey, secret string) (enrollableEndpoint, string) {
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
	agentServer, err := agent.NewServer(agent.Config{
		Docker:               docker,
		EnrollmentSecret:     []byte(secret),
		NodeName:             "manager-1",
		RemoteControlEnabled: true,
		Version:              "test",
	}, []byte(apiKey))
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
	return enrollableEndpoint{host: parsed.Hostname(), port: uint16(port)}, "SHA256:" + strings.ToUpper(hex.EncodeToString(fingerprint[:]))
}
