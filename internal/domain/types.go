// Package domain contains the stable data contracts for the SwarmOps API.
// It deliberately has no dependency on Docker, HTTP, or command execution.
package domain

import "time"

// CommandState describes the durable lifecycle of an approved SwarmOps
// mutation. Read operations and machine-API key handoff are intentionally not
// commands: retaining either would create a security or freshness hazard.
type CommandState string

const (
	CommandUploading      CommandState = "uploading"
	CommandQueued         CommandState = "queued"
	CommandLeased         CommandState = "leased"
	CommandPreparing      CommandState = "preparing"
	CommandRunning        CommandState = "running"
	CommandRetryScheduled CommandState = "retry_scheduled"
	CommandSucceeded      CommandState = "succeeded"
	CommandFailed         CommandState = "failed"
	CommandNeedsAttention CommandState = "needs_attention"
	CommandSuperseded     CommandState = "superseded"
	CommandCancelled      CommandState = "cancelled"
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

// AgentEvent is a bounded, intentionally sanitised diagnostic record. It is
// safe to retain on the control plane: it never contains command output,
// Docker responses, credentials, paths supplied by an operator, or service
// logs. Source distinguishes a controller observation from an event emitted
// by the native machine agent itself.
type AgentEvent struct {
	Code       string    `json:"code"`
	Level      string    `json:"level"`
	Message    string    `json:"message"`
	OccurredAt time.Time `json:"occurredAt"`
	Source     string    `json:"source"`
}

// AgentUpdateStatus reports the fixed native-agent updater. The updater only
// follows its trusted local Git configuration; these fields are status facts,
// never a remote source, command, or executable supplied by the controller.
type AgentUpdateStatus struct {
	Automatic     bool      `json:"automatic"`
	CheckedAt     time.Time `json:"checkedAt,omitempty"`
	LastUpdatedAt time.Time `json:"lastUpdatedAt,omitempty"`
	RequestedAt   time.Time `json:"requestedAt,omitempty"`
	Revision      string    `json:"revision,omitempty"`
	State         string    `json:"state,omitempty"`
}

// AgentHealth is the controller's last safe observation of a native machine
// agent. State reflects an authenticated probe, not merely whether an old
// HTTP client happens to be cached in memory.
type AgentHealth struct {
	AgentVersion    string            `json:"agentVersion,omitempty"`
	CheckedAt       time.Time         `json:"checkedAt,omitempty"`
	Detail          string            `json:"detail,omitempty"`
	Events          []AgentEvent      `json:"events,omitempty"`
	LastFailureAt   time.Time         `json:"lastFailureAt,omitempty"`
	LastReachableAt time.Time         `json:"lastReachableAt,omitempty"`
	ProtocolVersion uint              `json:"protocolVersion,omitempty"`
	State           Health            `json:"state,omitempty"`
	Summary         string            `json:"summary,omitempty"`
	Update          AgentUpdateStatus `json:"update,omitempty"`
	UptimeSeconds   uint64            `json:"uptimeSeconds,omitempty"`
}

// Server is a non-secret remote target profile. Its API key remains only in
// memory by the transport layer, so a server can be listed after restart but
// must be explicitly reconnected with that key.
type Server struct {
	APIURL                    string      `json:"apiUrl,omitempty"`
	AgentHealth               AgentHealth `json:"agentHealth,omitempty"`
	Authentication            string      `json:"authentication"`
	ConnectionState           string      `json:"connectionState"`
	ConnectionType            string      `json:"connectionType,omitempty"`
	DockerAvailable           bool        `json:"dockerAvailable"`
	DockerVersion             string      `json:"dockerVersion,omitempty"`
	Host                      string      `json:"host"`
	HostKeyFingerprint        string      `json:"hostKeyFingerprint"`
	ID                        string      `json:"id"`
	LastConnectedAt           time.Time   `json:"lastConnectedAt,omitempty"`
	Name                      string      `json:"name"`
	Port                      uint16      `json:"port"`
	SwarmControlAvailable     bool        `json:"swarmControlAvailable"`
	SwarmState                string      `json:"swarmState,omitempty"`
	TLSCertificateFingerprint string      `json:"tlsCertificateFingerprint,omitempty"`
	Username                  string      `json:"username"`
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
	Action         string       `json:"action"`
	Actor          string       `json:"actor"`
	Attempt        uint         `json:"attempt"`
	AuthorityEpoch uint64       `json:"authorityEpoch"`
	AutoRetry      bool         `json:"autoRetry"`
	ClusterID      string       `json:"clusterId"`
	CreatedAt      time.Time    `json:"createdAt"`
	FailureCode    string       `json:"failureCode,omitempty"`
	FailureSummary string       `json:"failureSummary,omitempty"`
	ID             string       `json:"id"`
	LastAttemptAt  *time.Time   `json:"lastAttemptAt,omitempty"`
	LastError      string       `json:"lastError,omitempty"`
	LeaseExpiresAt *time.Time   `json:"leaseExpiresAt,omitempty"`
	MaxAttempts    uint         `json:"maxAttempts"`
	NextAttemptAt  *time.Time   `json:"nextAttemptAt,omitempty"`
	NodeID         string       `json:"nodeId"`
	RequestID      string       `json:"requestId,omitempty"`
	RecoveryHint   string       `json:"recoveryHint,omitempty"`
	ServerID       string       `json:"serverId"`
	State          CommandState `json:"state"`
	Target         string       `json:"target"`
	UpdatedAt      time.Time    `json:"updatedAt"`
}

// CommandEvent is an ordered, non-secret lifecycle observation supplied by a
// pull-connected agent. Evidence is a bounded diagnostic code or summary; it
// must never contain command output, service logs, credentials, or stdin.
type CommandEvent struct {
	CommandID  string       `json:"commandId"`
	Evidence   string       `json:"evidence,omitempty"`
	OccurredAt time.Time    `json:"occurredAt"`
	Sequence   uint64       `json:"sequence"`
	State      CommandState `json:"state"`
}
