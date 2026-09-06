// Package cli is the transport and state a workstation needs to drive SwarmOps
// from a terminal. It holds no policy: every call it makes is one the browser
// console already makes, and every refusal it reports is the controller's.
package cli

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ClusterID is the only cluster v1 addresses. The controller refuses a command
// whose header names anything else, so the constant lives here rather than
// being threaded through every command as a flag nobody may vary.
const ClusterID = "default"

const maxResponseBytes = 8 << 20

// Client is one authenticated conversation with a Core. The session cookie and
// CSRF token are carried explicitly rather than in a jar so that a profile
// written by an earlier `login` can be replayed by a later command.
type Client struct {
	base       *url.URL
	cookieName string
	csrf       string
	http       *http.Client
	serverID   string
	session    string
}

// Session is the part of a Client that survives between invocations. It is
// what the profile file stores; the password never is.
type Session struct {
	Cookie     string    `json:"cookie"`
	CookieName string    `json:"cookieName"`
	CSRF       string    `json:"csrf"`
	ExpiresAt  time.Time `json:"expiresAt"`
}

// Valid reports whether a stored session is still worth sending. The clock
// skew allowance is deliberately small: a stale cookie produces a clear 401
// from the controller, which is a better failure than a silent retry loop.
func (s Session) Valid(now time.Time) bool {
	return s.Cookie != "" && s.CSRF != "" && s.ExpiresAt.After(now)
}

// New dials a Core. An empty fingerprint uses the host trust store; a supplied
// one pins the exact leaf certificate and is the only trust root.
func New(baseURL, fingerprint string, timeout time.Duration) (*Client, error) {
	endpoint, err := ParseBaseURL(baseURL)
	if err != nil {
		return nil, err
	}
	httpClient, err := httpClientFor(endpoint, fingerprint, timeout)
	if err != nil {
		return nil, err
	}
	return &Client{base: endpoint, http: httpClient}, nil
}

// WithSession replays a stored session so a command can run without a prompt.
func (c *Client) WithSession(session Session) *Client {
	c.cookieName = session.CookieName
	c.csrf = session.CSRF
	c.session = session.Cookie
	return c
}

// WithServer selects the enrolled machine a queued command is addressed to.
func (c *Client) WithServer(serverID string) *Client {
	c.serverID = strings.TrimSpace(serverID)
	return c
}

// ServerID reports the machine commands are currently addressed to.
func (c *Client) ServerID() string { return c.serverID }

// BaseURL reports the Core this client talks to.
func (c *Client) BaseURL() string { return c.base.String() }

// Session returns the credential this client holds, so `login` can persist it.
func (c *Client) Session(ttl time.Duration) Session {
	return Session{Cookie: c.session, CookieName: c.cookieName, CSRF: c.csrf, ExpiresAt: time.Now().Add(ttl)}
}

// Login exchanges a password for a session. The password is used once and is
// never written anywhere by this package.
func (c *Client) Login(ctx context.Context, username, password string) error {
	payload, err := json.Marshal(map[string]string{"username": username, "password": password})
	if err != nil {
		return err
	}
	request, err := c.newRequest(ctx, http.MethodPost, "/api/v1/auth/login", bytes.NewReader(payload))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("log in to SwarmOps: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return ResponseError(response)
	}
	var body struct {
		CSRFToken string `json:"csrfToken"`
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&body); err != nil {
		return fmt.Errorf("decode login response: %w", err)
	}
	if body.CSRFToken == "" {
		return errors.New("login response did not include a request token")
	}
	c.csrf = body.CSRFToken
	for _, cookie := range response.Cookies() {
		if strings.HasPrefix(cookie.Name, "swarmops_") && cookie.Value != "" {
			c.cookieName = cookie.Name
			c.session = cookie.Value
		}
	}
	if c.session == "" {
		return errors.New("login response did not include a session cookie")
	}
	return nil
}

// Get reads a JSON document. A nil out discards the body.
func (c *Client) Get(ctx context.Context, path string, out any) error {
	request, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return err
	}
	return c.do(request, out)
}

