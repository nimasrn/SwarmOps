// Package coretopology owns SwarmOps control-plane placement. It deliberately
// does not create Docker targets, install host software, or contact a peer:
// those concerns stay behind independently enrolled machine agents and a
// reviewed backup/restore workflow.
package coretopology

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const (
	stateKey     = "core-topology"
	storeVersion = 1
)

var coreIDPattern = regexp.MustCompile(`^core-[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

// ErrStandby is returned when a replica tries to change agent or cluster
// state. A standby exposes status and can be promoted, but it never acts on
// managed servers until it becomes the declared active core.
var ErrStandby = errors.New("this control-plane replica is standby")

type Config struct {
	Endpoint string
	ID       string
	Mode     domain.CoreRole
	Name     string
}

type ReplicaInput struct {
	AgentServerID string
	Endpoint      string
	ID            string
	Name          string
}

type stateFile struct {
	ActiveID       string              `json:"activeId,omitempty"`
	AuthorityEpoch uint64              `json:"authorityEpoch"`
	Handoff        *domain.CoreHandoff `json:"handoff,omitempty"`
	Members        []domain.CoreMember `json:"members"`
	Version        int                 `json:"version"`
}

// Store stores only public placement metadata under the controller's existing
// sealed data directory. The encrypted controller state itself must still be
// copied and restore-tested by the operator; this metadata never pretends to
// perform that transfer over an unpinned peer connection.
type Store struct {
	config Config
	now    func() time.Time
	path   string
	sealer *securestore.Sealer
	state  stateFile
	mu     sync.RWMutex
}

func Open(dataDir string, dataEncryptionKey []byte, config Config) (*Store, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("core topology data directory is required")
	}
	config, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure encrypted core topology: %w", err)
	}
	store := &Store{
		config: config,
		now:    time.Now,
		path:   filepath.Join(dataDir, "core-topology.sealed"),
		sealer: sealer,
	}
	data, err := sealer.ReadFile(store.path, stateKey)
	if errors.Is(err, os.ErrNotExist) {
		store.state = stateFile{AuthorityEpoch: 1, Version: storeVersion, Members: []domain.CoreMember{newLocalMember(config)}}
		if config.Mode == domain.CoreRoleActive {
			store.state.ActiveID = config.ID
		}
		if err := store.saveLocked(); err != nil {
			return nil, fmt.Errorf("initialize core topology: %w", err)
		}
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read core topology: %w", err)
	}
	if err := json.Unmarshal(data, &store.state); err != nil {
		return nil, fmt.Errorf("decode core topology: %w", err)
	}
	if err := validateState(store.state); err != nil {
		return nil, fmt.Errorf("decode core topology: %w", err)
	}
	if store.state.AuthorityEpoch == 0 {
		// Forward-compatible migration for stores created before authority epochs
		// were part of the topology contract.
		store.state.AuthorityEpoch = 1
		if err := store.saveLocked(); err != nil {
			return nil, fmt.Errorf("migrate core authority epoch: %w", err)
		}
	}
	if !store.hasMemberLocked(config.ID) {
		// A copied encrypted state may be opened by a pre-registered standby.
		// If an operator forgot to register it first, record it as a standby
		// rather than trusting a local environment flag to become active.
		store.state.Members = append(store.state.Members, domain.CoreMember{
			Endpoint:     config.Endpoint,
			ID:           config.ID,
			Name:         config.Name,
			ReplicaState: domain.CoreReplicaAwaitingRestore,
			Role:         domain.CoreRoleStandby,
		})
		if err := store.saveLocked(); err != nil {
			return nil, fmt.Errorf("register local standby: %w", err)
		}
	}
	return store, nil
}

func (s *Store) Status() domain.CoreTopology {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.statusLocked()
}

func (s *Store) CanManage() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.canManageLocked()
}

func (s *Store) AuthorityEpoch() uint64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.state.AuthorityEpoch == 0 {
		return 1
	}
	return s.state.AuthorityEpoch
}

func (s *Store) AddReplica(input ReplicaInput) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManageLocked() {
		return domain.CoreTopology{}, ErrStandby
	}
	member, err := normalizeReplica(input)
	if err != nil {
		return domain.CoreTopology{}, err
	}
	if s.hasMemberLocked(member.ID) {
		return domain.CoreTopology{}, fmt.Errorf("a core member with this identifier already exists")
	}
	s.state.Members = append(s.state.Members, member)
	if err := s.saveLocked(); err != nil {
		s.state.Members = s.state.Members[:len(s.state.Members)-1]
		return domain.CoreTopology{}, fmt.Errorf("save core replica: %w", err)
	}
	return s.statusLocked(), nil
}

// VerifyReplica records an operator-attested completed encrypted-state restore.
// It intentionally does not imply a live remote probe, a backup restore test,
// or that a separate data-encryption key was transferred safely.
func (s *Store) VerifyReplica(id string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManageLocked() {
		return domain.CoreTopology{}, ErrStandby
	}
	index := s.memberIndexLocked(id)
	if index < 0 || s.state.Members[index].Role != domain.CoreRoleStandby {
		return domain.CoreTopology{}, fmt.Errorf("standby core member was not found")
	}
	now := s.now().UTC()
	previous := s.state.Members[index]
	s.state.Members[index].ReplicaState = domain.CoreReplicaVerified
	s.state.Members[index].LastCheckpointAt = &now
	if err := s.saveLocked(); err != nil {
		s.state.Members[index] = previous
		return domain.CoreTopology{}, fmt.Errorf("save core replica verification: %w", err)
	}
	return s.statusLocked(), nil
}

// PrepareHandoff records the intended target before the operator takes the
// final encrypted-state backup. It leaves the active core writable so the
// operator can still abandon the plan without an outage.
func (s *Store) PrepareHandoff(targetID string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManageLocked() {
		return domain.CoreTopology{}, ErrStandby
	}
	index := s.memberIndexLocked(targetID)
	if index < 0 || s.state.Members[index].Role != domain.CoreRoleStandby || s.state.Members[index].ReplicaState != domain.CoreReplicaVerified {
		return domain.CoreTopology{}, fmt.Errorf("choose a verified standby core member")
	}
	if s.state.Handoff != nil {
		return domain.CoreTopology{}, fmt.Errorf("a core handoff is already in progress")
	}
	s.state.Handoff = &domain.CoreHandoff{
		FromID:     s.config.ID,
		PreparedAt: s.now().UTC(),
		State:      domain.CoreHandoffPrepared,
		ToID:       targetID,
	}
	if err := s.saveLocked(); err != nil {
		s.state.Handoff = nil
		return domain.CoreTopology{}, fmt.Errorf("save core handoff: %w", err)
	}
	return s.statusLocked(), nil
}

// FenceForHandoff makes this local core a standby only after a prepared
// handoff. The target must receive a final encrypted-state copy after this
// state is written; only then can it promote itself without split brain.
func (s *Store) FenceForHandoff(targetID string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.canManageLocked() {
		return domain.CoreTopology{}, ErrStandby
	}
	if s.state.Handoff == nil || s.state.Handoff.State != domain.CoreHandoffPrepared || s.state.Handoff.FromID != s.config.ID || s.state.Handoff.ToID != targetID {
		return domain.CoreTopology{}, fmt.Errorf("there is no prepared handoff for this core member")
	}
	localIndex := s.memberIndexLocked(s.config.ID)
	if localIndex < 0 {
		return domain.CoreTopology{}, fmt.Errorf("local core member was not found")
	}
	now := s.now().UTC()
	previousActiveID := s.state.ActiveID
	previousRole := s.state.Members[localIndex].Role
	previousHandoff := cloneHandoff(s.state.Handoff)
	s.state.ActiveID = ""
	s.state.Members[localIndex].Role = domain.CoreRoleStandby
	s.state.Handoff.State = domain.CoreHandoffFenced
	s.state.Handoff.FencedAt = &now
	if err := s.saveLocked(); err != nil {
		s.state.ActiveID = previousActiveID
		s.state.Members[localIndex].Role = previousRole
		s.state.Handoff = previousHandoff
		return domain.CoreTopology{}, fmt.Errorf("fence primary core: %w", err)
	}
	return s.statusLocked(), nil
}

// PromoteLocal turns this explicitly configured standby into the one active
// core. A planned promotion needs the fenced handoff copied to this host; an
// emergency promotion is deliberately separate so its operator acknowledgement
// can be written to the audit trail by the HTTP boundary.
func (s *Store) PromoteLocal(emergency bool) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	localIndex := s.memberIndexLocked(s.config.ID)
	if localIndex < 0 || s.state.Members[localIndex].Role != domain.CoreRoleStandby {
		return domain.CoreTopology{}, fmt.Errorf("this core instance is not a standby member")
	}
	if s.state.Handoff != nil && s.state.Handoff.State == domain.CoreHandoffFenced && s.state.Handoff.ToID == s.config.ID {
		// Planned handoff: the active primary already wrote its own fenced
		// state, then that exact state was restored here.
	} else if !emergency {
		return domain.CoreTopology{}, fmt.Errorf("a fenced handoff to this core is required for planned promotion")
	}
	previous := cloneState(s.state)
	if activeIndex := s.memberIndexLocked(s.state.ActiveID); activeIndex >= 0 {
		s.state.Members[activeIndex].Role = domain.CoreRoleStandby
	}
	s.state.ActiveID = s.config.ID
	s.state.AuthorityEpoch++
	s.state.Members[localIndex].Role = domain.CoreRoleActive
	s.state.Members[localIndex].ReplicaState = domain.CoreReplicaVerified
	s.state.Handoff = nil
	if err := s.saveLocked(); err != nil {
		s.state = previous
		return domain.CoreTopology{}, fmt.Errorf("promote standby core: %w", err)
	}
	return s.statusLocked(), nil
}

func (s *Store) statusLocked() domain.CoreTopology {
	members := cloneState(s.state).Members
	sort.Slice(members, func(left, right int) bool {
		if members[left].Role == members[right].Role {
			return members[left].Name < members[right].Name
		}
		return members[left].Role == domain.CoreRoleActive
	})
	return domain.CoreTopology{
		ActiveID:       s.state.ActiveID,
		AuthorityEpoch: s.state.AuthorityEpoch,
		ControlEnabled: s.canManageLocked(),
		Handoff:        cloneHandoff(s.state.Handoff),
		LocalID:        s.config.ID,
		LocalRole:      s.localRoleLocked(),
		Members:        members,
	}
}

func (s *Store) canManageLocked() bool {
	return s.state.ActiveID == s.config.ID && s.localRoleLocked() == domain.CoreRoleActive
}

func (s *Store) localRoleLocked() domain.CoreRole {
	if index := s.memberIndexLocked(s.config.ID); index >= 0 {
		return s.state.Members[index].Role
	}
	return domain.CoreRoleStandby
}

func (s *Store) memberIndexLocked(id string) int {
	for index := range s.state.Members {
		if s.state.Members[index].ID == id {
			return index
		}
	}
	return -1
}

func (s *Store) hasMemberLocked(id string) bool { return s.memberIndexLocked(id) >= 0 }

func (s *Store) saveLocked() error {
	data, err := json.MarshalIndent(s.state, "", "  ")
	if err != nil {
		return fmt.Errorf("encode core topology: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, stateKey, append(data, '\n')); err != nil {
		return err
	}
	return nil
}

func normalizeConfig(input Config) (Config, error) {
	input.ID = strings.TrimSpace(input.ID)
	if input.ID == "" {
		input.ID = "core-local"
	}
	input.Name = strings.TrimSpace(input.Name)
	if input.Name == "" {
		input.Name = "SwarmOps control plane"
	}
	if !validCoreID(input.ID) {
		return Config{}, fmt.Errorf("invalid control-plane identifier")
	}
	if len(input.Name) > 96 || strings.ContainsAny(input.Name, "\r\n\x00") {
		return Config{}, fmt.Errorf("control-plane name must be between 1 and 96 characters")
	}
	if input.Mode == "" {
		input.Mode = domain.CoreRoleActive
	}
	if input.Mode != domain.CoreRoleActive && input.Mode != domain.CoreRoleStandby {
		return Config{}, fmt.Errorf("control-plane mode must be active or standby")
	}
	endpoint, err := normalizeEndpoint(input.Endpoint, true)
	if err != nil {
		return Config{}, err
	}
	input.Endpoint = endpoint
	return input, nil
}

func normalizeReplica(input ReplicaInput) (domain.CoreMember, error) {
	id := strings.TrimSpace(input.ID)
	if !validCoreID(id) {
		return domain.CoreMember{}, fmt.Errorf("invalid control-plane identifier")
	}
	name := strings.TrimSpace(input.Name)
	if len(name) == 0 || len(name) > 96 || strings.ContainsAny(name, "\r\n\x00") {
		return domain.CoreMember{}, fmt.Errorf("control-plane name must be between 1 and 96 characters")
	}
	endpoint, err := normalizeEndpoint(input.Endpoint, false)
	if err != nil {
		return domain.CoreMember{}, err
	}
	agentServerID := strings.TrimSpace(input.AgentServerID)
	if len(agentServerID) > 64 || strings.ContainsAny(agentServerID, "\r\n\x00") {
		return domain.CoreMember{}, fmt.Errorf("invalid linked agent server")
	}
	return domain.CoreMember{
		AgentServerID: agentServerID,
		Endpoint:      endpoint,
		ID:            id,
		Name:          name,
		ReplicaState:  domain.CoreReplicaAwaitingRestore,
		Role:          domain.CoreRoleStandby,
	}, nil
}

func newLocalMember(config Config) domain.CoreMember {
	state := domain.CoreReplicaAwaitingRestore
	if config.Mode == domain.CoreRoleActive {
		state = domain.CoreReplicaVerified
	}
	return domain.CoreMember{Endpoint: config.Endpoint, ID: config.ID, Name: config.Name, ReplicaState: state, Role: config.Mode}
}

func validateState(state stateFile) error {
	if state.Version != storeVersion || len(state.Members) == 0 {
		return fmt.Errorf("unsupported core topology version")
	}
	seen := map[string]bool{}
	activeCount := 0
	for _, member := range state.Members {
		if !validCoreID(member.ID) || seen[member.ID] {
			return fmt.Errorf("invalid core member")
		}
		seen[member.ID] = true
		if _, err := normalizeEndpoint(member.Endpoint, true); err != nil {
			return fmt.Errorf("invalid core member endpoint")
		}
		if member.Role != domain.CoreRoleActive && member.Role != domain.CoreRoleStandby {
			return fmt.Errorf("invalid core member role")
		}
		if member.ReplicaState != domain.CoreReplicaAwaitingRestore && member.ReplicaState != domain.CoreReplicaVerified {
			return fmt.Errorf("invalid core member replica state")
		}
		if member.Role == domain.CoreRoleActive {
			activeCount++
			if state.ActiveID != member.ID {
				return fmt.Errorf("active core member does not match active identifier")
			}
		}
	}
	if state.ActiveID != "" && !seen[state.ActiveID] {
		return fmt.Errorf("active core identifier was not found")
	}
	if state.ActiveID == "" && activeCount != 0 {
		return fmt.Errorf("active core member has no active identifier")
	}
	if state.ActiveID != "" && activeCount != 1 {
		return fmt.Errorf("core topology must have exactly one active member")
	}
	if state.Handoff != nil {
		if !seen[state.Handoff.FromID] || !seen[state.Handoff.ToID] || state.Handoff.FromID == state.Handoff.ToID {
			return fmt.Errorf("invalid core handoff")
		}
		if state.Handoff.State != domain.CoreHandoffPrepared && state.Handoff.State != domain.CoreHandoffFenced {
			return fmt.Errorf("invalid core handoff state")
		}
		if state.Handoff.PreparedAt.IsZero() || (state.Handoff.State == domain.CoreHandoffFenced && state.Handoff.FencedAt == nil) {
			return fmt.Errorf("invalid core handoff timing")
		}
	}
	return nil
}

func validCoreID(id string) bool { return coreIDPattern.MatchString(id) }

func normalizeEndpoint(value string, optional bool) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" && optional {
		return "", nil
	}
	parsed, err := url.Parse(value)
	if err != nil || parsed.Scheme == "" || parsed.Hostname() == "" || parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return "", fmt.Errorf("control-plane endpoint must be an absolute HTTPS origin")
	}
	if parsed.Scheme != "https" && !(parsed.Scheme == "http" && loopbackHost(parsed.Hostname())) {
		return "", fmt.Errorf("control-plane endpoint must use HTTPS outside loopback")
	}
	if parsed.Port() != "" {
		if _, err := net.LookupPort("tcp", parsed.Port()); err != nil {
			return "", fmt.Errorf("control-plane endpoint has an invalid port")
		}
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}

func loopbackHost(host string) bool {
	host = strings.Trim(strings.TrimSpace(host), "[]")
	if strings.EqualFold(host, "localhost") {
		return true
	}
	address, err := netip.ParseAddr(host)
	return err == nil && address.IsLoopback()
}

func cloneHandoff(input *domain.CoreHandoff) *domain.CoreHandoff {
	if input == nil {
		return nil
	}
	output := *input
	if input.FencedAt != nil {
		value := *input.FencedAt
		output.FencedAt = &value
	}
	return &output
}

func cloneState(input stateFile) stateFile {
	output := input
	output.Members = make([]domain.CoreMember, len(input.Members))
	copy(output.Members, input.Members)
	for index := range output.Members {
		if input.Members[index].LastCheckpointAt != nil {
			value := *input.Members[index].LastCheckpointAt
			output.Members[index].LastCheckpointAt = &value
		}
	}
	output.Handoff = cloneHandoff(input.Handoff)
	return output
}
