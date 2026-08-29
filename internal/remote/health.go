package remote

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/agent"
	"github.com/nimasrn/SwarmOps/internal/agentpull"
	"github.com/nimasrn/SwarmOps/internal/dockerapi"
	"github.com/nimasrn/SwarmOps/internal/domain"
)

const (
	agentHealthEventLimit   = 24
	agentProbeTimeout       = 12 * time.Second
	agentUpdateRequestEvery = 6 * time.Hour
)

type agentFailure struct {
	clearDocker bool
	code        string
	detail      string
	disconnect  bool
	state       domain.Health
	summary     string
}

// Probe revalidates one machine API without trusting an old in-memory client
// as proof of health. A successful probe also checks the fixed Docker facade
// and reads the agent's safe diagnostics. Failed probes are retained as
// bounded controller observations so a later outage is still explainable.
func (m *Manager) Probe(ctx context.Context, id string) (domain.Server, error) {
	if strings.TrimSpace(id) == "" {
		return domain.Server{}, fmt.Errorf("server identifier is required")
	}
	m.probeMu.Lock()
	defer m.probeMu.Unlock()

	m.mu.RLock()
	profile, found := m.profiles[id]
	connection := m.connections[id]
	key := m.keys[id]
	m.mu.RUnlock()
	if !found {
		return domain.Server{}, fmt.Errorf("server not found")
	}
	if profile.ConnectionType == ConnectionAgentPull {
		if connection == nil || !pullConnectionFresh(profile, time.Now().UTC()) {
			return profile, fmt.Errorf("outbound agent has stopped polling")
		}
		return profile, nil
	}
	if profile.ConnectionType != ConnectionAgentAPI {
		return profile, nil
	}
	if connection == nil && len(key) < 16 {
		return m.markReconnectRequired(id)
	}

	createdConnection := false
	if connection == nil {
		probeContext, cancel := context.WithTimeout(ctx, agentProbeTimeout)
		candidate, next, err := establishAgentAPI(probeContext, profile, Credentials{APIKey: key, Authentication: AuthenticationAPIKey})
		cancel()
		if err != nil {
			return m.recordAgentFailure(id, err)
		}
		connection = candidate
		profile = next
		createdConnection = true
	}
	runner, ok := connection.Runner.(*AgentRunner)
	if !ok {
		if createdConnection {
			connection.close()
		}
		return m.recordAgentFailure(id, fmt.Errorf("machine API runner is unavailable"))
	}

	probeContext, cancel := context.WithTimeout(ctx, agentProbeTimeout)
	status, err := runner.Status(probeContext)
	if err == nil && !status.RemoteControlEnabled {
		err = ErrAgentAPIDisabled
	}
	if err != nil {
		cancel()
		if createdConnection {
			connection.close()
		}
		return m.recordAgentFailure(id, err)
	}
	next := profileFromAgentStatus(profile, status, time.Now().UTC())
	nextDocker, err := dockerForAgentRunner(runner, status.DockerAvailable, probeContext)
	if err != nil {
		cancel()
		if createdConnection {
			connection.close()
		}
		return m.recordAgentFailure(id, err)
	}
	diagnostics, err := runner.Diagnostics(probeContext)
	cancel()
	if err != nil {
		if nextDocker != nil {
			nextDocker.CloseIdleConnections()
		}
		if createdConnection {
			connection.close()
		}
		return m.recordAgentFailure(id, err)
	}
	next = profileFromAgentDiagnostics(next, diagnostics, time.Now().UTC())
	return m.commitAgentProbe(id, connection, createdConnection, next, nextDocker)
}

