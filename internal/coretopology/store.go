// Package coretopology owns SwarmOps control-plane placement. It deliberately
// does not create Docker targets, install host software, or contact a peer:
// those concerns stay behind independently enrolled machine agents and a
// reviewed backup/restore workflow.
package coretopology

import (
	"context"
	"database/sql"
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
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

const (
	stateKey     = "core-topology"
	storeVersion = 1
	storeTimeout = 10 * time.Second
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

// Store keeps public placement metadata in the controller database. Every
// decision reads the current row set, and every change runs in a transaction
// that first locks the single core_authority row. Two core processes pointed
// at the same database therefore serialise on that lock: a fence or promotion
// one of them commits is what the other one reads next, and neither can act on
// a stale copy of who is active.
type Store struct {
	config Config
	db     *sqlstore.DB
	now    func() time.Time
	// state is the last topology read. It answers AuthorityEpoch when the
	// database is momentarily unreachable; CanManage never trusts it and fails
	// closed instead.
	state stateFile
	mu    sync.Mutex
}

func Open(db *sqlstore.DB, config Config) (*Store, error) {
	if db == nil {
		return nil, fmt.Errorf("core topology requires a database")
	}
	config, err := normalizeConfig(config)
	if err != nil {
		return nil, err
	}
	store := &Store{config: config, db: db, now: time.Now}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		state, found, err := loadState(ctx, tx, true)
		if err != nil {
			return err
		}
		if !found {
			state = stateFile{AuthorityEpoch: 1, Version: storeVersion, Members: []domain.CoreMember{newLocalMember(config)}}
			if config.Mode == domain.CoreRoleActive {
				state.ActiveID = config.ID
			}
			store.state = state
			return writeState(ctx, tx, state, true)
		}
		if err := validateState(state); err != nil {
			return fmt.Errorf("decode core topology: %w", err)
		}
		store.state = state
		if !store.hasMemberLocked(config.ID) {
			// A restored database may be opened by a pre-registered standby.
			// If an operator forgot to register it first, record it as a
			// standby rather than trusting a local environment flag to become
			// active.
			store.state.Members = append(store.state.Members, domain.CoreMember{
				Endpoint:     config.Endpoint,
				ID:           config.ID,
				Name:         config.Name,
				ReplicaState: domain.CoreReplicaAwaitingRestore,
				Role:         domain.CoreRoleStandby,
			})
			return writeState(ctx, tx, store.state, false)
		}
		return nil
	})
	if sqlstore.IsDuplicate(err) {
		// Another core initialised the singleton between our read and insert.
		return Open(db, config)
	}
	if err != nil {
		return nil, fmt.Errorf("open core topology: %w", err)
	}
	return store, nil
}

// refresh re-reads the topology without locking it.
func (s *Store) refresh() error {
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	state, found, err := loadState(ctx, s.db.Pool(), false)
	if err != nil {
		return err
	}
	if !found {
		return fmt.Errorf("core topology is not initialised")
	}
	s.state = state
	return nil
}

// transact runs one topology change against a freshly locked read. fn mutates
// s.state and returns a domain error to abort; the state it leaves is
// validated and written in the same transaction.
func (s *Store) transact(fn func() error) error {
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	return s.db.WithTx(ctx, func(tx *sql.Tx) error {
		state, found, err := loadState(ctx, tx, true)
		if err != nil {
			return err
		}
		if !found {
			return fmt.Errorf("core topology is not initialised")
		}
		s.state = state
		if err := fn(); err != nil {
			return err
		}
		if err := validateState(s.state); err != nil {
			return err
		}
		return writeState(ctx, tx, s.state, false)
	})
}

func (s *Store) Status() domain.CoreTopology {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.refresh(); err != nil {
		status := s.statusLocked()
		status.ControlEnabled = false
		return status
	}
	return s.statusLocked()
}

// CanManage reports whether this process is the declared active core. A
// database it cannot read is answered with "no": acting on managed servers
// without knowing the current authority is exactly the split brain the
// topology exists to prevent.
func (s *Store) CanManage() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.refresh(); err != nil {
		return false
	}
	return s.canManageLocked()
}

func (s *Store) AuthorityEpoch() uint64 {
	s.mu.Lock()
	defer s.mu.Unlock()
	_ = s.refresh()
	if s.state.AuthorityEpoch == 0 {
		return 1
	}
	return s.state.AuthorityEpoch
}

