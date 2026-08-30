// Package agentpull implements the outbound-only transport between a native
// SwarmOps agent and Core. Core can invoke only the reviewed machine-agent HTTP
// surface; the transport cannot address arbitrary hosts, sockets, or paths.
package agentpull

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	ProtocolVersion  = 1
	MaxBodyBytes     = 64 << 20
	MaxResponseBytes = 4 << 20
)

// ErrRequestNotCatalogued identifies a Core-side transport contract error.
// It is not evidence that the authenticated outbound agent is unreachable.
var ErrRequestNotCatalogued = errors.New("agent pull request is not catalogued")

// PollRequest is sent by an agent on every long poll. Cursor is the highest
// request sequence the agent has durably accepted; AuthorityEpoch is the
// highest Core authority it has accepted.
type PollRequest struct {
	AgentID        string `json:"agentId"`
	AuthorityEpoch uint64 `json:"authorityEpoch"`
	Cursor         uint64 `json:"cursor"`
	Protocol       uint   `json:"protocol"`
	Status         Status `json:"status"`
}

// Status contains only the safe handshake facts needed to surface and attach
// an outbound agent. It intentionally mirrors, rather than embeds, the agent
// package contract to keep the transport dependency one-way.
type Status struct {
	DockerAvailable       bool   `json:"dockerAvailable"`
	DockerVersion         string `json:"dockerVersion,omitempty"`
	NodeName              string `json:"nodeName"`
	RemoteControlEnabled  bool   `json:"remoteControlEnabled"`
	SwarmControlAvailable bool   `json:"swarmControlAvailable"`
	SwarmState            string `json:"swarmState,omitempty"`
	Version               string `json:"version"`
}

type Request struct {
	AuthorityEpoch uint64            `json:"authorityEpoch"`
	Body           []byte            `json:"body,omitempty"`
	CreatedAt      time.Time         `json:"createdAt"`
	ExpiresAt      time.Time         `json:"expiresAt"`
	Header         map[string]string `json:"header,omitempty"`
	ID             string            `json:"id"`
	Method         string            `json:"method"`
	Path           string            `json:"path"`
	Sequence       uint64            `json:"sequence"`
}

type Response struct {
	Body       []byte            `json:"body,omitempty"`
	Header     map[string]string `json:"header,omitempty"`
	RequestID  string            `json:"requestId"`
	Sequence   uint64            `json:"sequence"`
	StatusCode int               `json:"statusCode"`
}

func validateRequest(method, requestURI string) error {
	if method != http.MethodGet && method != http.MethodPost {
		return fmt.Errorf("%w: method", ErrRequestNotCatalogued)
	}
	parsed, err := url.ParseRequestURI(requestURI)
	if err != nil || parsed.IsAbs() || parsed.Host != "" {
		return fmt.Errorf("agent pull path is invalid")
	}
	path := parsed.Path
	if path == "/v1/status" || path == "/v1/diagnostics" || path == "/v1/snapshot" ||
		path == "/v1/metrics" || path == "/v1/swarm/join-token" ||
		path == "/v1/provisioning/status" || path == "/v1/agent/update" ||
		path == "/v1/commands" || path == "/v1/logs/query" || path == "/v1/logs/status" ||
		strings.HasPrefix(path, "/v1/routing/") ||
		strings.HasPrefix(path, "/v1/traefik/") || strings.HasPrefix(path, "/v1/engine/") {
		return nil
	}
	return fmt.Errorf("%w: path", ErrRequestNotCatalogued)
}
