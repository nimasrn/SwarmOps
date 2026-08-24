package dockerapi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
)

const responseLimit = 8 << 20

// Client speaks the Docker Engine HTTP API over a caller-supplied transport.
// It supports a local Unix socket, the pinned machine-agent facade, legacy SSH
// streams, and test HTTP servers without leaking transport concerns into the
// control-plane domain.
type Client struct {
	baseURL   string
	http      *http.Client
	buildHTTP *http.Client
}

// DialContext matches http.Transport.DialContext. Keeping this small contract
// lets SwarmOps talk to a remote Docker Engine without requiring a Docker
// daemon or socket on the machine running the API.
type DialContext func(ctx context.Context, network, address string) (net.Conn, error)

func New(socket string) (*Client, error) {
	socket = strings.TrimPrefix(strings.TrimSpace(socket), "unix://")
	if !strings.HasPrefix(socket, "/") {
		return nil, fmt.Errorf("Docker socket must be an absolute Unix path")
	}
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	return NewWithDial(func(ctx context.Context, _, _ string) (net.Conn, error) {
		return dialer.DialContext(ctx, "unix", socket)
	})
}

// NewWithDial creates a client using a private Docker API transport. The
// target must be trusted: the Engine API is root-equivalent on its host.
func NewWithDial(dial DialContext) (*Client, error) {
	if dial == nil {
		return nil, fmt.Errorf("Docker dialer is required")
	}
	transport := &http.Transport{DialContext: dial, DisableCompression: true, IdleConnTimeout: 30 * time.Second}
	return &Client{
		baseURL: "http://docker",
		http:    &http.Client{Transport: transport, Timeout: 20 * time.Second},
		// Build streams may legitimately run for minutes. Their deadline is
		// controlled by build.Service through the request context, rather than a
		// short client-wide timeout intended for inventory calls.
		buildHTTP: &http.Client{Transport: transport},
	}, nil
}

func NewForURL(baseURL string, client *http.Client) (*Client, error) {
	return NewForURLWithBuildClient(baseURL, client, client)
}

// NewForURLWithBuildClient creates a Docker client backed by HTTP clients
// supplied by a trusted caller. Keeping the inventory and build clients
// separate lets a remote transport retain short request deadlines for status
// calls while allowing build streams to use their context-controlled timeout.
func NewForURLWithBuildClient(baseURL string, client, buildClient *http.Client) (*Client, error) {
	if client == nil {
		return nil, fmt.Errorf("http client is required")
	}
	if buildClient == nil {
		return nil, fmt.Errorf("Docker build HTTP client is required")
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid Docker API URL")
	}
	return &Client{baseURL: strings.TrimSuffix(baseURL, "/"), http: client, buildHTTP: buildClient}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	response, err := c.request(ctx, http.MethodGet, "/_ping", nil, nil)
	if err != nil {
		return err
	}
	return response.Body.Close()
}

// CloseIdleConnections releases any retained transport streams. Machine-agent
// and legacy SSH clients use this when an operator disconnects a server so
// credentials are no longer kept alive by an idle Docker API request.
func (c *Client) CloseIdleConnections() {
	if c == nil {
		return
	}
	if c.http != nil {
		c.http.CloseIdleConnections()
	}
	if c.buildHTTP != nil && c.buildHTTP != c.http {
		c.buildHTTP.CloseIdleConnections()
	}
}

func (c *Client) Info(ctx context.Context) (Info, error) {
	var output Info
	if err := c.getJSON(ctx, "/info", &output); err != nil {
		return Info{}, err
	}
	return output, nil
}

func (c *Client) Version(ctx context.Context) (Version, error) {
	var output Version
	if err := c.getJSON(ctx, "/version", &output); err != nil {
		return Version{}, err
	}
	return output, nil
}

func (c *Client) ListNodes(ctx context.Context) ([]Node, error) {
	var output []Node
	if err := c.getJSON(ctx, "/nodes", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) ListServices(ctx context.Context) ([]Service, error) {
	var output []Service
	if err := c.getJSON(ctx, "/services", &output); err != nil {
		return nil, err
	}
	return output, nil
}

func (c *Client) ListTasks(ctx context.Context, filters map[string][]string) ([]Task, error) {
	query := url.Values{}
	if len(filters) > 0 {
		encoded, err := json.Marshal(filters)
		if err != nil {
			return nil, fmt.Errorf("encode task filters: %w", err)
		}
		query.Set("filters", string(encoded))
	}
	var output []Task
	endpoint := "/tasks"
	if len(query) > 0 {
		endpoint += "?" + query.Encode()
	}
	if err := c.getJSON(ctx, endpoint, &output); err != nil {
		return nil, err
	}
	return output, nil
}

// Build sends a tar build context to the Docker Engine. The caller owns the
// input stream and must put a timeout on its context for long-running builds.
func (c *Client) Build(ctx context.Context, contextTar io.Reader, query url.Values, headers http.Header) (string, error) {
	response, err := c.requestWithClient(ctx, c.buildHTTP, http.MethodPost, "/build?"+query.Encode(), contextTar, headers)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(io.LimitReader(response.Body, responseLimit))
	if err != nil {
		return "", fmt.Errorf("read build response: %w", err)
	}
	if int64(len(body)) == responseLimit {
		return "", fmt.Errorf("build response exceeded %d bytes", responseLimit)
	}
	return string(body), nil
}

func (c *Client) getJSON(ctx context.Context, endpoint string, output any) error {
	response, err := c.request(ctx, http.MethodGet, endpoint, nil, nil)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	decoder := json.NewDecoder(io.LimitReader(response.Body, responseLimit))
	if err := decoder.Decode(output); err != nil {
		return fmt.Errorf("decode Docker response: %w", err)
	}
	return nil
}

func (c *Client) request(ctx context.Context, method, endpoint string, body io.Reader, headers http.Header) (*http.Response, error) {
	return c.requestWithClient(ctx, c.http, method, endpoint, body, headers)
}

func (c *Client) requestWithClient(ctx context.Context, client *http.Client, method, endpoint string, body io.Reader, headers http.Header) (*http.Response, error) {
	if client == nil {
		return nil, fmt.Errorf("Docker API client is not configured")
	}
	parsed, err := url.Parse(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("parse Docker API base URL: %w", err)
	}
	relative, err := url.Parse(endpoint)
	if err != nil {
		return nil, fmt.Errorf("parse Docker API endpoint: %w", err)
	}
	parsed.Path = path.Join(parsed.Path, relative.Path)
	parsed.RawQuery = relative.RawQuery
	req, err := http.NewRequestWithContext(ctx, method, parsed.String(), body)
	if err != nil {
		return nil, fmt.Errorf("create Docker request: %w", err)
	}
	for key, values := range headers {
		for _, value := range values {
			req.Header.Add(key, value)
		}
	}
	response, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("Docker API %s %s: %w", method, endpoint, err)
	}
	if response.StatusCode >= http.StatusBadRequest {
		defer response.Body.Close()
		body, _ := io.ReadAll(io.LimitReader(response.Body, 8<<10))
		message := strings.TrimSpace(string(bytes.TrimSpace(body)))
		if message == "" {
			message = response.Status
		}
		return nil, fmt.Errorf("Docker API %s %s: %s", method, endpoint, message)
	}
	return response, nil
}
