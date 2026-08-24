// Package remote owns the credential-safe machine-API boundary for remote
// Docker servers. It stores only non-secret target metadata on disk; API keys
// live in process memory until disconnect or restart and are never returned to
// callers. It retains the legacy SSH transport only to reconnect pre-existing
// saved profiles during migration.
package remote

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/ops"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"golang.org/x/crypto/ssh"
)

const (
	AuthenticationAPIKey     = "api_key"
	AuthenticationPassword   = "password"
	AuthenticationPrivateKey = "private_key"
	ConnectionAgentAPI       = "agent_api"
	ConnectionSSH            = "ssh"

	connectedState    = "connected"
	disconnectedState = "disconnected"
	profileStateKey   = "server-profiles"
)

var (
	// ErrDockerUnavailable distinguishes a connected bootstrap candidate from a
	// remote Engine that is ready for Docker or Swarm operations.
	ErrDockerUnavailable = errors.New("remote Docker Engine is unavailable")

	hostnamePattern    = regexp.MustCompile(`^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$`)
	usernamePattern    = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_.-]{0,63}$`)
	fingerprintPattern = regexp.MustCompile(`^SHA256:[A-Za-z0-9+/]{43}$`)
)

// HostKeyMismatchError carries only public SSH host-key fingerprints. Its
// Error value stays generic so protected logs do not need to record either
// fingerprint; ConnectionErrorDetails exposes the comparison to the operator.
type HostKeyMismatchError struct {
	Actual   string
	Expected string
}

func (err *HostKeyMismatchError) Error() string {
	return "SSH host key fingerprint mismatch"
}

// ConnectionErrorDetails returns a safe, actionable explanation for known
// connection failures. It intentionally never returns the raw error because a
// remote service may include sensitive or unreviewed text in that value.
func ConnectionErrorDetails(err error) (message, detail string, ok bool) {
	if err == nil {
		return "", "", false
	}
	if errors.Is(err, ErrAgentAPIFingerprint) {
		return "Machine API certificate fingerprint mismatch", "Verify the SHA256 TLS certificate fingerprint from the machine's trusted console, then update this saved profile only after the endpoint and port are confirmed.", true
	}
	if errors.Is(err, ErrAgentAPIUnauthorized) {
		return "Machine API key was rejected", "Verify the API key configured on the machine. The key is never saved in the controller profile or audit trail.", true
	}
	if errors.Is(err, ErrAgentAPIDisabled) {
		return "Machine API remote control is disabled", "Install or reconfigure the machine agent with SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED=true and TLS before reconnecting.", true
	}
	var mismatch *HostKeyMismatchError
	if errors.As(err, &mismatch) && fingerprintPattern.MatchString(mismatch.Actual) && fingerprintPattern.MatchString(mismatch.Expected) {
		detail := fmt.Sprintf(
			"This profile expects %s, but the SSH service presented %s. Verify the SSH host and port, then update the saved fingerprint only after confirming the presented value from a trusted server console.",
			mismatch.Expected,
			mismatch.Actual,
		)
		return "SSH host key fingerprint mismatch", detail, true
	}
	value := err.Error()
	switch {
	case strings.Contains(value, "SSH host key fingerprint mismatch"):
		return "SSH host key fingerprint mismatch", "The remote server presented a different host key. Recompute its SHA256 host-key fingerprint on the server and update this profile.", true
	case strings.Contains(value, "SSH private key could not be used"):
		return "SSH private key could not be used", "Paste a complete OpenSSH or PEM private key, and provide a passphrase only when the key is encrypted.", true
	case strings.Contains(value, "connect to SSH server"):
		return "Could not reach the SSH service", "Check the server address, SSH port, routing, firewall, and that SSH is listening on the remote host.", true
	case strings.Contains(value, "authenticate SSH connection"):
		return "SSH authentication failed", "The remote SSH service rejected the supplied credential. Verify the SSH username, authorized key or password, and key passphrase.", true
	case strings.Contains(value, "start remote Docker tunnel") || strings.Contains(value, "open SSH Docker"):
		return "Remote Docker tunnel could not be started", "SSH connected, but the remote account could not start docker system dial-stdio. Verify that Docker is installed, running, and accessible to that SSH user.", true
	case strings.Contains(value, "remote Docker Engine is unavailable") || strings.Contains(value, "read remote Docker"):
		return "Remote Docker Engine is unavailable", "SSH connected, but SwarmOps could not reach Docker on the remote host. Verify Docker is running and the SSH user can access it.", true
	case strings.Contains(value, "connect to machine API"):
		return "Could not reach the machine API", "Check the machine API URL, port, TLS listener, routing, and firewall. The agent requires HTTPS outside loopback.", true
	case strings.Contains(value, "machine API Docker Engine is unavailable"):
		return "Machine Docker Engine is unavailable", "The machine agent authenticated but could not reach its local Docker Engine. Verify Docker is running and the agent service can access its socket.", true
	default:
		return "", "", false
	}
}

// Credentials is accepted only for a connect operation. It must not be
// persisted, logged, or added to an audit-event detail map.
type Credentials struct {
	APIKey             string
	Authentication     string
	Password           string
	PrivateKey         string
	PrivateKeyPassword string
}

// AddInput combines the non-secret server profile with a one-time credential
// used to establish the connection. Machine API certificates are pinned to
// avoid silently trusting an intercepted endpoint.
type AddInput struct {
	APIKey                    string
	APIURL                    string
	Authentication            string
	Host                      string
	HostKeyFingerprint        string
	Name                      string
	Password                  string
	Port                      uint16
	PrivateKey                string
	PrivateKeyPassword        string
	TLSCertificateFingerprint string
	Username                  string
}

// Connection holds a verified remote target. Docker is populated only when
// the machine API reports an Engine is reachable; the runner remains fixed to
// reviewed Docker operations and never exposes a shell or file-read method.
type Connection struct {
	Docker  *dockerapi.Client
	Profile domain.Server
	Runner  ops.Runner
}

func (c *Connection) close() {
	if c == nil {
		return
	}
	if c.Docker != nil {
		c.Docker.CloseIdleConnections()
	}
	if closer, ok := c.Runner.(interface{ Close() }); ok {
		closer.Close()
	}
}

type profileFile struct {
	Servers []domain.Server `json:"servers"`
	Version int             `json:"version"`
}

// Manager persists safe target metadata and holds active authentication
// material only in memory. It is safe for concurrent HTTP requests.
type Manager struct {
	connections map[string]*Connection
	legacyPath  string
	path        string
	profiles    map[string]domain.Server
	store       *securestore.Sealer
	mu          sync.RWMutex
}

func NewManager(dataDir string, dataEncryptionKey []byte) (*Manager, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("server profile data directory is required")
	}
	store, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure encrypted server profiles: %w", err)
	}
	manager := &Manager{
		connections: map[string]*Connection{},
		legacyPath:  filepath.Join(dataDir, "servers.json"),
		path:        filepath.Join(dataDir, "servers.sealed"),
		profiles:    map[string]domain.Server{},
		store:       store,
	}
	data, err := manager.store.ReadFile(manager.path, profileStateKey)
	if errors.Is(err, os.ErrNotExist) {
		if err := manager.loadLegacyProfiles(); err != nil {
			return nil, err
		}
		return manager, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read server profiles: %w", err)
	}
	if _, err := os.Stat(manager.legacyPath); err == nil {
		return nil, fmt.Errorf("legacy plaintext server profiles remain; remove %s only after verifying the encrypted migration", manager.legacyPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("check legacy server profiles: %w", err)
	}
	if err := manager.loadProfiles(data); err != nil {
		return nil, err
	}
	return manager, nil
}

func (m *Manager) loadLegacyProfiles() error {
	data, err := os.ReadFile(m.legacyPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read legacy server profiles: %w", err)
	}
	if err := m.loadProfiles(data); err != nil {
		return err
	}
	if err := m.saveLocked(); err != nil {
		return fmt.Errorf("seal legacy server profiles: %w", err)
	}
	if err := securestore.RemoveFile(m.legacyPath); err != nil {
		return fmt.Errorf("remove migrated plaintext server profiles: %w", err)
	}
	return nil
}

func (m *Manager) loadProfiles(data []byte) error {
	var saved profileFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return fmt.Errorf("read server profiles: %w", err)
	}
	if saved.Version != 1 {
		return fmt.Errorf("unsupported server profile version")
	}
	for _, profile := range saved.Servers {
		if err := validateProfile(profile); err != nil {
			return fmt.Errorf("read server profiles: %w", err)
		}
		// dockerAvailable was added after the first persisted-profile format.
		// Preserve the last observed Engine state for existing profiles, while
		// leaving genuinely fresh legacy SSH-only hosts as bootstrap candidates.
		if !profile.DockerAvailable && (profile.DockerVersion != "" || profile.SwarmControlAvailable || profile.SwarmState != "") {
			profile.DockerAvailable = true
		}
		profile.ConnectionState = disconnectedState
		m.profiles[profile.ID] = profile
	}
	return nil
}

func (m *Manager) List() []domain.Server {
	m.mu.RLock()
	defer m.mu.RUnlock()
	profiles := make([]domain.Server, 0, len(m.profiles))
	for id, profile := range m.profiles {
		if connection := m.connections[id]; connection != nil {
			profile.ConnectionState = connectedState
		} else {
			profile.ConnectionState = disconnectedState
		}
		profiles = append(profiles, profile)
	}
	sort.Slice(profiles, func(left, right int) bool {
		if profiles[left].Name == profiles[right].Name {
			return profiles[left].ID < profiles[right].ID
		}
		return profiles[left].Name < profiles[right].Name
	})
	return profiles
}

func (m *Manager) Add(ctx context.Context, input AddInput) (domain.Server, error) {
	profile, credentials, err := profileFromInput(input)
	if err != nil {
		return domain.Server{}, err
	}
	connection, profile, err := establish(ctx, profile, credentials)
	scrubCredentials(&credentials)
	if err != nil {
		return domain.Server{}, err
	}

	m.mu.Lock()
	defer m.mu.Unlock()
	m.profiles[profile.ID] = profile
	m.connections[profile.ID] = connection
	if err := m.saveLocked(); err != nil {
		delete(m.profiles, profile.ID)
		delete(m.connections, profile.ID)
		connection.close()
		return domain.Server{}, err
	}
	return profile, nil
}

// Connect rehydrates a saved non-secret profile. The credential is checked
// against the profile's declared authentication method, then held only while
// the process remains alive.
func (m *Manager) Connect(ctx context.Context, id string, credentials Credentials) (domain.Server, error) {
	m.mu.RLock()
	profile, found := m.profiles[id]
	m.mu.RUnlock()
	if !found {
		return domain.Server{}, fmt.Errorf("server not found")
	}
	credentials.Authentication = strings.TrimSpace(credentials.Authentication)
	if credentials.Authentication == "" {
		credentials.Authentication = profile.Authentication
	}
	if credentials.Authentication != profile.Authentication {
		scrubCredentials(&credentials)
		return domain.Server{}, fmt.Errorf("authentication method does not match this server")
	}
	connection, profile, err := establish(ctx, profile, credentials)
	scrubCredentials(&credentials)
	if err != nil {
		return domain.Server{}, err
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	previousProfile, found := m.profiles[id]
	if !found {
		connection.close()
		return domain.Server{}, fmt.Errorf("server not found")
	}
	previousConnection := m.connections[id]
	m.profiles[id] = profile
	m.connections[id] = connection
	if err := m.saveLocked(); err != nil {
		m.profiles[id] = previousProfile
		if previousConnection == nil {
			delete(m.connections, id)
		} else {
			m.connections[id] = previousConnection
		}
		connection.close()
		return domain.Server{}, err
	}
	if previousConnection != nil {
		previousConnection.close()
	}
	return profile, nil
}

func (m *Manager) Disconnect(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, found := m.profiles[id]; !found {
		return fmt.Errorf("server not found")
	}
	if connection := m.connections[id]; connection != nil {
		connection.close()
	}
	delete(m.connections, id)
	return nil
}

func (m *Manager) Remove(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, found := m.profiles[id]
	if !found {
		return fmt.Errorf("server not found")
	}
	connection := m.connections[id]
	delete(m.profiles, id)
	delete(m.connections, id)
	if err := m.saveLocked(); err != nil {
		m.profiles[id] = profile
		if connection != nil {
			m.connections[id] = connection
		}
		return err
	}
	if connection != nil {
		connection.close()
	}
	return nil
}

// Resolve returns a currently connected server. Callers cannot retrieve its
// connection key or legacy SSH credential; they receive only constrained
// operation interfaces.
func (m *Manager) Resolve(id string) (*Connection, error) {
	if strings.TrimSpace(id) == "" {
		return nil, fmt.Errorf("select a connected server")
	}
	m.mu.RLock()
	connection := m.connections[id]
	m.mu.RUnlock()
	if connection == nil {
		return nil, fmt.Errorf("server is not connected; reconnect with its machine API key")
	}
	return connection, nil
}

func (m *Manager) saveLocked() error {
	profiles := make([]domain.Server, 0, len(m.profiles))
	for _, profile := range m.profiles {
		profile.ConnectionState = ""
		profiles = append(profiles, profile)
	}
	sort.Slice(profiles, func(left, right int) bool { return profiles[left].ID < profiles[right].ID })
	data, err := json.MarshalIndent(profileFile{Servers: profiles, Version: 1}, "", "  ")
	if err != nil {
		return fmt.Errorf("encode server profiles: %w", err)
	}
	if err := m.store.WriteFile(m.path, profileStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save server profiles: %w", err)
	}
	return nil
}

func profileFromInput(input AddInput) (domain.Server, Credentials, error) {
	if strings.TrimSpace(input.APIURL) != "" || strings.TrimSpace(input.APIKey) != "" || strings.TrimSpace(input.TLSCertificateFingerprint) != "" {
		return agentProfileFromInput(input)
	}
	profile := domain.Server{
		Authentication:     strings.TrimSpace(input.Authentication),
		ConnectionState:    disconnectedState,
		Host:               normalizeHost(input.Host),
		HostKeyFingerprint: strings.TrimSpace(input.HostKeyFingerprint),
		ID:                 newID(),
		Name:               strings.TrimSpace(input.Name),
		Port:               input.Port,
		Username:           strings.TrimSpace(input.Username),
	}
	if profile.Name == "" {
		profile.Name = profile.Host
	}
	credentials := Credentials{
		Authentication:     profile.Authentication,
		Password:           input.Password,
		PrivateKey:         input.PrivateKey,
		PrivateKeyPassword: input.PrivateKeyPassword,
	}
	if err := validateProfile(profile); err != nil {
		scrubCredentials(&credentials)
		return domain.Server{}, Credentials{}, err
	}
	if err := validateCredentials(credentials); err != nil {
		scrubCredentials(&credentials)
		return domain.Server{}, Credentials{}, err
	}
	return profile, credentials, nil
}

func validateProfile(profile domain.Server) error {
	if profile.ConnectionType == ConnectionAgentAPI {
		return validateAgentProfile(profile)
	}
	if profile.ConnectionType != "" && profile.ConnectionType != ConnectionSSH {
		return fmt.Errorf("invalid server connection type")
	}
	if strings.TrimSpace(profile.ID) == "" || len(profile.ID) > 64 {
		return fmt.Errorf("invalid server identifier")
	}
	if len(profile.Name) == 0 || len(profile.Name) > 96 || strings.ContainsAny(profile.Name, "\r\n\x00") {
		return fmt.Errorf("server name must be between 1 and 96 characters")
	}
	if profile.Port == 0 {
		return fmt.Errorf("SSH port is required")
	}
	if !validHost(profile.Host) {
		return fmt.Errorf("invalid SSH host")
	}
	if !usernamePattern.MatchString(profile.Username) {
		return fmt.Errorf("invalid SSH username")
	}
	if !fingerprintPattern.MatchString(profile.HostKeyFingerprint) {
		return fmt.Errorf("SSH host key fingerprint must use the SHA256: format")
	}
	if profile.Authentication != AuthenticationPassword && profile.Authentication != AuthenticationPrivateKey {
		return fmt.Errorf("authentication must be api_key, password, or private_key")
	}
	return nil
}

func validateCredentials(credentials Credentials) error {
	switch credentials.Authentication {
	case AuthenticationAPIKey:
		if len(credentials.APIKey) < 16 || len(credentials.APIKey) > 4096 || strings.ContainsAny(credentials.APIKey, " \t\r\n\x00") {
			return fmt.Errorf("machine API key must contain between 16 and 4096 bytes")
		}
	case AuthenticationPassword:
		if len(credentials.Password) == 0 || len(credentials.Password) > 4096 {
			return fmt.Errorf("SSH password is required")
		}
	case AuthenticationPrivateKey:
		if len(credentials.PrivateKey) == 0 || len(credentials.PrivateKey) > 256<<10 {
			return fmt.Errorf("SSH private key is required")
		}
		if len(credentials.PrivateKeyPassword) > 4096 {
			return fmt.Errorf("SSH private-key passphrase is too long")
		}
	default:
		return fmt.Errorf("authentication must be api_key, password, or private_key")
	}
	return nil
}

func establish(ctx context.Context, profile domain.Server, credentials Credentials) (*Connection, domain.Server, error) {
	if profile.ConnectionType == ConnectionAgentAPI {
		return establishAgentAPI(ctx, profile, credentials)
	}
	connector, err := newConnector(profile, credentials)
	if err != nil {
		return nil, domain.Server{}, err
	}
	probeContext, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()

	// A new Ubuntu host is a valid SwarmOps target even before Docker exists.
	// Verify the pinned SSH transport independently so Docker readiness can be a
	// bootstrap state rather than a failed server registration.
	sshClient, err := connector.connect(probeContext)
	if err != nil {
		return nil, domain.Server{}, err
	}
	if err := sshClient.Close(); err != nil {
		return nil, domain.Server{}, fmt.Errorf("close SSH verification connection: %w", err)
	}

	profile.ConnectionState = connectedState
	profile.LastConnectedAt = time.Now().UTC()
	profile.DockerAvailable = false
	profile.DockerVersion = ""
	profile.SwarmControlAvailable = false
	profile.SwarmState = ""
	connection := &Connection{Profile: profile, Runner: SSHRunner{connector: connector}}

	docker, err := dockerapi.NewWithDial(connector.DialContext)
	if err != nil {
		return nil, domain.Server{}, err
	}
	if err := docker.Ping(probeContext); err != nil {
		docker.CloseIdleConnections()
		return connection, profile, nil
	}
	profile.DockerAvailable = true
	connection.Profile = profile
	version, err := docker.Version(probeContext)
	if err != nil {
		docker.CloseIdleConnections()
		return connection, profile, nil
	}
	info, err := docker.Info(probeContext)
	if err != nil {
		docker.CloseIdleConnections()
		return connection, profile, nil
	}
	profile.DockerVersion = version.Version
	profile.SwarmControlAvailable = info.Swarm.ControlAvailable
	profile.SwarmState = info.Swarm.LocalNodeState
	connection.Docker = docker
	connection.Profile = profile
	return connection, profile, nil
}

func newID() string {
	bytes := make([]byte, 12)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("server-%d", time.Now().UnixNano())
	}
	return "server-" + hex.EncodeToString(bytes)
}

func normalizeHost(value string) string {
	value = strings.TrimSpace(value)
	return strings.Trim(value, "[]")
}

func validHost(host string) bool {
	if host == "" || len(host) > 253 || strings.ContainsAny(host, "\r\n\t /\\@\x00") {
		return false
	}
	return net.ParseIP(host) != nil || hostnamePattern.MatchString(host)
}

func scrubCredentials(credentials *Credentials) {
	if credentials == nil {
		return
	}
	credentials.APIKey = ""
	credentials.Password = ""
	credentials.PrivateKey = ""
	credentials.PrivateKeyPassword = ""
}

// Connector turns a pinned SSH session into Docker's standard stdio tunnel.
// Docker provides this fixed helper specifically to proxy its local Engine API;
// no Docker daemon, socket, or Docker CLI runs on the SwarmOps host.
type Connector struct {
	address string
	config  *ssh.ClientConfig
}

func newConnector(profile domain.Server, credentials Credentials) (*Connector, error) {
	if err := validateCredentials(credentials); err != nil {
		return nil, err
	}
	fingerprint := profile.HostKeyFingerprint
	callback := func(_ string, _ net.Addr, key ssh.PublicKey) error {
		actual := ssh.FingerprintSHA256(key)
		if subtle.ConstantTimeCompare([]byte(actual), []byte(fingerprint)) != 1 {
			return &HostKeyMismatchError{Actual: actual, Expected: fingerprint}
		}
		return nil
	}
	var auth ssh.AuthMethod
	switch credentials.Authentication {
	case AuthenticationPassword:
		auth = ssh.Password(credentials.Password)
	case AuthenticationPrivateKey:
		privateKey := []byte(credentials.PrivateKey)
		defer zero(privateKey)
		var signer ssh.Signer
		var err error
		if credentials.PrivateKeyPassword == "" {
			signer, err = ssh.ParsePrivateKey(privateKey)
		} else {
			passphrase := []byte(credentials.PrivateKeyPassword)
			signer, err = ssh.ParsePrivateKeyWithPassphrase(privateKey, passphrase)
			zero(passphrase)
		}
		if err != nil {
			return nil, fmt.Errorf("SSH private key could not be used")
		}
		auth = ssh.PublicKeys(signer)
	default:
		return nil, fmt.Errorf("authentication must be password or private_key")
	}
	return &Connector{
		address: net.JoinHostPort(profile.Host, fmt.Sprint(profile.Port)),
		config: &ssh.ClientConfig{
			Auth:            []ssh.AuthMethod{auth},
			HostKeyCallback: callback,
			User:            profile.Username,
		},
	}, nil
}

func (c *Connector) connect(ctx context.Context) (*ssh.Client, error) {
	if c == nil || c.config == nil {
		return nil, fmt.Errorf("SSH connector is not configured")
	}
	dialer := net.Dialer{Timeout: 10 * time.Second}
	tcp, err := dialer.DialContext(ctx, "tcp", c.address)
	if err != nil {
		return nil, fmt.Errorf("connect to SSH server: %w", err)
	}
	if err := tcp.SetDeadline(time.Now().Add(10 * time.Second)); err != nil {
		_ = tcp.Close()
		return nil, fmt.Errorf("set SSH handshake deadline: %w", err)
	}
	connection, channels, requests, err := ssh.NewClientConn(tcp, c.address, c.config)
	_ = tcp.SetDeadline(time.Time{})
	if err != nil {
		_ = tcp.Close()
		return nil, fmt.Errorf("authenticate SSH connection: %w", err)
	}
	return ssh.NewClient(connection, channels, requests), nil
}

// DialContext is supplied to the Docker API HTTP transport. One HTTP stream is
// sent through a fixed `docker system dial-stdio` SSH command on the selected
// server; the local host never needs a Docker daemon or Unix socket.
func (c *Connector) DialContext(ctx context.Context, _, _ string) (net.Conn, error) {
	client, err := c.connect(ctx)
	if err != nil {
		return nil, err
	}
	session, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return nil, fmt.Errorf("open SSH Docker session: %w", err)
	}
	input, err := session.StdinPipe()
	if err != nil {
		_ = session.Close()
		_ = client.Close()
		return nil, fmt.Errorf("open SSH Docker input: %w", err)
	}
	output, err := session.StdoutPipe()
	if err != nil {
		_ = input.Close()
		_ = session.Close()
		_ = client.Close()
		return nil, fmt.Errorf("open SSH Docker output: %w", err)
	}
	session.Stderr = io.Discard
	if err := session.Start("docker system dial-stdio"); err != nil {
		_ = input.Close()
		_ = session.Close()
		_ = client.Close()
		return nil, fmt.Errorf("start remote Docker tunnel: %w", err)
	}
	return &dockerStream{client: client, input: input, output: output, session: session}, nil
}

type dockerStream struct {
	client  *ssh.Client
	input   io.WriteCloser
	once    sync.Once
	output  io.Reader
	session *ssh.Session
}

func (s *dockerStream) Read(value []byte) (int, error)   { return s.output.Read(value) }
func (s *dockerStream) Write(value []byte) (int, error)  { return s.input.Write(value) }
func (s *dockerStream) LocalAddr() net.Addr              { return streamAddress("ssh-docker-local") }
func (s *dockerStream) RemoteAddr() net.Addr             { return streamAddress("ssh-docker-remote") }
func (s *dockerStream) SetDeadline(time.Time) error      { return nil }
func (s *dockerStream) SetReadDeadline(time.Time) error  { return nil }
func (s *dockerStream) SetWriteDeadline(time.Time) error { return nil }

func (s *dockerStream) Close() error {
	var closeErr error
	s.once.Do(func() {
		if s.input != nil {
			closeErr = s.input.Close()
		}
		if s.session != nil {
			if err := s.session.Close(); closeErr == nil {
				closeErr = err
			}
		}
		if s.client != nil {
			if err := s.client.Close(); closeErr == nil {
				closeErr = err
			}
		}
	})
	return closeErr
}

type streamAddress string

func (address streamAddress) Network() string { return "ssh" }
func (address streamAddress) String() string  { return string(address) }

// SSHRunner permits the same fixed Docker CLI operations that the local
// compatibility path permits. Arguments are quoted individually and the
// executable is fixed to `docker`, so user input cannot become a remote shell
// command. It also implements ops.InputRunner for reviewed Compose stdin.
type SSHRunner struct{ connector *Connector }

func (r SSHRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	return r.run(ctx, name, nil, args...)
}

func (r SSHRunner) RunInput(ctx context.Context, name string, input io.Reader, args ...string) (string, error) {
	return r.run(ctx, name, input, args...)
}

func (r SSHRunner) run(ctx context.Context, name string, input io.Reader, args ...string) (string, error) {
	if name != "docker" {
		return "", fmt.Errorf("remote runner only permits Docker commands")
	}
	command, err := dockerCommand(args)
	if err != nil {
		return "", err
	}
	client, err := r.connector.connect(ctx)
	if err != nil {
		return "", err
	}
	defer client.Close()
	session, err := client.NewSession()
	if err != nil {
		return "", fmt.Errorf("open SSH command session: %w", err)
	}
	defer session.Close()
	buffer := &commandBuffer{limit: 256 << 10}
	session.Stdout = buffer
	session.Stderr = buffer
	if input != nil {
		session.Stdin = input
	}
	done := make(chan error, 1)
	go func() { done <- session.Run(command) }()
	select {
	case err := <-done:
		if buffer.exceeded() {
			return buffer.String(), ops.ErrOutputLimit
		}
		if err != nil {
			return buffer.String(), fmt.Errorf("run remote Docker command: %w", err)
		}
		return buffer.String(), nil
	case <-ctx.Done():
		_ = session.Close()
		<-done
		return buffer.String(), ctx.Err()
	}
}

func dockerCommand(args []string) (string, error) {
	if len(args) == 0 {
		return "", fmt.Errorf("Docker command is required")
	}
	parts := make([]string, 0, len(args)+1)
	parts = append(parts, "docker")
	for _, argument := range args {
		if strings.ContainsAny(argument, "\x00\r\n") {
			return "", fmt.Errorf("invalid Docker command argument")
		}
		parts = append(parts, shellQuote(argument))
	}
	return strings.Join(parts, " "), nil
}

func shellQuote(value string) string {
	return "'" + strings.ReplaceAll(value, "'", "'\"'\"'") + "'"
}

type commandBuffer struct {
	buffer       strings.Builder
	exceededFlag bool
	limit        int
	mu           sync.Mutex
}

func (b *commandBuffer) Write(value []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	remaining := b.limit - b.buffer.Len()
	if remaining <= 0 {
		b.exceededFlag = true
		return 0, io.ErrShortWrite
	}
	if len(value) > remaining {
		b.buffer.Write(value[:remaining])
		b.exceededFlag = true
		return remaining, io.ErrShortWrite
	}
	return b.buffer.Write(value)
}

func (b *commandBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buffer.String()
}

func (b *commandBuffer) exceeded() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.exceededFlag
}

func zero(value []byte) {
	for index := range value {
		value[index] = 0
	}
}