// ProbeAll is intentionally sequential: every remote call has a bounded
// timeout, and serialising the health pass avoids a reconnection storm after a
// core restart or network partition.
func (m *Manager) ProbeAll(ctx context.Context) []error {
	m.mu.RLock()
	ids := make([]string, 0, len(m.profiles))
	for id, profile := range m.profiles {
		if profile.ConnectionType == ConnectionAgentAPI {
			ids = append(ids, id)
		}
	}
	m.mu.RUnlock()
	sort.Strings(ids)
	failures := make([]error, 0)
	for _, id := range ids {
		if ctx.Err() != nil {
			return append(failures, ctx.Err())
		}
		if _, err := m.Probe(ctx, id); err != nil {
			failures = append(failures, fmt.Errorf("probe %s: %w", id, err))
		}
	}
	return failures
}

// StartAgentMonitor maintains a truthful control-plane view. It exits with
// its owning context and deliberately makes no unbounded retry loop.
func (m *Manager) StartAgentMonitor(ctx context.Context, interval time.Duration, active func() bool) {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	m.monitorOnce(ctx, active)
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.monitorOnce(ctx, active)
		}
	}
}

func (m *Manager) monitorOnce(ctx context.Context, active func() bool) {
	if active != nil && !active() {
		return
	}
	m.probeAndScheduleUpdates(ctx)
}

func (m *Manager) probeAndScheduleUpdates(ctx context.Context) {
	for _, failure := range m.ProbeAll(ctx) {
		_ = failure // Probe persists the safe observation; callers may log separately if needed.
	}
	for _, server := range m.List() {
		if server.ConnectionType != ConnectionAgentAPI || !server.AgentHealth.Update.Automatic || !shouldRequestAgentUpdate(server.AgentHealth.Update, time.Now().UTC()) {
			continue
		}
		updateContext, cancel := context.WithTimeout(ctx, agentProbeTimeout)
		_, _ = m.RequestAgentUpdate(updateContext, server.ID)
		cancel()
	}
}

// AgentDiagnostics returns the last durable safe diagnostic view even when a
// fresh probe fails. This is what lets the control plane explain an outage
// instead of replacing it with a generic request error.
func (m *Manager) AgentDiagnostics(ctx context.Context, id string) (domain.AgentHealth, error) {
	m.mu.RLock()
	profile, found := m.profiles[id]
	connection := m.connections[id]
	m.mu.RUnlock()
	if !found {
		return domain.AgentHealth{}, fmt.Errorf("server not found")
	}
	if profile.ConnectionType == ConnectionAgentPull {
		if connection == nil || !pullConnectionFresh(profile, time.Now().UTC()) {
			health := profile.AgentHealth
			health.State = domain.HealthUnknown
			health.Summary = "Outbound agent has stopped polling"
			health.Detail = "Check the Agent service and its pinned HTTPS path to Core; it will reconnect without a new credential."
			return health, fmt.Errorf("outbound agent has stopped polling")
		}
		return profile.AgentHealth, nil
	}
	_, probeErr := m.Probe(ctx, id)
	m.mu.RLock()
	profile, found = m.profiles[id]
	m.mu.RUnlock()
	if !found {
		return domain.AgentHealth{}, fmt.Errorf("server not found")
	}
	if profile.ConnectionType != ConnectionAgentAPI {
		return domain.AgentHealth{}, fmt.Errorf("server does not expose a native machine agent")
	}
	return profile.AgentHealth, probeErr
}

// RequestAgentUpdate invokes the agent's fixed update-request marker. The
// local Warden owns release discovery, checksum verification, activation,
// health validation, rollback, and restart;
// the controller cannot inject any of those values.
func (m *Manager) RequestAgentUpdate(ctx context.Context, id string) (domain.AgentHealth, error) {
	if _, err := m.Probe(ctx, id); err != nil {
		return m.currentAgentHealth(id, err)
	}
	m.mu.RLock()
	connection := m.connections[id]
	m.mu.RUnlock()
	runner, ok := agentRunnerFromConnection(connection)
	if !ok {
		return m.currentAgentHealth(id, fmt.Errorf("machine API runner is unavailable"))
	}
	if err := runner.RequestUpdate(ctx); err != nil {
		_, recordErr := m.recordAgentFailure(id, err)
		return m.currentAgentHealth(id, firstError(err, recordErr))
	}
	return m.recordUpdateRequest(id)
}

