// Package domain contains the stable data contracts for the SwarmOps API.
// It deliberately has no dependency on Docker, HTTP, or command execution.
package domain

import "time"

// CommandState describes the durable lifecycle of an approved SwarmOps
// mutation. Read operations and machine-API key handoff are intentionally not
// commands: retaining either would create a security or freshness hazard.
type CommandState string

const (
	CommandQueued         CommandState = "queued"
	CommandRunning        CommandState = "running"
	CommandRetryScheduled CommandState = "retry_scheduled"
	CommandSucceeded      CommandState = "succeeded"
	CommandNeedsAttention CommandState = "needs_attention"
)

type Health string

const (
	HealthHealthy   Health = "healthy"
	HealthDegraded  Health = "degraded"
	HealthUnknown   Health = "unknown"
	HealthUnhealthy Health = "unhealthy"
)

type Capacity struct {
	Available uint64  `json:"available"`
	Capacity  uint64  `json:"capacity"`
	Percent   float64 `json:"percent"`
	Used      uint64  `json:"used"`
}

type NodeAgent struct {
	Address     string    `json:"address,omitempty"`
	CollectedAt time.Time `json:"collectedAt,omitempty"`
	Error       string    `json:"error,omitempty"`
	Healthy     bool      `json:"healthy"`
	Version     string    `json:"version,omitempty"`
}

// Server is a non-secret remote target profile. Its API key remains only in
// memory by the transport layer, so a server can be listed after restart but
// must be explicitly reconnected with that key.
type Server struct {
	APIURL                    string    `json:"apiUrl,omitempty"`
	Authentication            string    `json:"authentication"`
	BootstrapAvailable        bool      `json:"bootstrapAvailable"`
	ConnectionState           string    `json:"connectionState"`
	ConnectionType            string    `json:"connectionType,omitempty"`
	DockerAvailable           bool      `json:"dockerAvailable"`
	DockerVersion             string    `json:"dockerVersion,omitempty"`
	Host                      string    `json:"host"`
	HostKeyFingerprint        string    `json:"hostKeyFingerprint"`
	ID                        string    `json:"id"`
	LastConnectedAt           time.Time `json:"lastConnectedAt,omitempty"`
	Managed                   bool      `json:"managed"`
	MobilityAvailable         bool      `json:"mobilityAvailable"`
	Name                      string    `json:"name"`
	Port                      uint16    `json:"port"`
	SwarmControlAvailable     bool      `json:"swarmControlAvailable"`
	SwarmState                string    `json:"swarmState,omitempty"`
	TLSCertificateFingerprint string    `json:"tlsCertificateFingerprint,omitempty"`
	Username                  string    `json:"username"`
}

type Node struct {
	Address       string            `json:"address,omitempty"`
	Agent         NodeAgent         `json:"agent"`
	Availability  string            `json:"availability"`
	CPU           Capacity          `json:"cpu"`
	DockerVersion string            `json:"dockerVersion,omitempty"`
	Disk          Capacity          `json:"disk"`
	Engine        Engine            `json:"engine"`
	Hostname      string            `json:"hostname"`
	ID            string            `json:"id"`
	Kernel        string            `json:"kernel,omitempty"`
	Labels        map[string]string `json:"labels,omitempty"`
	Load1         float64           `json:"load1,omitempty"`
	Manager       *Manager          `json:"manager,omitempty"`
	Memory        Capacity          `json:"memory"`
	OS            string            `json:"os,omitempty"`
	Platform      Platform          `json:"platform"`
	Role          string            `json:"role"`
	State         string            `json:"state"`
	UptimeSeconds uint64            `json:"uptimeSeconds,omitempty"`
}

type Engine struct {
	APIVersion   string `json:"apiVersion,omitempty"`
	CgroupDriver string `json:"cgroupDriver,omitempty"`
	Driver       string `json:"driver,omitempty"`
	Version      string `json:"version,omitempty"`
}

type Manager struct {
	Address      string `json:"address,omitempty"`
	Leader       bool   `json:"leader"`
	Reachability string `json:"reachability,omitempty"`
}

type Platform struct {
	Architecture string `json:"architecture,omitempty"`
	OS           string `json:"os,omitempty"`
}

type Service struct {
	CreatedAt    time.Time         `json:"createdAt,omitempty"`
	DesiredTasks uint64            `json:"desiredTasks"`
	Health       Health            `json:"health"`
	ID           string            `json:"id"`
	Image        string            `json:"image,omitempty"`
	Labels       map[string]string `json:"labels,omitempty"`
	Mode         string            `json:"mode"`
	Name         string            `json:"name"`
	RunningTasks uint64            `json:"runningTasks"`
	Stack        string            `json:"stack,omitempty"`
	UpdatedAt    time.Time         `json:"updatedAt,omitempty"`
	UpdateState  string            `json:"updateState,omitempty"`
}

