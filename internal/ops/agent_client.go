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
	RunStatus(ctx context.Context, address, id string) (agent.RunStatus, error)
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

func (r HTTPAgentReader) RunStatus(ctx context.Context, address, id string) (agent.RunStatus, error) {
	if len(r.Token) == 0 {
		return agent.RunStatus{}, fmt.Errorf("agent token is not configured")
	}
	if !agent.ValidRunID(id) {
		return agent.RunStatus{}, fmt.Errorf("invalid fleet run id")
	}
	host, err := agentHost(address)
	if err != nil {
		return agent.RunStatus{}, err
	}
	client := r.Client
	if client == nil {
		client = &http.Client{Timeout: 3 * time.Second}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, "http://"+host+":9180/v1/fleet-runs/"+id, nil)
	if err != nil {
		return agent.RunStatus{}, fmt.Errorf("create agent fleet request: %w", err)
	}
	request.Header.Set("Authorization", "Bearer "+string(r.Token))
	response, err := client.Do(request)
	if err != nil {
		return agent.RunStatus{}, fmt.Errorf("read agent fleet status: %w", err)
	}
	defer response.Body.Close()
	if response.StatusCode == http.StatusNotFound {
		return agent.RunStatus{}, agent.ErrRunNotFound
	}
	if response.StatusCode != http.StatusOK {
		return agent.RunStatus{}, fmt.Errorf("agent returned %s", response.Status)
	}
	var status agent.RunStatus
	if err := json.NewDecoder(io.LimitReader(response.Body, 32<<10)).Decode(&status); err != nil {
		return agent.RunStatus{}, fmt.Errorf("decode agent fleet status: %w", err)
	}
	return status, nil
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