// ObserveFailure lets a request path immediately downgrade an otherwise
// cached connection. It ignores unrelated validation errors; only recognised
// machine-agent failures become persisted health evidence.
func (m *Manager) ObserveFailure(id string, err error) error {
	if strings.TrimSpace(id) == "" || err == nil || !isObservedAgentFailure(err) {
		return nil
	}
	_, recordErr := m.recordAgentFailure(id, err)
	return recordErr
}

// A fixed operation may legitimately return a 4xx/5xx because the managed
// workload is absent or unhealthy while the machine agent itself remains
// reachable. Those operation outcomes must not evict a healthy manager from
// every console screen. The active probe owns generic response health; request
// paths downgrade immediately only for failures that identify transport,
// identity, Docker availability, or a missing protocol route.
func isObservedAgentFailure(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, ErrAgentAPIIncompatible) || errors.Is(err, ErrAgentAPIFingerprint) || errors.Is(err, ErrAgentAPIUnauthorized) || errors.Is(err, ErrAgentAPIDisabled) || errors.Is(err, ErrDockerUnavailable) {
		return true
	}
	var response *AgentHTTPError
	if errors.As(err, &response) {
		return response.StatusCode == http.StatusNotFound
	}
	return isAgentFailure(err)
}

func (m *Manager) markReconnectRequired(id string) (domain.Server, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, found := m.profiles[id]
	if !found {
		return domain.Server{}, fmt.Errorf("server not found")
	}
	if profile.AgentHealth.State == "" {
		profile.AgentHealth = domain.AgentHealth{
			Detail:  "Reconnect with the machine API key, or enable retained machine keys for enrollment-based reconnects.",
			State:   domain.HealthUnknown,
			Summary: "Machine API has not been probed",
		}
		m.profiles[id] = profile
		if err := m.saveLocked(); err != nil {
			return domain.Server{}, err
		}
	}
	return profile, nil
}

func (m *Manager) commitAgentProbe(id string, connection *Connection, created bool, profile domain.Server, docker *dockerapi.Client) (domain.Server, error) {
	m.mu.Lock()
	previousProfile, found := m.profiles[id]
	if !found {
		m.mu.Unlock()
		if created {
			connection.close()
		}
		return domain.Server{}, fmt.Errorf("server not found")
	}
	previousConnection := m.connections[id]
	previousConnectionProfile := connection.Profile
	previousDocker := connection.Docker
	connection.Profile = profile
	connection.Docker = docker
	m.profiles[id] = profile
	m.connections[id] = connection
	if err := m.saveLocked(); err != nil {
		m.profiles[id] = previousProfile
		connection.Profile = previousConnectionProfile
		connection.Docker = previousDocker
		if previousConnection == nil {
			delete(m.connections, id)
		} else {
			m.connections[id] = previousConnection
		}
		m.mu.Unlock()
		if docker != nil && docker != previousDocker {
			docker.CloseIdleConnections()
		}
		if created {
			connection.close()
		}
		return domain.Server{}, err
	}
	m.mu.Unlock()
	if previousConnection == connection && previousDocker != nil && previousDocker != docker {
		previousDocker.CloseIdleConnections()
	}
	if previousConnection != nil && previousConnection != connection {
		previousConnection.close()
	}
	return profile, nil
}

func firstError(primary, fallback error) error {
	if primary != nil {
		return primary
	}
	return fallback
}

