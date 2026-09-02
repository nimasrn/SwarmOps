package remote

import (
	"bufio"
	"bytes"
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agentpull"
	"golang.org/x/crypto/ssh"
)

type unavailableRoundTripper struct{}

func (unavailableRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, errors.New("agent is offline")
}

func TestManagerMarksStaleOutboundAgentDisconnectedUntilNextPoll(t *testing.T) {
	t.Parallel()
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	status := agentpull.Status{DockerAvailable: true, NodeName: "manager-1", RemoteControlEnabled: true, SwarmControlAvailable: true, SwarmState: "active", Version: "test"}
	profile, err := manager.AttachPull("agent-1", "manager-1", status, unavailableRoundTripper{})
	if err != nil {
		t.Fatal(err)
	}
	if listed := manager.List(); len(listed) != 1 || listed[0].ConnectionState != connectedState {
		t.Fatalf("fresh outbound list = %#v", listed)
	}
	if health, err := manager.AgentDiagnostics(context.Background(), profile.ID); err != nil || health.Summary != "Outbound agent is connected" {
		t.Fatalf("fresh outbound diagnostics = %#v, err=%v", health, err)
	}

	manager.mu.Lock()
	profile = manager.profiles[profile.ID]
	profile.LastConnectedAt = time.Now().UTC().Add(-agentPullStaleAfter - time.Second)
	manager.profiles[profile.ID] = profile
	manager.mu.Unlock()
	if listed := manager.List(); len(listed) != 1 || listed[0].ConnectionState != disconnectedState || listed[0].AgentHealth.Summary != "Outbound agent has stopped polling" {
		t.Fatalf("stale outbound list = %#v", listed)
	}
	if _, err := manager.Resolve(profile.ID); err == nil {
		t.Fatal("stale outbound agent resolved")
	}
	if health, err := manager.AgentDiagnostics(context.Background(), profile.ID); err == nil || health.Summary != "Outbound agent has stopped polling" {
		t.Fatalf("stale outbound diagnostics = %#v, err=%v", health, err)
	}

	if _, err := manager.AttachPull("agent-1", "manager-1", status, unavailableRoundTripper{}); err != nil {
		t.Fatal(err)
	}
	if listed := manager.List(); len(listed) != 1 || listed[0].ConnectionState != connectedState {
		t.Fatalf("reconnected outbound list = %#v", listed)
	}
}

func TestManagerKeepsOutboundAgentConnectedAfterCoreCatalogRejection(t *testing.T) {
	t.Parallel()
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	status := agentpull.Status{DockerAvailable: true, NodeName: "manager-1", RemoteControlEnabled: true, SwarmControlAvailable: true, SwarmState: "active", Version: "test"}
	profile, err := manager.AttachPull("agent-1", "manager-1", status, unavailableRoundTripper{})
	if err != nil {
		t.Fatal(err)
	}
	catalogErr := fmt.Errorf("connect to machine API: %w", agentpull.ErrRequestNotCatalogued)
	if err := manager.ObserveFailure(profile.ID, catalogErr); err != nil {
		t.Fatal(err)
	}
	listed := manager.List()
	if len(listed) != 1 || listed[0].ConnectionState != connectedState || listed[0].AgentHealth.State != "healthy" {
		t.Fatalf("catalog rejection changed live agent health = %#v", listed)
	}
}

