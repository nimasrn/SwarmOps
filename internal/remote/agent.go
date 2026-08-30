package remote

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentcontrol"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

var (
	ErrAgentAPIUnauthorized = errors.New("machine API key was rejected")
	ErrAgentAPIDisabled     = errors.New("machine API remote control is disabled")
	ErrAgentAPIFingerprint  = errors.New("machine API TLS certificate fingerprint mismatch")
	ErrAgentAPIIncompatible = errors.New("machine agent protocol is incompatible with this control plane")

	certificateFingerprintPattern = regexp.MustCompile(`^SHA256:[A-Fa-f0-9]{64}$`)
)

// AgentHTTPError retains only a response class and an optional allow-listed
// failure code. It deliberately does not retain response bodies, which belong
// to an untrusted remote process and may contain output that must never enter
// controller state or the browser.
type AgentHTTPError struct {
	FailureCode string
	StatusCode  int
}

func (err *AgentHTTPError) Error() string {
	if err == nil || err.StatusCode == 0 {
		return "machine API returned an unsuccessful response"
	}
	return fmt.Sprintf("machine API returned HTTP %d", err.StatusCode)
}

func (err *AgentHTTPError) SafeFailureCode() string {
	if err == nil || !agentcontrol.ValidCommandFailureCode(err.FailureCode) {
		return ""
	}
	return err.FailureCode
}

// AgentRunner is the controller-side adapter for the machine agent's fixed
// command API. It intentionally converts exact Docker CLI shapes to structured
// operations and cannot send an arbitrary executable or argument vector.
type AgentRunner struct{ client *agentClient }

func (r *AgentRunner) Status(ctx context.Context) (agent.Status, error) {
	if r == nil || r.client == nil {
		return agent.Status{}, fmt.Errorf("machine API client is not configured")
	}
	return r.client.Status(ctx)
}

// Snapshot returns the agent's bounded host inventory projection. It contains
// capacity and operating-system metadata only; no file, process, environment,
// package list, command output, or credential can cross this boundary.
func (r *AgentRunner) Snapshot(ctx context.Context) (agent.Snapshot, error) {
	if r == nil || r.client == nil {
		return agent.Snapshot{}, fmt.Errorf("machine API client is not configured")
	}
	var output agent.Snapshot
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/snapshot", nil, &output)
	return output, err
}

// Metrics returns one measurement sample of the host and every container on
// it. The document is typed and is sanitized by the caller before anything is
// rendered from it: an agent supplies numbers, never metric names.
func (r *AgentRunner) Metrics(ctx context.Context) (agentcontrol.MachineMetrics, error) {
	if r == nil || r.client == nil {
		return agentcontrol.MachineMetrics{}, fmt.Errorf("machine API client is not configured")
	}
	var output agentcontrol.MachineMetrics
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/metrics", nil, &output)
	return output, err
}

// SwarmJoinToken reads the credential a new node needs from this manager.
//
// The result is deliberately not cached and not returned by any /api route.
// The only caller is the command worker, which passes it straight to the
// joining machine and then drops it.
func (r *AgentRunner) SwarmJoinToken(ctx context.Context, role string) (agentcontrol.SwarmJoinToken, error) {
	if r == nil || r.client == nil {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("machine API client is not configured")
	}
	if !agentcontrol.ValidJoinRole(role) {
		return agentcontrol.SwarmJoinToken{}, fmt.Errorf("invalid Swarm join role")
	}
	var output agentcontrol.SwarmJoinToken
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/swarm/join-token?role="+url.QueryEscape(role), nil, &output)
	return output, err
}

func (r *AgentRunner) Diagnostics(ctx context.Context) (agent.Diagnostics, error) {
	if r == nil || r.client == nil {
		return agent.Diagnostics{}, fmt.Errorf("machine API client is not configured")
	}
	return r.client.Diagnostics(ctx)
}

func (r *AgentRunner) RequestUpdate(ctx context.Context) error {
	if r == nil || r.client == nil {
		return fmt.Errorf("machine API client is not configured")
	}
	return r.client.RequestUpdate(ctx)
}

func (r *AgentRunner) Run(ctx context.Context, name string, args ...string) (string, error) {
	request, err := agentcontrol.FromDockerCLI(name, args, nil)
	if err != nil {
		return "", err
	}
	return r.client.Command(ctx, request)
}