func (s *Store) AddReplica(input ReplicaInput) (domain.CoreTopology, error) {
	member, err := normalizeReplica(input)
	if err != nil {
		return domain.CoreTopology{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	err = s.transact(func() error {
		if !s.canManageLocked() {
			return ErrStandby
		}
		if s.hasMemberLocked(member.ID) {
			return fmt.Errorf("a core member with this identifier already exists")
		}
		s.state.Members = append(s.state.Members, member)
		return nil
	})
	if err != nil {
		return domain.CoreTopology{}, err
	}
	return s.statusLocked(), nil
}

// VerifyReplica records an operator-attested completed state restore. It
// intentionally does not imply a live remote probe, a backup restore test, or
// that a separate data-encryption key was transferred safely.
func (s *Store) VerifyReplica(id string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.transact(func() error {
		if !s.canManageLocked() {
			return ErrStandby
		}
		index := s.memberIndexLocked(id)
		if index < 0 || s.state.Members[index].Role != domain.CoreRoleStandby {
			return fmt.Errorf("standby core member was not found")
		}
		now := s.now().UTC().Truncate(time.Microsecond)
		s.state.Members[index].ReplicaState = domain.CoreReplicaVerified
		s.state.Members[index].LastCheckpointAt = &now
		return nil
	})
	if err != nil {
		return domain.CoreTopology{}, err
	}
	return s.statusLocked(), nil
}

// PrepareHandoff records the intended target before the operator takes the
// final state backup. It leaves the active core writable so the operator can
// still abandon the plan without an outage.
func (s *Store) PrepareHandoff(targetID string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.transact(func() error {
		if !s.canManageLocked() {
			return ErrStandby
		}
		index := s.memberIndexLocked(targetID)
		if index < 0 || s.state.Members[index].Role != domain.CoreRoleStandby || s.state.Members[index].ReplicaState != domain.CoreReplicaVerified {
			return fmt.Errorf("choose a verified standby core member")
		}
		if s.state.Handoff != nil {
			return fmt.Errorf("a core handoff is already in progress")
		}
		s.state.Handoff = &domain.CoreHandoff{
			FromID:     s.config.ID,
			PreparedAt: s.now().UTC().Truncate(time.Microsecond),
			State:      domain.CoreHandoffPrepared,
			ToID:       targetID,
		}
		return nil
	})
	if err != nil {
		return domain.CoreTopology{}, err
	}
	return s.statusLocked(), nil
}

// FenceForHandoff makes this local core a standby only after a prepared
// handoff. Once this commits, no process reading this database treats the old
// primary as active, so the target can promote itself without split brain.
func (s *Store) FenceForHandoff(targetID string) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.transact(func() error {
		if !s.canManageLocked() {
			return ErrStandby
		}
		if s.state.Handoff == nil || s.state.Handoff.State != domain.CoreHandoffPrepared || s.state.Handoff.FromID != s.config.ID || s.state.Handoff.ToID != targetID {
			return fmt.Errorf("there is no prepared handoff for this core member")
		}
		localIndex := s.memberIndexLocked(s.config.ID)
		if localIndex < 0 {
			return fmt.Errorf("local core member was not found")
		}
		now := s.now().UTC().Truncate(time.Microsecond)
		s.state.ActiveID = ""
		s.state.Members[localIndex].Role = domain.CoreRoleStandby
		s.state.Handoff.State = domain.CoreHandoffFenced
		s.state.Handoff.FencedAt = &now
		return nil
	})
	if err != nil {
		return domain.CoreTopology{}, err
	}
	return s.statusLocked(), nil
}

// PromoteLocal turns this explicitly configured standby into the one active
// core and increments the authority epoch. A planned promotion needs the
// fenced handoff; an emergency promotion is deliberately separate so its
// operator acknowledgement can be written to the audit trail by the HTTP
// boundary.
func (s *Store) PromoteLocal(emergency bool) (domain.CoreTopology, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	err := s.transact(func() error {
		localIndex := s.memberIndexLocked(s.config.ID)
		if localIndex < 0 || s.state.Members[localIndex].Role != domain.CoreRoleStandby {
			return fmt.Errorf("this core instance is not a standby member")
		}
		planned := s.state.Handoff != nil && s.state.Handoff.State == domain.CoreHandoffFenced && s.state.Handoff.ToID == s.config.ID
		if !planned && !emergency {
			return fmt.Errorf("a fenced handoff to this core is required for planned promotion")
		}
		if activeIndex := s.memberIndexLocked(s.state.ActiveID); activeIndex >= 0 {
			s.state.Members[activeIndex].Role = domain.CoreRoleStandby
		}
		s.state.ActiveID = s.config.ID
		s.state.AuthorityEpoch++
		s.state.Members[localIndex].Role = domain.CoreRoleActive
		s.state.Members[localIndex].ReplicaState = domain.CoreReplicaVerified
		s.state.Handoff = nil
		return nil
	})
	if err != nil {
		return domain.CoreTopology{}, err
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

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

// loadState reads the authority singleton, the members in their recorded
// order, and any handoff. lock takes the authority row FOR UPDATE, which is the
// lock every topology change serialises on.
func loadState(ctx context.Context, q queryer, lock bool) (stateFile, bool, error) {
	suffix := ""
	if lock {
		suffix = " FOR UPDATE"
	}
	state := stateFile{Version: storeVersion}
	var activeID sql.NullString
	err := q.QueryRowContext(ctx, "SELECT active_id, authority_epoch FROM core_authority WHERE id = 1"+suffix).Scan(&activeID, &state.AuthorityEpoch)
	if errors.Is(err, sql.ErrNoRows) {
		return stateFile{}, false, nil
	}
	if err != nil {
		return stateFile{}, false, err
	}
	state.ActiveID = activeID.String
	rows, err := q.QueryContext(ctx, `SELECT id, name, endpoint, role, replica_state, agent_server_id, last_checkpoint_at
		FROM core_members ORDER BY position`)
	if err != nil {
		return stateFile{}, false, err
	}
	for rows.Next() {
		var member domain.CoreMember
		var role, replicaState string
		var agentServerID sql.NullString
		var checkpoint sql.NullTime
		if err := rows.Scan(&member.ID, &member.Name, &member.Endpoint, &role, &replicaState, &agentServerID, &checkpoint); err != nil {
			_ = rows.Close()
			return stateFile{}, false, err
		}
		member.Role, member.ReplicaState, member.AgentServerID = domain.CoreRole(role), domain.CoreReplicaState(replicaState), agentServerID.String
		if checkpoint.Valid {
			value := checkpoint.Time
			member.LastCheckpointAt = &value
		}
		state.Members = append(state.Members, member)
	}
	if err := rows.Close(); err != nil {
		return stateFile{}, false, err
	}
	var handoff domain.CoreHandoff
	var handoffState string
	var fenced sql.NullTime
	err = q.QueryRowContext(ctx, "SELECT from_id, to_id, state, prepared_at, fenced_at FROM core_handoffs WHERE id = 1").
		Scan(&handoff.FromID, &handoff.ToID, &handoffState, &handoff.PreparedAt, &fenced)
	if err == nil {
		handoff.State = domain.CoreHandoffState(handoffState)
		if fenced.Valid {
			value := fenced.Time
			handoff.FencedAt = &value
		}
		state.Handoff = &handoff
	} else if !errors.Is(err, sql.ErrNoRows) {
		return stateFile{}, false, err
	}
	return state, true, nil
}

// writeState replaces the topology rows with state inside the caller's
// transaction. The handoff goes first because it references members.
func writeState(ctx context.Context, tx *sql.Tx, state stateFile, create bool) error {
	now := time.Now().UTC()
	if create {
		if _, err := tx.ExecContext(ctx, "INSERT INTO core_authority (id, active_id, authority_epoch, updated_at) VALUES (1, ?, ?, ?)",
			nullable(state.ActiveID), state.AuthorityEpoch, now); err != nil {
			return err
		}
	} else if _, err := tx.ExecContext(ctx, "UPDATE core_authority SET active_id = ?, authority_epoch = ?, updated_at = ? WHERE id = 1",
		nullable(state.ActiveID), state.AuthorityEpoch, now); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM core_handoffs"); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM core_members"); err != nil {
		return err
	}
	for position, member := range state.Members {
		var checkpoint sql.NullTime
		if member.LastCheckpointAt != nil {
			checkpoint = sql.NullTime{Time: member.LastCheckpointAt.UTC(), Valid: true}
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO core_members (id, name, endpoint, role, replica_state, agent_server_id, last_checkpoint_at, position)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, member.ID, member.Name, member.Endpoint, string(member.Role), string(member.ReplicaState),
			nullable(member.AgentServerID), checkpoint, position); err != nil {
			return err
		}
	}
	if state.Handoff != nil {
		var fenced sql.NullTime
		if state.Handoff.FencedAt != nil {
			fenced = sql.NullTime{Time: state.Handoff.FencedAt.UTC(), Valid: true}
		}
		if _, err := tx.ExecContext(ctx, "INSERT INTO core_handoffs (id, from_id, to_id, state, prepared_at, fenced_at) VALUES (1, ?, ?, ?, ?, ?)",
			state.Handoff.FromID, state.Handoff.ToID, string(state.Handoff.State), state.Handoff.PreparedAt.UTC(), fenced); err != nil {
			return err
		}
	}
	return nil
}

func nullable(value string) sql.NullString { return sql.NullString{String: value, Valid: value != ""} }

// ImportFiles copies a pre-database core-topology.sealed file into the
// database, replacing any topology already there, and reports how many members
// it held. Run it before the controller first opens the database. The file is
// kept as the backup.
func ImportFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "core-topology.sealed"), stateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read core topology: %w", err)
	}
	var state stateFile
	if err := json.Unmarshal(data, &state); err != nil {
		return 0, fmt.Errorf("decode core topology: %w", err)
	}
	if state.AuthorityEpoch == 0 {
		// Stores created before authority epochs were part of the contract.
		state.AuthorityEpoch = 1
	}
	if err := validateState(state); err != nil {
		return 0, fmt.Errorf("decode core topology: %w", err)
	}
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		_, found, err := loadState(ctx, tx, true)
		if err != nil {
			return err
		}
		return writeState(ctx, tx, state, !found)
	})
	if err != nil {
		return 0, fmt.Errorf("import core topology: %w", err)
	}
	return len(state.Members), nil
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