func TestManagerConnectsThroughPinnedSSHWithoutPersistingCredentials(t *testing.T) {
	t.Parallel()
	server := newTestSSHServer(t)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		Authentication:     AuthenticationPassword,
		Host:               server.host,
		HostKeyFingerprint: server.fingerprint,
		Name:               "manager one",
		Password:           "test-password",
		Port:               server.port,
		Username:           "operator",
	})
	if err != nil {
		t.Fatalf("add remote server: %v", err)
	}
	if profile.ConnectionState != connectedState || !profile.DockerAvailable || profile.DockerVersion != "27.0.0" || !profile.SwarmControlAvailable || profile.SwarmState != "active" {
		t.Fatalf("profile = %#v", profile)
	}
	if got := manager.List(); len(got) != 1 || got[0].ConnectionState != connectedState {
		t.Fatalf("list = %#v", got)
	}
	connection, err := manager.Resolve(profile.ID)
	if err != nil {
		t.Fatal(err)
	}
	if err := connection.Docker.Ping(context.Background()); err != nil {
		t.Fatalf("remote Docker ping: %v", err)
	}
	if err := manager.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Resolve(profile.ID); err == nil {
		t.Fatal("disconnected server resolved")
	}
	if _, err := manager.Connect(context.Background(), profile.ID, Credentials{Authentication: AuthenticationPassword, Password: "test-password"}); err != nil {
		t.Fatalf("reconnect remote server: %v", err)
	}
	if _, err := manager.Resolve(profile.ID); err != nil {
		t.Fatalf("reconnected server did not resolve: %v", err)
	}
	if err := manager.Disconnect(profile.ID); err != nil {
		t.Fatal(err)
	}

	profileData, err := os.ReadFile(manager.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(profileData, []byte("test-password")) || bytes.Contains(profileData, []byte("privateKey")) {
		t.Fatalf("credentials were persisted: %s", profileData)
	}
	info, err := os.Stat(manager.path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("server profile permissions = %o, want 600", got)
	}
	reloaded, err := NewManager(filepath.Dir(manager.path), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	if got := reloaded.List(); len(got) != 1 || got[0].ConnectionState != disconnectedState {
		t.Fatalf("reloaded profiles = %#v", got)
	}
}

func TestManagerConnectsToFreshHostWithoutDocker(t *testing.T) {
	t.Parallel()
	server := newTestSSHServerWithoutDocker(t)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		Authentication:     AuthenticationPassword,
		Host:               server.host,
		HostKeyFingerprint: server.fingerprint,
		Name:               "fresh ubuntu",
		Password:           "test-password",
		Port:               server.port,
		Username:           "operator",
	})
	if err != nil {
		t.Fatalf("add fresh host: %v", err)
	}
	if profile.ConnectionState != connectedState || profile.DockerAvailable || profile.DockerVersion != "" || profile.SwarmControlAvailable || profile.SwarmState != "" {
		t.Fatalf("fresh-host profile = %#v", profile)
	}
	connection, err := manager.Resolve(profile.ID)
	if err != nil {
		t.Fatalf("resolve fresh host: %v", err)
	}
	if connection.Docker != nil || connection.Runner == nil {
		t.Fatalf("fresh-host connection = %#v", connection)
	}
}

func TestManagerLoadsDockerStateFromProfilesWrittenBeforeDockerAvailable(t *testing.T) {
	t.Parallel()
	dataDir := t.TempDir()
	legacy := map[string]any{
		"version": 1,
		"servers": []map[string]any{{
			"authentication":        AuthenticationPassword,
			"connectionState":       connectedState,
			"dockerVersion":         "27.0.0",
			"host":                  "127.0.0.1",
			"hostKeyFingerprint":    "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
			"id":                    "server-legacy",
			"name":                  "legacy manager",
			"port":                  22,
			"swarmControlAvailable": true,
			"swarmState":            "active",
			"username":              "operator",
		}},
	}
	data, err := json.Marshal(legacy)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dataDir, "servers.json"), data, 0o600); err != nil {
		t.Fatal(err)
	}
	manager, err := NewManager(dataDir, testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profiles := manager.List()
	if len(profiles) != 1 || !profiles[0].DockerAvailable || profiles[0].ConnectionState != disconnectedState {
		t.Fatalf("loaded profiles = %#v", profiles)
	}
	if _, err := os.Stat(filepath.Join(dataDir, "servers.json")); !os.IsNotExist(err) {
		t.Fatalf("legacy plaintext server profiles remain after migration: %v", err)
	}
	sealed, err := os.ReadFile(manager.path)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(sealed, []byte("legacy manager")) {
		t.Fatal("sealed server state contains plaintext profile data")
	}
}

func TestManagerRejectsUnpinnedSSHHost(t *testing.T) {
	t.Parallel()
	server := newTestSSHServer(t)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := manager.Add(context.Background(), AddInput{
		Authentication:     AuthenticationPassword,
		Host:               server.host,
		HostKeyFingerprint: "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
		Password:           "test-password",
		Port:               server.port,
		Username:           "operator",
	}); err == nil {
		t.Fatal("untrusted SSH host was accepted")
	} else if !strings.Contains(err.Error(), "SSH host key fingerprint mismatch") {
		t.Fatalf("untrusted SSH host error = %q, want fingerprint mismatch", err)
	} else if _, detail, ok := ConnectionErrorDetails(err); !ok || !strings.Contains(detail, "SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA") || !strings.Contains(detail, server.fingerprint) {
		t.Fatalf("host key diagnostic = (%q, %t), want expected and presented fingerprints", detail, ok)
	}
	if got := manager.List(); len(got) != 0 {
		t.Fatalf("untrusted profile was persisted: %#v", got)
	}
}