func (r *AgentRunner) RunInput(ctx context.Context, name string, input io.Reader, args ...string) (string, error) {
	if input == nil {
		return "", fmt.Errorf("agent command input is required")
	}
	data, err := io.ReadAll(io.LimitReader(input, agentcontrol.MaxComposeBytes+1))
	if err != nil {
		return "", fmt.Errorf("read agent command input: %w", err)
	}
	if len(data) > agentcontrol.MaxComposeBytes {
		return "", fmt.Errorf("agent command input exceeds %d bytes", agentcontrol.MaxComposeBytes)
	}
	request, err := agentcontrol.FromDockerCLI(name, args, data)
	if err != nil {
		return "", err
	}
	return r.client.Command(ctx, request)
}

func (r *AgentRunner) ReconcileRouting(ctx context.Context, input agentcontrol.RoutingReconcileRequest) error {
	return r.client.postTyped(ctx, "/v1/routing/reconcile", input, nil)
}

func (r *AgentRunner) PrepareRoutingNetwork(ctx context.Context, input agentcontrol.RoutingNetworkRequest) error {
	return r.client.postTyped(ctx, "/v1/routing/network", input, nil)
}

func (r *AgentRunner) BindRouting(ctx context.Context, input agentcontrol.RoutingBindingRequest) error {
	return r.client.postTyped(ctx, "/v1/routing/bind", input, nil)
}

func (r *AgentRunner) TraefikRuntime(ctx context.Context) (agentcontrol.TraefikRuntimeSnapshot, error) {
	var output agentcontrol.TraefikRuntimeSnapshot
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/traefik/runtime", nil, &output)
	return output, err
}

func (r *AgentRunner) TraefikLogs(ctx context.Context, input agentcontrol.TraefikLogQuery) ([]agentcontrol.TraefikLogEntry, error) {
	var output []agentcontrol.TraefikLogEntry
	err := r.client.postTyped(ctx, "/v1/traefik/logs", input, &output)
	return output, err
}

func (r *AgentRunner) Logs(ctx context.Context, input agentcontrol.LogQuery) (agentcontrol.LogPage, error) {
	var output agentcontrol.LogPage
	err := r.client.postTyped(ctx, "/v1/logs/query", input, &output)
	return output, err
}
func (r *AgentRunner) LogsStatus(ctx context.Context) (agentcontrol.LogStatus, error) {
	var output agentcontrol.LogStatus
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/logs/status", nil, &output)
	return output, err
}

func (r *AgentRunner) PrometheusTraefik(ctx context.Context) (agentcontrol.PrometheusSnapshot, error) {
	var output agentcontrol.PrometheusSnapshot
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/traefik/prometheus", nil, &output)
	return output, err
}

// ProvisioningStatus and Provision are the only host-bootstrap operations the
// controller can request. They are typed, authenticated calls to the pinned
// machine agent; AgentRunner still cannot carry an executable, shell, or file
// path selected by a browser request.
func (r *AgentRunner) ProvisioningStatus(ctx context.Context) (agentcontrol.ProvisioningStatus, error) {
	var output agentcontrol.ProvisioningStatus
	err := r.client.requestJSON(ctx, http.MethodGet, "/v1/provisioning/status", nil, &output)
	return output, err
}

func (r *AgentRunner) Provision(ctx context.Context, input agentcontrol.ProvisioningRequest) error {
	if err := input.Validate(); err != nil {
		return err
	}
	return r.client.postTyped(ctx, "/v1/provisioning", input, nil)
}

func (r *AgentRunner) Close() {
	if r != nil && r.client != nil {
		r.client.Close()
	}
}

type agentClient struct {
	baseURL  string
	http     *http.Client
	longHTTP *http.Client
	key      []byte
}