func (m *Manager) recordAgentFailure(id string, err error) (domain.Server, error) {
	failure, ok := classifyAgentFailure(err)
	if !ok {
		m.mu.RLock()
		profile, found := m.profiles[id]
		m.mu.RUnlock()
		if !found {
			return domain.Server{}, fmt.Errorf("server not found")
		}
		return profile, err
	}
	now := time.Now().UTC()
	m.mu.Lock()
	profile, found := m.profiles[id]
	if !found {
		m.mu.Unlock()
		return domain.Server{}, fmt.Errorf("server not found")
	}
	previousProfile := profile
	previousConnection := m.connections[id]
	previousDocker := (*dockerapi.Client)(nil)
	if previousConnection != nil {
		previousDocker = previousConnection.Docker
	}
	health := profile.AgentHealth
	health.CheckedAt = now
	health.Detail = failure.detail
	health.LastFailureAt = now
	health.State = failure.state
	health.Summary = failure.summary
	health.Events = appendAgentEvent(health.Events, domain.AgentEvent{Code: failure.code, Level: "error", Message: failure.summary, OccurredAt: now, Source: "core"})
	profile.AgentHealth = health
	if failure.clearDocker {
		profile.DockerAvailable = false
		profile.DockerVersion = ""
		profile.SwarmControlAvailable = false
		profile.SwarmState = ""
	}
	m.profiles[id] = profile
	if failure.disconnect {
		delete(m.connections, id)
	}
	if saveErr := m.saveLocked(); saveErr != nil {
		m.profiles[id] = previousProfile
		if failure.disconnect {
			m.connections[id] = previousConnection
		}
		m.mu.Unlock()
		return domain.Server{}, saveErr
	}
	if !failure.disconnect && previousConnection != nil {
		previousConnection.Profile = profile
		if failure.clearDocker {
			previousConnection.Docker = nil
		}
	}
	m.mu.Unlock()
	if failure.disconnect && previousConnection != nil {
		previousConnection.close()
	} else if failure.clearDocker && previousDocker != nil {
		previousDocker.CloseIdleConnections()
	}
	return profile, err
}

func (m *Manager) recordUpdateRequest(id string) (domain.AgentHealth, error) {
	now := time.Now().UTC()
	m.mu.Lock()
	defer m.mu.Unlock()
	profile, found := m.profiles[id]
	if !found {
		return domain.AgentHealth{}, fmt.Errorf("server not found")
	}
	previous := profile
	profile.AgentHealth.Update.RequestedAt = now
	profile.AgentHealth.Update.State = "scheduled"
	profile.AgentHealth.Events = appendAgentEvent(profile.AgentHealth.Events, domain.AgentEvent{Code: "update_check_requested", Level: "info", Message: "The core requested a local agent update check", OccurredAt: now, Source: "core"})
	m.profiles[id] = profile
	if err := m.saveLocked(); err != nil {
		m.profiles[id] = previous
		return domain.AgentHealth{}, err
	}
	return profile.AgentHealth, nil
}

func (m *Manager) currentAgentHealth(id string, cause error) (domain.AgentHealth, error) {
	m.mu.RLock()
	profile, found := m.profiles[id]
	m.mu.RUnlock()
	if !found {
		return domain.AgentHealth{}, fmt.Errorf("server not found")
	}
	return profile.AgentHealth, cause
}

func agentRunnerFromConnection(connection *Connection) (*AgentRunner, bool) {
	if connection == nil {
		return nil, false
	}
	runner, ok := connection.Runner.(*AgentRunner)
	return runner, ok
}

func dockerForAgentRunner(runner *AgentRunner, available bool, ctx context.Context) (*dockerapi.Client, error) {
	if !available {
		return nil, nil
	}
	if runner == nil || runner.client == nil {
		return nil, fmt.Errorf("machine API Docker facade is unavailable")
	}
	docker, err := dockerapi.NewForURLWithBuildClient(runner.client.baseURL+"/v1/engine", runner.client.http, runner.client.longHTTP)
	if err != nil {
		return nil, err
	}
	if err := docker.Ping(ctx); err != nil {
		docker.CloseIdleConnections()
		if isAgentRouteMissing(err) {
			return nil, ErrAgentAPIIncompatible
		}
		return nil, ErrDockerUnavailable
	}
	return docker, nil
}