func TestConnectionErrorDetails(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		errorText  string
		message    string
		wantDetail string
	}{
		{name: "host key", errorText: "remote Docker Engine is unavailable: SSH host key fingerprint mismatch", message: "SSH host key fingerprint mismatch", wantDetail: "Recompute"},
		{name: "private key", errorText: "SSH private key could not be used", message: "SSH private key could not be used", wantDetail: "OpenSSH or PEM"},
		{name: "network", errorText: "connect to SSH server: secret=do-not-return", message: "Could not reach the SSH service", wantDetail: "firewall"},
		{name: "authentication", errorText: "authenticate SSH connection: ssh: handshake failed", message: "SSH authentication failed", wantDetail: "authorized key"},
		{name: "docker", errorText: "remote Docker Engine is unavailable", message: "Remote Docker Engine is unavailable", wantDetail: "Docker is running"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			message, detail, ok := ConnectionErrorDetails(errors.New(test.errorText))
			if !ok || message != test.message || !strings.Contains(detail, test.wantDetail) {
				t.Fatalf("ConnectionErrorDetails() = (%q, %q, %t)", message, detail, ok)
			}
			if strings.Contains(detail, "do-not-return") {
				t.Fatalf("detail leaked raw error: %q", detail)
			}
		})
	}
	if _, _, ok := ConnectionErrorDetails(errors.New("unexpected remote failure")); ok {
		t.Fatal("unknown error was treated as safe diagnostic")
	}
}

func TestConnectionErrorDetailsKeepsUnknownHostKeyDataPrivate(t *testing.T) {
	t.Parallel()
	message, detail, ok := ConnectionErrorDetails(&HostKeyMismatchError{Actual: "unexpected-secret", Expected: "also-unexpected"})
	if !ok || message != "SSH host key fingerprint mismatch" {
		t.Fatalf("ConnectionErrorDetails() = (%q, %q, %t)", message, detail, ok)
	}
	if strings.Contains(detail, "unexpected-secret") || strings.Contains(detail, "also-unexpected") {
		t.Fatalf("detail leaked malformed host-key data: %q", detail)
	}
}

func TestManagerAcceptsPrivateKeyAuthentication(t *testing.T) {
	t.Parallel()
	server := newTestSSHServer(t)
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	profile, err := manager.Add(context.Background(), AddInput{
		Authentication:     AuthenticationPrivateKey,
		Host:               server.host,
		HostKeyFingerprint: server.fingerprint,
		PrivateKey:         server.privateKeyPEM,
		Port:               server.port,
		Username:           "operator",
	})
	if err != nil {
		t.Fatalf("add key-auth server: %v", err)
	}
	if profile.Authentication != AuthenticationPrivateKey || profile.ConnectionState != connectedState {
		t.Fatalf("profile = %#v", profile)
	}
}

func TestDockerCommandQuotesEveryArgument(t *testing.T) {
	t.Parallel()
	command, err := dockerCommand([]string{"service", "scale", "app='name=2"})
	if err != nil {
		t.Fatal(err)
	}
	if got, want := command, "docker 'service' 'scale' 'app='\"'\"'name=2'"; got != want {
		t.Fatalf("command = %q, want %q", got, want)
	}
	if _, err := dockerCommand([]string{"service\nlogs"}); err == nil {
		t.Fatal("newline argument was accepted")
	}
}

type testSSHServer struct {
	dockerAvailable bool
	fingerprint     string
	host            string
	listener        net.Listener
	port            uint16
	privateKeyPEM   string
	publicKey       ssh.PublicKey
	password        string
}

func newTestSSHServer(t *testing.T) *testSSHServer {
	return newTestSSHServerWithDocker(t, true)
}

func newTestSSHServerWithoutDocker(t *testing.T) *testSSHServer {
	return newTestSSHServerWithDocker(t, false)
}

func newTestSSHServerWithDocker(t *testing.T, dockerAvailable bool) *testSSHServer {
	t.Helper()
	_, hostPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	hostSigner, err := ssh.NewSignerFromKey(hostPrivate)
	if err != nil {
		t.Fatal(err)
	}
	_, userPrivate, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	userSigner, err := ssh.NewSignerFromKey(userPrivate)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(userPrivate)
	if err != nil {
		t.Fatal(err)
	}
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := listener.Addr().(*net.TCPAddr)
	server := &testSSHServer{
		dockerAvailable: dockerAvailable,
		fingerprint:     ssh.FingerprintSHA256(hostSigner.PublicKey()),
		host:            "127.0.0.1",
		listener:        listener,
		port:            uint16(address.Port),
		privateKeyPEM:   string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})),
		publicKey:       userSigner.PublicKey(),
		password:        "test-password",
	}
	config := &ssh.ServerConfig{
		PasswordCallback: func(metadata ssh.ConnMetadata, password []byte) (*ssh.Permissions, error) {
			if metadata.User() == "operator" && string(password) == server.password {
				return nil, nil
			}
			return nil, fmt.Errorf("invalid credentials")
		},
		PublicKeyCallback: func(metadata ssh.ConnMetadata, key ssh.PublicKey) (*ssh.Permissions, error) {
			if metadata.User() == "operator" && bytes.Equal(key.Marshal(), server.publicKey.Marshal()) {
				return nil, nil
			}
			return nil, fmt.Errorf("invalid key")
		},
	}
	config.AddHostKey(hostSigner)
	go server.serve(config)
	t.Cleanup(func() { _ = listener.Close() })
	return server
}