func agentProfileFromInput(input AddInput) (domain.Server, Credentials, error) {
	apiURL, host, err := normalizedAgentURL(input.APIURL)
	if err != nil {
		return domain.Server{}, Credentials{}, err
	}
	profile := domain.Server{
		APIURL:                    apiURL,
		Authentication:            AuthenticationAPIKey,
		ConnectionState:           disconnectedState,
		ConnectionType:            ConnectionAgentAPI,
		Host:                      host,
		ID:                        newID(),
		Name:                      strings.TrimSpace(input.Name),
		Port:                      input.Port,
		TLSCertificateFingerprint: normalizeCertificateFingerprint(input.TLSCertificateFingerprint),
	}
	if profile.Name == "" {
		profile.Name = profile.Host
	}
	credentials := Credentials{APIKey: input.APIKey, Authentication: AuthenticationAPIKey}
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

func validateAgentProfile(profile domain.Server) error {
	if strings.TrimSpace(profile.ID) == "" || len(profile.ID) > 64 {
		return fmt.Errorf("invalid server identifier")
	}
	if len(profile.Name) == 0 || len(profile.Name) > 96 || strings.ContainsAny(profile.Name, "\r\n\x00") {
		return fmt.Errorf("server name must be between 1 and 96 characters")
	}
	if profile.Authentication != AuthenticationAPIKey {
		return fmt.Errorf("machine API authentication must use api_key")
	}
	if profile.Port == 0 {
		return fmt.Errorf("machine API port is required")
	}
	apiURL, host, err := normalizedAgentURL(profile.APIURL)
	if err != nil || apiURL != profile.APIURL || host != profile.Host {
		return fmt.Errorf("invalid machine API URL")
	}
	parsed, _ := url.Parse(profile.APIURL)
	if parsed.Scheme == "https" && !certificateFingerprintPattern.MatchString(profile.TLSCertificateFingerprint) {
		return fmt.Errorf("machine API TLS certificate fingerprint must use SHA256:<64-hex>")
	}
	if parsed.Scheme == "http" {
		if !loopbackHost(host) {
			return fmt.Errorf("machine API must use HTTPS outside loopback")
		}
		if profile.TLSCertificateFingerprint != "" {
			return fmt.Errorf("loopback HTTP machine API cannot have a TLS fingerprint")
		}
	}
	return nil
}

func establishAgentAPI(ctx context.Context, profile domain.Server, credentials Credentials) (*Connection, domain.Server, error) {
	if err := validateCredentials(credentials); err != nil {
		return nil, domain.Server{}, err
	}
	client, err := newAgentClient(profile, credentials.APIKey)
	if err != nil {
		return nil, domain.Server{}, err
	}
	probeContext, cancel := context.WithTimeout(ctx, 12*time.Second)
	defer cancel()
	status, err := client.Status(probeContext)
	if err != nil {
		client.Close()
		return nil, domain.Server{}, err
	}
	if !status.RemoteControlEnabled {
		client.Close()
		return nil, domain.Server{}, ErrAgentAPIDisabled
	}

	profile = profileFromAgentStatus(profile, status, time.Now().UTC())
	profile.LastConnectedAt = time.Now().UTC()
	connection := &Connection{Profile: profile, Runner: &AgentRunner{client: client}}
	if !status.DockerAvailable {
		return connection, profile, nil
	}
	docker, err := dockerapi.NewForURLWithBuildClient(client.baseURL+"/v1/engine", client.http, client.longHTTP)
	if err != nil {
		client.Close()
		return nil, domain.Server{}, err
	}
	if err := docker.Ping(probeContext); err != nil {
		docker.CloseIdleConnections()
		client.Close()
		if isAgentRouteMissing(err) {
			return nil, domain.Server{}, ErrAgentAPIIncompatible
		}
		return nil, domain.Server{}, ErrDockerUnavailable
	}
	connection.Docker = docker
	return connection, profile, nil
}

func newAgentClient(profile domain.Server, key string) (*agentClient, error) {
	if err := validateAgentProfile(profile); err != nil {
		return nil, err
	}
	if len(key) < 16 {
		return nil, fmt.Errorf("machine API key is required")
	}
	parsed, err := url.Parse(profile.APIURL)
	if err != nil {
		return nil, fmt.Errorf("parse machine API URL: %w", err)
	}
	baseURL := parsed.Scheme + "://" + net.JoinHostPort(parsed.Hostname(), fmt.Sprint(profile.Port))
	transport := &http.Transport{IdleConnTimeout: 30 * time.Second, Proxy: http.ProxyFromEnvironment}
	if parsed.Scheme == "https" {
		expected := strings.TrimPrefix(profile.TLSCertificateFingerprint, "SHA256:")
		tlsConfig := &tls.Config{
			// Certificate verification below pins the exact leaf certificate. The
			// normal CA/hostname path is intentionally replaced, not bypassed.
			InsecureSkipVerify: true, // #nosec G402 -- VerifyConnection pins the peer certificate.
			MinVersion:         tls.VersionTLS13,
			ServerName:         parsed.Hostname(),
			VerifyConnection: func(state tls.ConnectionState) error {
				if len(state.PeerCertificates) == 0 {
					return ErrAgentAPIFingerprint
				}
				actual := sha256.Sum256(state.PeerCertificates[0].Raw)
				if subtle.ConstantTimeCompare([]byte(strings.ToUpper(hex.EncodeToString(actual[:]))), []byte(expected)) != 1 {
					return ErrAgentAPIFingerprint
				}
				return nil
			},
		}
		transport.TLSClientConfig = tlsConfig
	}
	keyBytes := []byte(key)
	authTransport := &agentAuthTransport{base: transport, key: keyBytes}
	return &agentClient{
		baseURL:  baseURL,
		http:     &http.Client{Transport: authTransport, Timeout: 20 * time.Second},
		longHTTP: &http.Client{Transport: authTransport},
		key:      keyBytes,
	}, nil
}

func newPullConnection(profile domain.Server, transport http.RoundTripper) (*Connection, error) {
	if transport == nil {
		return nil, fmt.Errorf("outbound agent transport is required")
	}
	client := &agentClient{
		baseURL:  "http://agent.pull",
		http:     &http.Client{Transport: transport, Timeout: 20 * time.Second},
		longHTTP: &http.Client{Transport: transport},
		// This is used only by the local request builder. Authorization is not
		// included in pull envelopes; the agent supplies its protected local API
		// token before dispatching through its own reviewed handler.
		key: []byte("outbound-agent-transport"),
	}
	connection := &Connection{Profile: profile, Runner: &AgentRunner{client: client}}
	if !profile.DockerAvailable {
		return connection, nil
	}
	docker, err := dockerapi.NewForURLWithBuildClient(client.baseURL+"/v1/engine", client.http, client.longHTTP)
	if err != nil {
		client.Close()
		return nil, err
	}
	connection.Docker = docker
	return connection, nil
}

// agentAuthTransport supplies the key to the constrained Engine facade too;
// dockerapi.Client uses its own HTTP request builder and therefore cannot add
// this header itself. It does not alter the destination or any request path.
type agentAuthTransport struct {
	base http.RoundTripper
	key  []byte
}

func (t *agentAuthTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if t == nil || t.base == nil || len(t.key) == 0 {
		return nil, fmt.Errorf("machine API transport is not configured")
	}
	copy := request.Clone(request.Context())
	copy.Header = request.Header.Clone()
	copy.Header.Set("Authorization", "Bearer "+string(t.key))
	return t.base.RoundTrip(copy)
}

func (t *agentAuthTransport) CloseIdleConnections() {
	if closer, ok := t.base.(interface{ CloseIdleConnections() }); ok {
		closer.CloseIdleConnections()
	}
}

func (c *agentClient) Status(ctx context.Context) (agent.Status, error) {
	var value agent.Status
	if err := c.requestJSON(ctx, http.MethodGet, "/v1/status", nil, &value); err != nil {
		return agent.Status{}, err
	}
	return value, nil
}

func (c *agentClient) Diagnostics(ctx context.Context) (agent.Diagnostics, error) {
	var value agent.Diagnostics
	if err := c.requestJSON(ctx, http.MethodGet, "/v1/diagnostics", nil, &value); err != nil {
		return agent.Diagnostics{}, err
	}
	return value, nil
}

func (c *agentClient) RequestUpdate(ctx context.Context) error {
	response, err := c.request(ctx, http.MethodPost, "/v1/agent/update", nil)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return ErrAgentAPIUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return &AgentHTTPError{StatusCode: response.StatusCode}
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 32<<10))
	return nil
}