func profileFromAgentStatus(profile domain.Server, status agent.Status, now time.Time) domain.Server {
	profile.ConnectionState = connectedState
	profile.DockerAvailable = status.DockerAvailable
	profile.DockerVersion = status.DockerVersion
	profile.SwarmControlAvailable = status.SwarmControlAvailable
	profile.SwarmState = status.SwarmState
	health := profile.AgentHealth
	health.AgentVersion = status.Version
	health.CheckedAt = now
	health.LastReachableAt = now
	health.ProtocolVersion = status.ProtocolVersion
	health.UptimeSeconds = status.UptimeSeconds
	if status.DockerAvailable {
		health.Detail = "The authenticated machine agent and its fixed Docker facade both responded."
		health.State = domain.HealthHealthy
		health.Summary = "Machine agent is reachable"
	} else {
		health.Detail = "The machine agent responded, but it cannot reach Docker Engine. Use Server readiness or repair Docker before cluster operations."
		health.State = domain.HealthDegraded
		health.Summary = "Machine agent is reachable; Docker is unavailable"
	}
	profile.AgentHealth = health
	return profile
}

func profileFromAgentDiagnostics(profile domain.Server, diagnostics agent.Diagnostics, now time.Time) domain.Server {
	if diagnostics.Status.Version != "" {
		profile.AgentHealth.AgentVersion = diagnostics.Status.Version
	}
	if diagnostics.Status.ProtocolVersion != 0 {
		profile.AgentHealth.ProtocolVersion = diagnostics.Status.ProtocolVersion
	}
	if diagnostics.Status.UptimeSeconds != 0 {
		profile.AgentHealth.UptimeSeconds = diagnostics.Status.UptimeSeconds
	}
	requestedAt := profile.AgentHealth.Update.RequestedAt
	profile.AgentHealth.Update = domain.AgentUpdateStatus{
		Automatic:     diagnostics.Update.Automatic,
		CheckedAt:     diagnostics.Update.CheckedAt,
		LastUpdatedAt: diagnostics.Update.LastUpdatedAt,
		RequestedAt:   requestedAt,
		Revision:      diagnostics.Update.Revision,
		State:         diagnostics.Update.State,
		Version:       diagnostics.Update.Version,
	}
	controllerEvents := make([]domain.AgentEvent, 0, len(profile.AgentHealth.Events))
	for _, event := range profile.AgentHealth.Events {
		if event.Source != "agent" {
			controllerEvents = append(controllerEvents, event)
		}
	}
	for _, event := range diagnostics.Events {
		controllerEvents = append(controllerEvents, domain.AgentEvent{Code: event.Code, Level: event.Level, Message: event.Message, OccurredAt: event.OccurredAt, Source: "agent"})
	}
	profile.AgentHealth.Events = limitAgentEvents(controllerEvents)
	profile.AgentHealth.CheckedAt = now
	return profile
}

func appendAgentEvent(events []domain.AgentEvent, event domain.AgentEvent) []domain.AgentEvent {
	for index := len(events) - 1; index >= 0; index-- {
		previous := events[index]
		if previous.Source == event.Source && previous.Code == event.Code && previous.Message == event.Message && event.OccurredAt.Sub(previous.OccurredAt) < time.Minute {
			return limitAgentEvents(events)
		}
	}
	return limitAgentEvents(append(events, event))
}

func limitAgentEvents(events []domain.AgentEvent) []domain.AgentEvent {
	if len(events) == 0 {
		return nil
	}
	sort.SliceStable(events, func(left, right int) bool { return events[left].OccurredAt.Before(events[right].OccurredAt) })
	if len(events) > agentHealthEventLimit {
		events = events[len(events)-agentHealthEventLimit:]
	}
	return append([]domain.AgentEvent(nil), events...)
}

func shouldRequestAgentUpdate(update domain.AgentUpdateStatus, now time.Time) bool {
	if !update.Automatic {
		return false
	}
	return update.RequestedAt.IsZero() || now.Sub(update.RequestedAt) >= agentUpdateRequestEvery
}

