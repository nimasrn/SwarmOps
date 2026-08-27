package ops

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
)

type AgentReader interface {
	Snapshot(ctx context.Context, address string) (agent.Snapshot, error)
}

type HTTPAgentReader struct {
	Client *http.Client
	Token  []byte
}

func (r HTTPAgentReader) Snapshot(ctx context.Context, address string) (agent.Snapshot, error) {
	if len(r.Token) == 0 {
		return agent.Snapshot{}, fmt.Errorf("agent token is not configured")
	}
	host, err := agentHost(address)
	if err != nil {
		return agent.Snapshot{}, err
	}
	client := r.Client
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+host+":9180/v1/snapshot", nil)
	if err != nil {
		return agent.Snapshot{}, fmt.Errorf("create agent request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+string(r.Token))
	response, err := client.Do(request)
	if err != nil {
		return agent.Snapshot{}, fmt.Errorf("read agent snapshot: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return agent.Snapshot{}, fmt.Errorf("agent returned %s", response.Status)
	}
	var snapshot agent.Snapshot
	if err := json.NewDecoder(io.LimitReader(response.Body, 1<<20)).Decode(&snapshot); err != nil {
		return agent.Snapshot{}, fmt.Errorf("decode agent snapshot: %w", err)
	}
	return snapshot, nil
}

func agentHost(address string) (string, error) {
	address = strings.TrimSpace(address)
	if address == "" {
		return "", fmt.Errorf("agent task has no overlay address")
	}
	if host, _, err := net.ParseCIDR(address); err == nil {
		return host.String(), nil
	}
	parsed, err := url.Parse("//" + address)
	if err != nil || parsed.Hostname() == "" {
		return "", fmt.Errorf("invalid agent address")
	}
	return parsed.Hostname(), nil
}