func (c *agentClient) Command(ctx context.Context, input agentcontrol.Request) (string, error) {
	body, err := json.Marshal(input)
	if err != nil {
		return "", fmt.Errorf("encode machine command: %w", err)
	}
	response, err := c.requestWithClient(ctx, c.longHTTP, http.MethodPost, "/v1/commands", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return "", ErrAgentAPIUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return "", commandHTTPError(response)
	}
	var output agentcontrol.CommandResponse
	if err := json.NewDecoder(io.LimitReader(response.Body, 256<<10)).Decode(&output); err != nil {
		return "", fmt.Errorf("decode machine command response: %w", err)
	}
	return output.Output, nil
}

func commandHTTPError(response *http.Response) error {
	result := &AgentHTTPError{StatusCode: response.StatusCode}
	var payload agentcontrol.CommandResponse
	if json.NewDecoder(io.LimitReader(response.Body, 4<<10)).Decode(&payload) == nil && agentcontrol.ValidCommandFailureCode(payload.FailureCode) {
		result.FailureCode = payload.FailureCode
	}
	return result
}

func (c *agentClient) postTyped(ctx context.Context, endpoint string, input, output any) error {
	body, err := json.Marshal(input)
	if err != nil {
		return fmt.Errorf("encode typed machine request: %w", err)
	}
	response, err := c.requestWithClient(ctx, c.longHTTP, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return ErrAgentAPIUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return &AgentHTTPError{StatusCode: response.StatusCode}
	}
	if output == nil {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, 32<<10))
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 2<<20)).Decode(output); err != nil {
		return fmt.Errorf("decode typed machine response: %w", err)
	}
	return nil
}