func (s *testSSHServer) serve(config *ssh.ServerConfig) {
	for {
		connection, err := s.listener.Accept()
		if err != nil {
			return
		}
		go func() {
			serverConnection, channels, requests, err := ssh.NewServerConn(connection, config)
			if err != nil {
				_ = connection.Close()
				return
			}
			defer serverConnection.Close()
			go ssh.DiscardRequests(requests)
			for channelRequest := range channels {
				if channelRequest.ChannelType() != "session" {
					_ = channelRequest.Reject(ssh.UnknownChannelType, "session required")
					continue
				}
				channel, requests, err := channelRequest.Accept()
				if err != nil {
					continue
				}
				go s.handleSession(channel, requests)
			}
		}()
	}
}

func (s *testSSHServer) handleSession(channel ssh.Channel, requests <-chan *ssh.Request) {
	defer channel.Close()
	for request := range requests {
		if request.Type != "exec" {
			_ = request.Reply(false, nil)
			continue
		}
		var payload struct{ Command string }
		if err := ssh.Unmarshal(request.Payload, &payload); err != nil || payload.Command != "docker system dial-stdio" || !s.dockerAvailable {
			_ = request.Reply(false, nil)
			return
		}
		_ = request.Reply(true, nil)
		serveDocker(channel)
		return
	}
}

func serveDocker(channel ssh.Channel) {
	reader := bufio.NewReader(channel)
	for {
		request, err := http.ReadRequest(reader)
		if err != nil {
			return
		}
		_ = request.Body.Close()
		var body string
		switch request.URL.Path {
		case "/_ping":
			body = "OK"
		case "/version":
			body = `{"Version":"27.0.0"}`
		case "/info":
			body = `{"Swarm":{"ControlAvailable":true,"LocalNodeState":"active"}}`
		default:
			body = `{"message":"not found"}`
		}
		status := "200 OK"
		if request.URL.Path != "/_ping" && request.URL.Path != "/version" && request.URL.Path != "/info" {
			status = "404 Not Found"
		}
		_, _ = fmt.Fprintf(channel, "HTTP/1.1 %s\r\nContent-Type: application/json\r\nContent-Length: %d\r\n\r\n%s", status, len(body), body)
	}
}

func testDataEncryptionKey() []byte {
	return bytes.Repeat([]byte{17}, 32)
}

func TestAttachPullCarriesNativeUpdaterStateAndKeepsCoreRequestedAt(t *testing.T) {
	t.Parallel()
	manager, err := NewManager(t.TempDir(), testDataEncryptionKey())
	if err != nil {
		t.Fatal(err)
	}
	checkedAt := time.Now().UTC().Add(-time.Hour).Truncate(time.Second)
	status := agentpull.Status{
		DockerAvailable:      true,
		NodeName:             "manager-1",
		RemoteControlEnabled: true,
		Update:               agentpull.UpdateStatus{Automatic: true, CheckedAt: checkedAt, State: "up_to_date", Version: "v0.12.0"},
		Version:              "v0.12.0",
	}
	profile, err := manager.AttachPull("agent-1", "manager-1", status, unavailableRoundTripper{})
	if err != nil {
		t.Fatal(err)
	}
	if !profile.AgentHealth.Update.Automatic || profile.AgentHealth.Update.State != "up_to_date" || !profile.AgentHealth.Update.CheckedAt.Equal(checkedAt) {
		t.Fatalf("attached outbound update = %#v", profile.AgentHealth.Update)
	}

	requestedAt := time.Now().UTC().Truncate(time.Second)
	manager.mu.Lock()
	stored := manager.profiles[profile.ID]
	stored.AgentHealth.Update.RequestedAt = requestedAt
	manager.profiles[profile.ID] = stored
	manager.mu.Unlock()

	refreshed, err := manager.AttachPull("agent-1", "manager-1", status, unavailableRoundTripper{})
	if err != nil {
		t.Fatal(err)
	}
	if !refreshed.AgentHealth.Update.RequestedAt.Equal(requestedAt) {
		t.Fatalf("re-attach dropped Core-owned RequestedAt = %#v", refreshed.AgentHealth.Update)
	}
	if !refreshed.AgentHealth.Update.Automatic {
		t.Fatalf("re-attach dropped automatic updates = %#v", refreshed.AgentHealth.Update)
	}
}
