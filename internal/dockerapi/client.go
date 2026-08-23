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

// Client connects through a Unix socket by default. A separate constructor
// exists for tests, where an httptest server is safer than a real daemon.
type Client struct {
	baseURL   string
	http      *http.Client
	buildHTTP *http.Client
}

func New(socket string) (*Client, error) {
	socket = strings.TrimPrefix(strings.TrimSpace(socket), "unix://")
	if !strings.HasPrefix(socket, "/") {
		return nil, fmt.Errorf("Docker socket must be an absolute Unix path")
	}
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	transport := &http.Transport{
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return dialer.DialContext(ctx, "unix", socket)
		},
		DisableCompression: true,
	}
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
	if client == nil {
		return nil, fmt.Errorf("http client is required")
	}
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, fmt.Errorf("invalid Docker API URL")
	}
	return &Client{baseURL: strings.TrimSuffix(baseURL, "/"), http: client, buildHTTP: client}, nil
}

func (c *Client) Ping(ctx context.Context) error {
	response, err := c.request(ctx, http.MethodGet, "/_ping", nil, nil)
	if err != nil {
		return err
	}
	return response.Body.Close()
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