func (c *agentClient) requestJSON(ctx context.Context, method, endpoint string, body io.Reader, output any) error {
	response, err := c.request(ctx, method, endpoint, body)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusUnauthorized {
		return ErrAgentAPIUnauthorized
	}
	if response.StatusCode != http.StatusOK {
		return &AgentHTTPError{StatusCode: response.StatusCode}
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(output); err != nil {
		return fmt.Errorf("decode machine API response: %w", err)
	}
	return nil
}

func (c *agentClient) request(ctx context.Context, method, endpoint string, body io.Reader) (*http.Response, error) {
	if c == nil || c.http == nil || len(c.key) == 0 {
		return nil, fmt.Errorf("machine API client is not configured")
	}
	return c.requestWithClient(ctx, c.http, method, endpoint, body)
}

func (c *agentClient) requestWithClient(ctx context.Context, client *http.Client, method, endpoint string, body io.Reader) (*http.Response, error) {
	if c == nil || client == nil || len(c.key) == 0 {
		return nil, fmt.Errorf("machine API client is not configured")
	}
	request, err := http.NewRequestWithContext(ctx, method, c.baseURL+endpoint, body)
	if err != nil {
		return nil, fmt.Errorf("create machine API request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+string(c.key))
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	response, err := client.Do(request)
	if err != nil {
		if errors.Is(err, ErrAgentAPIFingerprint) || strings.Contains(err.Error(), ErrAgentAPIFingerprint.Error()) {
			return nil, ErrAgentAPIFingerprint
		}
		return nil, fmt.Errorf("connect to machine API: %w", err)
	}
	return response, nil
}

func (c *agentClient) Close() {
	if c == nil {
		return
	}
	for index := range c.key {
		c.key[index] = 0
	}
	if c.http != nil {
		c.http.CloseIdleConnections()
	}
	if c.longHTTP != nil && c.longHTTP != c.http {
		c.longHTTP.CloseIdleConnections()
	}
}

func normalizedAgentURL(value string) (string, string, error) {
	parsed, err := url.Parse(strings.TrimSpace(value))
	if err != nil || parsed.Scheme == "" || parsed.Hostname() == "" {
		return "", "", fmt.Errorf("machine API URL must be an absolute HTTP(S) origin")
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return "", "", fmt.Errorf("machine API URL must use HTTP or HTTPS")
	}
	if parsed.User != nil || parsed.Port() != "" || (parsed.Path != "" && parsed.Path != "/") || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", "", fmt.Errorf("machine API URL must not include credentials, a port, path, query, or fragment")
	}
	host := strings.Trim(parsed.Hostname(), "[]")
	if !validHost(host) {
		return "", "", fmt.Errorf("invalid machine API host")
	}
	return parsed.Scheme + "://" + parsed.Host, host, nil
}

func normalizeCertificateFingerprint(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToUpper(value), "SHA256:") {
		return "SHA256:" + strings.ToUpper(strings.TrimSpace(value[len("SHA256:"):]))
	}
	return value
}

func loopbackHost(host string) bool {
	if host == "localhost" {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err == nil && ip.IsLoopback()
}
