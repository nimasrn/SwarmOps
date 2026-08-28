package domain

import "time"

// CoreRole describes an explicitly configured SwarmOps control-plane role.
// It is intentionally distinct from a Docker Swarm node role and from a
// managed machine-agent server profile.
type CoreRole string

const (
	CoreRoleActive  CoreRole = "active"
	CoreRoleStandby CoreRole = "standby"
)

// CoreReplicaState communicates the evidence available for a standby. A
// verified replica has an operator-attested encrypted-state restore; it is not
// a claim that SwarmOps remotely copied data or fenced another machine.
type CoreReplicaState string

const (
	CoreReplicaAwaitingRestore CoreReplicaState = "awaiting_restore"
	CoreReplicaVerified        CoreReplicaState = "verified"
)

// CoreMember is a control-plane instance, never an implicit managed server.
// AgentServerID is optional and is set only when that host was independently
// enrolled through the normal machine-agent workflow.
type CoreMember struct {
	AgentServerID    string           `json:"agentServerId,omitempty"`
	Endpoint         string           `json:"endpoint"`
	ID               string           `json:"id"`
	LastCheckpointAt *time.Time       `json:"lastCheckpointAt,omitempty"`
	Name             string           `json:"name"`
	ReplicaState     CoreReplicaState `json:"replicaState"`
	Role             CoreRole         `json:"role"`
}

type CoreHandoffState string

const (
	CoreHandoffPrepared CoreHandoffState = "prepared"
	CoreHandoffFenced   CoreHandoffState = "fenced"
)

// CoreHandoff is the durable handoff record copied with encrypted controller
// state. Promotion is deliberately manual and requires a stopped/fenced old
// primary; this record makes an accidental parallel active controller visible.
type CoreHandoff struct {
	FencedAt   *time.Time       `json:"fencedAt,omitempty"`
	FromID     string           `json:"fromId"`
	PreparedAt time.Time        `json:"preparedAt"`
	State      CoreHandoffState `json:"state"`
	ToID       string           `json:"toId"`
}

// CoreTopology is the non-secret control-plane placement projection returned
// by the API. Its Members are separate from /api/v1/servers by design.
type CoreTopology struct {
	ActiveID       string       `json:"activeId,omitempty"`
	AuthorityEpoch uint64       `json:"authorityEpoch"`
	ControlEnabled bool         `json:"controlEnabled"`
	Handoff        *CoreHandoff `json:"handoff,omitempty"`
	LocalID        string       `json:"localId"`
	LocalRole      CoreRole     `json:"localRole"`
	Members        []CoreMember `json:"members"`
}
