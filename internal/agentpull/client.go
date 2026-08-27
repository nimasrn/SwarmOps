package agentpull

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ClientConfig struct {
	AgentID   string
	BaseURL   string
	Handler   http.Handler
	HTTP      *http.Client
	LocalKey  []byte
	StateFile string
	Status    func(context.Context) (Status, error)
}

type clientState struct {
	AuthorityEpoch uint64 `json:"authorityEpoch"`
	Cursor         uint64 `json:"cursor"`
}

// Client continuously long-polls Core, executes one reviewed local request at
// a time, and acknowledges it before accepting the next sequence.
type Client struct {
	config ClientConfig
	state  clientState
}

func NewClient(config ClientConfig) (*Client, error) {
	config.AgentID = strings.TrimSpace(config.AgentID)
	config.BaseURL = strings.TrimSuffix(strings.TrimSpace(config.BaseURL), "/")
	parsed, err := url.Parse(config.BaseURL)
	if err != nil || parsed.Hostname() == "" || (parsed.Scheme != "https" && !(parsed.Scheme == "http" && (parsed.Hostname() == "127.0.0.1" || parsed.Hostname() == "localhost" || parsed.Hostname() == "::1"))) {
		return nil, fmt.Errorf("Core URL must use HTTPS outside loopback")
	}
	if config.AgentID == "" || len(config.AgentID) > 64 || config.Handler == nil || config.HTTP == nil || config.Status == nil || len(config.LocalKey) < 16 || strings.TrimSpace(config.StateFile) == "" {
		return nil, fmt.Errorf("outbound agent client configuration is incomplete")
	}
	client := &Client{config: config}
	data, err := os.ReadFile(config.StateFile)
	if err == nil {
		if err := json.Unmarshal(data, &client.state); err != nil {
			return nil, fmt.Errorf("read outbound agent cursor: %w", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read outbound agent cursor: %w", err)
	}
	return client, nil
}

func (c *Client) Run(ctx context.Context) error {
	backoff := time.Second
	for ctx.Err() == nil {
		status, err := c.config.Status(ctx)
		if err == nil {
			err = c.cycle(ctx, status)
		}
		if err == nil {
			backoff = time.Second
			continue
		}
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(jitter(backoff)):
		}
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
	return nil
}

func (c *Client) cycle(ctx context.Context, status Status) error {
	payload, err := json.Marshal(PollRequest{AgentID: c.config.AgentID, AuthorityEpoch: c.state.AuthorityEpoch, Cursor: c.state.Cursor, Protocol: ProtocolVersion, Status: status})
	if err != nil {
		return err
	}
	pollContext, cancel := context.WithTimeout(ctx, 35*time.Second)
	defer cancel()
	response, err := c.post(pollContext, "/agent/v1/poll", payload)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNoContent {
		if value, parseErr := strconv.ParseUint(response.Header.Get("X-SwarmOps-Authority-Epoch"), 10, 64); parseErr == nil && value > c.state.AuthorityEpoch {
			c.state.AuthorityEpoch = value
			return c.saveState()
		}
		return nil
	}
	if response.StatusCode == http.StatusConflict {
		var value struct {
			AuthorityEpoch uint64 `json:"authorityEpoch"`
		}
		if json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&value) == nil && value.AuthorityEpoch > c.state.AuthorityEpoch {
			c.state.AuthorityEpoch = value.AuthorityEpoch
			return c.saveState()
		}
		return fmt.Errorf("Core rejected the agent authority epoch")
	}
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("Core poll returned HTTP %d", response.StatusCode)
	}
	var request Request
	if err := json.NewDecoder(io.LimitReader(response.Body, MaxBodyBytes+(1<<20))).Decode(&request); err != nil {
		return fmt.Errorf("decode Core request: %w", err)
	}
	if request.AuthorityEpoch < c.state.AuthorityEpoch {
		return fmt.Errorf("Core request uses a stale authority epoch")
	}
	if request.AuthorityEpoch > c.state.AuthorityEpoch {
		c.state.AuthorityEpoch = request.AuthorityEpoch
		if err := c.saveState(); err != nil {
			return err
		}
	}
	if request.Sequence <= c.state.Cursor {
		return fmt.Errorf("Core repeated an acknowledged agent request")
	}
	result := c.dispatch(ctx, request)
	encoded, err := json.Marshal(result)
	if err != nil {
		return err
	}
	ack, err := c.post(ctx, "/agent/v1/responses", encoded)
	if err != nil {
		return err
	}
	defer ack.Body.Close()
	if ack.StatusCode != http.StatusNoContent {
		return fmt.Errorf("Core response acknowledgement returned HTTP %d", ack.StatusCode)
	}
	c.state.Cursor = request.Sequence
	return c.saveState()
}

func (c *Client) dispatch(ctx context.Context, item Request) Response {
	if err := validateRequest(item.Method, item.Path); err != nil || item.AuthorityEpoch != c.state.AuthorityEpoch || time.Now().UTC().After(item.ExpiresAt) {
		return Response{Body: []byte(`{"error":"catalog request was rejected"}`), Header: map[string]string{"Content-Type": "application/json"}, RequestID: item.ID, Sequence: item.Sequence, StatusCode: http.StatusUnprocessableEntity}
	}
	request, err := http.NewRequestWithContext(ctx, item.Method, "http://agent.local"+item.Path, bytes.NewReader(item.Body))
	if err != nil {
		return Response{RequestID: item.ID, Sequence: item.Sequence, StatusCode: http.StatusBadRequest}
	}
	for name, value := range item.Header {
		request.Header.Set(name, value)
	}
	request.Header.Set("Authorization", "Bearer "+string(c.config.LocalKey))
	recorder := httptest.NewRecorder()
	c.config.Handler.ServeHTTP(recorder, request)
	response := recorder.Result()
	defer response.Body.Close()
	body, readErr := io.ReadAll(io.LimitReader(response.Body, MaxResponseBytes+1))
	if readErr != nil || len(body) > MaxResponseBytes {
		return Response{Body: []byte(`{"error":"agent response exceeded its safety boundary"}`), Header: map[string]string{"Content-Type": "application/json"}, RequestID: item.ID, Sequence: item.Sequence, StatusCode: http.StatusBadGateway}
	}
	return Response{Body: body, Header: safeResponseHeaders(response.Header), RequestID: item.ID, Sequence: item.Sequence, StatusCode: response.StatusCode}
}

func (c *Client) post(ctx context.Context, path string, body []byte) (*http.Response, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, c.config.BaseURL+path, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	return c.config.HTTP.Do(request)
}

func (c *Client) saveState() error {
	data, err := json.Marshal(c.state)
	if err != nil {
		return err
	}
	directory := filepath.Dir(c.config.StateFile)
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return err
	}
	temporary, err := os.CreateTemp(directory, ".agent-cursor-*")
	if err != nil {
		return err
	}
	name := temporary.Name()
	defer os.Remove(name)
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		return err
	}
	if _, err := temporary.Write(data); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Sync(); err != nil {
		_ = temporary.Close()
		return err
	}
	if err := temporary.Close(); err != nil {
		return err
	}
	return os.Rename(name, c.config.StateFile)
}

func safeResponseHeaders(header http.Header) map[string]string {
	result := map[string]string{}
	for _, name := range []string{"Content-Type", "Docker-Content-Digest"} {
		if value := strings.TrimSpace(header.Get(name)); value != "" {
			result[name] = value
		}
	}
	return result
}

func jitter(value time.Duration) time.Duration {
	if value <= 0 {
		return time.Second
	}
	return value/2 + time.Duration(rand.Int64N(int64(value)))
}