// Post sends a JSON document to an endpoint that is not a queued command:
// planning, validation, and the read-shaped POSTs the console uses.
func (c *Client) Post(ctx context.Context, path string, body, out any) error {
	request, err := c.newJSONRequest(ctx, http.MethodPost, path, body)
	if err != nil {
		return err
	}
	return c.do(request, out)
}

// Text reads an endpoint that answers with plain text rather than JSON. Only
// a command's retained execution log does; it is the machine's own output and
// is served as-is rather than wrapped in a document.
func (c *Client) Text(ctx context.Context, path string) (string, error) {
	request, err := c.newRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	response, err := c.http.Do(request)
	if err != nil {
		return "", fmt.Errorf("GET %s: %w", path, err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return "", ResponseError(response)
	}
	body, err := io.ReadAll(io.LimitReader(response.Body, maxResponseBytes))
	if err != nil {
		return "", fmt.Errorf("read %s: %w", path, err)
	}
	return string(body), nil
}

// Delete removes a resource addressed by path.
func (c *Client) Delete(ctx context.Context, path string, out any) error {
	request, err := c.newRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	c.signCommand(request, "")
	return c.do(request, out)
}

// Put replaces a resource.
func (c *Client) Put(ctx context.Context, path string, body, out any) error {
	request, err := c.newJSONRequest(ctx, http.MethodPut, path, body)
	if err != nil {
		return err
	}
	return c.do(request, out)
}

func (c *Client) newJSONRequest(ctx context.Context, method, path string, body any) (*http.Request, error) {
	var reader io.Reader
	if body != nil {
		encoded, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		reader = bytes.NewReader(encoded)
	}
	request, err := c.newRequest(ctx, method, path, reader)
	if err != nil {
		return nil, err
	}
	if body != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	return request, nil
}

// newRequest resolves a path against the Core base URL and attaches the
// session. Callers pass controller paths, never absolute URLs, so a redirect
// or a hostile argument cannot retarget the session at another host.
func (c *Client) newRequest(ctx context.Context, method, path string, body io.Reader) (*http.Request, error) {
	if !strings.HasPrefix(path, "/") {
		return nil, fmt.Errorf("request path %q must be absolute", path)
	}
	target := c.base.ResolveReference(&url.URL{Path: strings.TrimSuffix(c.base.Path, "/") + path})
	if question := strings.Index(path, "?"); question >= 0 {
		target = c.base.ResolveReference(&url.URL{
			Path:     strings.TrimSuffix(c.base.Path, "/") + path[:question],
			RawQuery: path[question+1:],
		})
	}
	request, err := http.NewRequestWithContext(ctx, method, target.String(), body)
	if err != nil {
		return nil, fmt.Errorf("create %s request: %w", method, err)
	}
	if c.session != "" {
		name := c.cookieName
		if name == "" {
			name = "swarmops_session"
		}
		request.AddCookie(&http.Cookie{Name: name, Value: c.session})
	}
	if c.csrf != "" {
		request.Header.Set("X-CSRF-Token", c.csrf)
	}
	// Reads are addressed to a machine just as commands are: the controller
	// resolves every request against X-SwarmOps-Server-ID, so a GET without it
	// is refused with "Connect and select a server first" rather than being
	// answered from some default.
	request.Header.Set("X-SwarmOps-Cluster-ID", ClusterID)
	if c.serverID != "" {
		request.Header.Set("X-SwarmOps-Server-ID", c.serverID)
	}
	return request, nil
}

// signCommand adds what a command submission needs beyond the addressing
// headers every request already carries: the key that makes a retry safe.
func (c *Client) signCommand(request *http.Request, idempotencyKey string) {
	request.Header.Set("X-SwarmOps-Server-ID", c.serverID)
	if idempotencyKey != "" {
		request.Header.Set("Idempotency-Key", idempotencyKey)
	}
}

func (c *Client) do(request *http.Request, out any) error {
	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("%s %s: %w", request.Method, request.URL.Path, err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode > 299 {
		return ResponseError(response)
	}
	if out == nil || response.StatusCode == http.StatusNoContent {
		_, _ = io.Copy(io.Discard, io.LimitReader(response.Body, maxResponseBytes))
		return nil
	}
	if err := json.NewDecoder(io.LimitReader(response.Body, maxResponseBytes)).Decode(out); err != nil {
		return fmt.Errorf("decode %s response: %w", request.URL.Path, err)
	}
	return nil
}

// ParseBaseURL accepts only an absolute http or https Core URL.
func ParseBaseURL(value string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimRight(strings.TrimSpace(value), "/"))
	if err != nil || parsed.Scheme == "" || parsed.Host == "" || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return nil, errors.New("SwarmOps URL must be an http or https URL")
	}
	return parsed, nil
}