type Stack struct {
	Health       Health    `json:"health"`
	Name         string    `json:"name"`
	RunningTasks uint64    `json:"runningTasks"`
	ServiceCount uint64    `json:"serviceCount"`
	UpdatedAt    time.Time `json:"updatedAt,omitempty"`
}

type Task struct {
	CurrentState string    `json:"currentState"`
	DesiredState string    `json:"desiredState"`
	Error        string    `json:"error,omitempty"`
	ID           string    `json:"id"`
	Image        string    `json:"image,omitempty"`
	NodeID       string    `json:"nodeId"`
	ServiceID    string    `json:"serviceId"`
	Slot         uint64    `json:"slot"`
	StartedAt    time.Time `json:"startedAt,omitempty"`
}

type Overview struct {
	GeneratedAt time.Time `json:"generatedAt"`
	Health      Health    `json:"health"`
	Nodes       []Node    `json:"nodes"`
	Services    []Service `json:"services"`
	Summary     Summary   `json:"summary"`
}

type Summary struct {
	Managers      uint64   `json:"managers"`
	Nodes         uint64   `json:"nodes"`
	ReadyNodes    uint64   `json:"readyNodes"`
	RunningTasks  uint64   `json:"runningTasks"`
	ServiceHealth Health   `json:"serviceHealth"`
	Services      uint64   `json:"services"`
	TotalCPU      Capacity `json:"totalCpu"`
	TotalDisk     Capacity `json:"totalDisk"`
	TotalMemory   Capacity `json:"totalMemory"`
}

type AuditEvent struct {
	Action     string            `json:"action"`
	Actor      string            `json:"actor"`
	Detail     map[string]string `json:"detail,omitempty"`
	ID         string            `json:"id"`
	OccurredAt time.Time         `json:"occurredAt"`
	Outcome    string            `json:"outcome"`
	RequestID  string            `json:"requestId,omitempty"`
	Target     string            `json:"target"`
}

type ComposePlan struct {
	Digest       string   `json:"digest"`
	Services     []string `json:"services"`
	TargetNodeID string   `json:"targetNodeId,omitempty"`
	Warnings     []string `json:"warnings"`
}

type BuildResult struct {
	Image     string `json:"image"`
	Log       string `json:"log"`
	Pushed    bool   `json:"pushed"`
	RequestID string `json:"requestId"`
}

// Command is the public, non-sensitive record for an approved mutation. Its
// execution payload is intentionally held only by the controller's private
// queue store and is never returned from the API, audit log, or browser.
type Command struct {
	Action        string       `json:"action"`
	Actor         string       `json:"actor"`
	Attempt       uint         `json:"attempt"`
	AutoRetry     bool         `json:"autoRetry"`
	CreatedAt     time.Time    `json:"createdAt"`
	ID            string       `json:"id"`
	LastAttemptAt *time.Time   `json:"lastAttemptAt,omitempty"`
	LastError     string       `json:"lastError,omitempty"`
	LastLogAt     *time.Time   `json:"lastLogAt,omitempty"`
	LogCount      uint         `json:"logCount"`
	MaxAttempts   uint         `json:"maxAttempts"`
	NextAttemptAt *time.Time   `json:"nextAttemptAt,omitempty"`
	RequestID     string       `json:"requestId,omitempty"`
	ServerID      string       `json:"serverId"`
	State         CommandState `json:"state"`
	Target        string       `json:"target"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

// CommandLogEntry is a bounded, redacted operational event emitted while a
// queued mutation is running. It is retained only in the encrypted command
// store, never in the audit trail. Raw service and build output intentionally
// remain outside this contract because either may contain operator data.
type CommandLogEntry struct {
	Attempt    uint      `json:"attempt"`
	OccurredAt time.Time `json:"occurredAt"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	Source     string    `json:"source"`
}

// FleetRun reports durable, reviewed Ansible operations. It contains status
// only; output stays on the host and is never streamed through the API.
type FleetRun struct {
	ID    string         `json:"id"`
	Nodes []FleetRunNode `json:"nodes"`
}

type FleetRunNode struct {
	Attempt       uint       `json:"attempt,omitempty"`
	Error         string     `json:"error,omitempty"`
	ExitCode      *int       `json:"exitCode,omitempty"`
	FinishedAt    *time.Time `json:"finishedAt,omitempty"`
	Hostname      string     `json:"hostname"`
	MaxAttempts   uint       `json:"maxAttempts,omitempty"`
	NextAttemptAt *time.Time `json:"nextAttemptAt,omitempty"`
	NodeID        string     `json:"nodeId"`
	Operation     string     `json:"operation,omitempty"`
	StartedAt     time.Time  `json:"startedAt,omitempty"`
	State         string     `json:"state"`
}