func classifyAgentFailure(err error) (agentFailure, bool) {
	if err == nil {
		return agentFailure{}, false
	}
	if errors.Is(err, agentpull.ErrRequestNotCatalogued) {
		return agentFailure{}, false
	}
	if errors.Is(err, ErrAgentAPIIncompatible) || isAgentRouteMissing(err) {
		return agentFailure{clearDocker: true, code: "agent_protocol_incompatible", detail: "The machine responded, but it does not expose a fixed route required by this control plane. Update the native agent from Servers; an older installation may need the one-command installer once.", state: domain.HealthDegraded, summary: "Agent update required"}, true
	}
	if errors.Is(err, ErrAgentAPIFingerprint) {
		return agentFailure{clearDocker: true, code: "agent_tls_mismatch", detail: "Verify the pinned SHA256 TLS certificate fingerprint from the machine's trusted console before changing this profile.", disconnect: true, state: domain.HealthUnhealthy, summary: "Machine API certificate fingerprint mismatch"}, true
	}
	if errors.Is(err, ErrAgentAPIUnauthorized) {
		return agentFailure{clearDocker: true, code: "agent_key_rejected", detail: "Verify the protected machine API key or enroll the server again. The key is never exposed by this control plane.", disconnect: true, state: domain.HealthUnhealthy, summary: "Machine API key was rejected"}, true
	}
	if errors.Is(err, ErrAgentAPIDisabled) {
		return agentFailure{clearDocker: true, code: "agent_control_disabled", detail: "Enable the native agent's reviewed remote-control mode and TLS, then reconnect this server.", disconnect: true, state: domain.HealthUnhealthy, summary: "Machine API remote control is disabled"}, true
	}
	if errors.Is(err, ErrDockerUnavailable) || strings.Contains(err.Error(), "machine API Docker Engine is unavailable") {
		return agentFailure{clearDocker: true, code: "docker_unavailable", detail: "The machine agent responded but Docker Engine did not. Start or repair Docker, then use Server readiness to verify it.", state: domain.HealthDegraded, summary: "Machine Docker Engine is unavailable"}, true
	}
	var response *AgentHTTPError
	if errors.As(err, &response) {
		if response.StatusCode == 404 {
			return agentFailure{clearDocker: true, code: "agent_protocol_incompatible", detail: "The machine responded, but it does not expose a fixed route required by this control plane. Update the native agent from Servers; an older installation may need the one-command installer once.", state: domain.HealthDegraded, summary: "Agent update required"}, true
		}
		if response.StatusCode >= 500 {
			return agentFailure{code: "agent_request_failed", detail: "The machine agent returned a server-side failure for a fixed control request. Open its diagnostics for the safe event history and retry after the host is healthy.", state: domain.HealthDegraded, summary: "Machine agent request failed"}, true
		}
		return agentFailure{code: "agent_request_rejected", detail: "The machine agent rejected a fixed control request. Inspect the safe agent diagnostics and update the agent if the control-plane API changed.", state: domain.HealthDegraded, summary: "Machine agent rejected a request"}, true
	}
	if strings.Contains(err.Error(), "connect to machine API") || strings.Contains(err.Error(), "machine API client is not configured") || strings.Contains(err.Error(), "machine API runner is unavailable") {
		return agentFailure{clearDocker: true, code: "agent_unreachable", detail: "Check the machine API URL, port, TLS listener, routing, firewall, and that the agent service is running.", disconnect: true, state: domain.HealthUnhealthy, summary: "Machine API is unreachable"}, true
	}
	return agentFailure{}, false
}

func isAgentFailure(err error) bool {
	_, ok := classifyAgentFailure(err)
	return ok
}

func isAgentRouteMissing(err error) bool {
	var response *AgentHTTPError
	if errors.As(err, &response) && response.StatusCode == 404 {
		return true
	}
	return strings.Contains(err.Error(), "Docker API") && strings.Contains(err.Error(), "404")
}