func httpClientFor(endpoint *url.URL, fingerprint string, timeout time.Duration) (*http.Client, error) {
	client := &http.Client{Timeout: timeout}
	fingerprint = strings.TrimSpace(fingerprint)
	if fingerprint == "" {
		return client, nil
	}
	if endpoint == nil || endpoint.Scheme != "https" || endpoint.Hostname() == "" {
		return nil, errors.New("a Core fingerprint requires an absolute HTTPS Core URL")
	}
	expected, err := ParseCoreFingerprint(fingerprint)
	if err != nil {
		return nil, err
	}
	client.Transport = &http.Transport{TLSClientConfig: &tls.Config{
		MinVersion:         tls.VersionTLS13,
		ServerName:         endpoint.Hostname(),
		InsecureSkipVerify: true, // the exact leaf pin below is the trust root
		VerifyConnection: func(state tls.ConnectionState) error {
			if len(state.PeerCertificates) == 0 {
				return errors.New("Core did not present a certificate")
			}
			actual := sha256.Sum256(state.PeerCertificates[0].Raw)
			if subtle.ConstantTimeCompare(actual[:], expected) != 1 {
				return errors.New("Core certificate fingerprint does not match the pinned identity")
			}
			return nil
		},
	}}
	return client, nil
}

// ParseCoreFingerprint accepts the SHA256:<64-hex> form the installer prints.
func ParseCoreFingerprint(value string) ([]byte, error) {
	value = strings.TrimSpace(value)
	const prefix = "SHA256:"
	if len(value) != len(prefix)+sha256.Size*2 || !strings.EqualFold(value[:len(prefix)], prefix) {
		return nil, errors.New("Core fingerprint must use SHA256:<64-hex>")
	}
	digest, err := hex.DecodeString(value[len(prefix):])
	if err != nil || len(digest) != sha256.Size {
		return nil, errors.New("Core fingerprint must use SHA256:<64-hex>")
	}
	return digest, nil
}

// IdempotencyKey names one submission attempt. The prefix records which
// command produced it, which is what makes a retried key legible in the audit
// ledger rather than an opaque hex string.
func IdempotencyKey(prefix string) (string, error) {
	buffer := make([]byte, 16)
	if _, err := rand.Read(buffer); err != nil {
		return "", fmt.Errorf("generate command idempotency key: %w", err)
	}
	return prefix + "-" + hex.EncodeToString(buffer), nil
}

// ResponseError turns a controller refusal into the message the controller
// wrote. Discarding it and printing the status code is what made failures
// unreportable before; the body is the only place the cause exists.
func ResponseError(response *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(response.Body, 32<<10))
	var payload struct {
		Error string `json:"error"`
	}
	if json.Unmarshal(body, &payload) == nil && payload.Error != "" {
		return fmt.Errorf("SwarmOps returned %s: %s", response.Status, payload.Error)
	}
	if trimmed := strings.TrimSpace(string(body)); trimmed != "" && len(trimmed) < 400 {
		return fmt.Errorf("SwarmOps returned %s: %s", response.Status, trimmed)
	}
	return fmt.Errorf("SwarmOps returned %s", response.Status)
}
