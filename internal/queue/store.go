// Package queue persists and schedules the narrow set of SwarmOps mutations.
// It is deliberately a single-controller queue: the API is a Swarm singleton
// backed by one named volume, so an atomic local snapshot avoids adding a
// second control plane or a general-purpose message broker.
package queue

import (
	"bytes"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	maxPayloadBytes  = 1 << 20
	maxAttemptsLimit = 8
	storeVersion     = 1
	stateKey         = "command-queue"
)

var commandIDPattern = regexp.MustCompile(`^cmd-[a-f0-9]{32}$`)

// ErrIdempotencyConflict means an operator reused a key for a different
// command. Returning the original command in that case could direct an
// operator to the wrong mutation, so callers must choose a new key instead.
var ErrIdempotencyConflict = errors.New("idempotency key belongs to a different command")

// Permanent marks an execution failure that must not be retried
// automatically. Its wrapped error is intentionally not persisted by Store.
type Permanent struct{ err error }

func (e *Permanent) Error() string { return e.err.Error() }
func (e *Permanent) Unwrap() error { return e.err }

func PermanentError(err error) error {
	if err == nil {
		return nil
	}
	return &Permanent{err: err}
}

func isPermanent(err error) bool {
	var value *Permanent
	return errors.As(err, &value)
}

// IsPermanent reports whether an execution failure was explicitly marked as
// never-retryable. Command classifiers and callers use it so an already
// classified outcome cannot be reinterpreted by later heuristics.
func IsPermanent(err error) bool { return isPermanent(err) }

type safeFailureCoder interface {
	SafeFailureCode() string
}

func safeFailureCode(err error) string {
	var value safeFailureCoder
	if errors.As(err, &value) {
		return value.SafeFailureCode()
	}
	return ""
}

// commandFailureDiagnostic converts locally generated execution errors into a
// bounded operator explanation. Raw remote output never enters the command
// ledger or browser, but the safe failure class and next action must survive.
func commandFailureDiagnostic(action string, err error) (code, summary, recovery string) {
	message := ""
	if err != nil {
		message = strings.ToLower(err.Error())
	}
	safeCode := safeFailureCode(err)
	switch {
	case strings.Contains(message, "command execution ended before completion") || strings.Contains(message, "core restarted while"):
		return "execution_interrupted", "The controller stopped before it could confirm the remote result.", "Verify the target's current state, then retry only if the intended change is still missing."
	case strings.Contains(message, "server is not connected") || strings.Contains(message, "select a connected server"):
		return "target_disconnected", "The selected server was not connected when execution started.", "Open Diagnostics, restore the agent connection, then retry this command."
	case action == "traefik.reconcile" && strings.Contains(message, "traefik acme email"):
		return "traefik_acme_email_required", "Traefik cannot be installed until a valid ACME contact email is configured.", "Open Gateway & ports, enter the ACME email under static settings, apply it, then retry the installation."
	case action == "traefik.reconcile" && strings.Contains(message, "external traefik overlay network"):
		return "traefik_network_required", "Traefik requires the external attachable overlay network named traefik.", "Open Docker resources and create the reviewed encrypted traefik overlay, then retry."
	case action == "traefik.reconcile" && strings.Contains(message, "nim.edge=true"):
		return "traefik_edge_label_required", "Traefik has no eligible manager because nim.edge=true is missing.", "Open Swarm & placement, label the reviewed manager nim.edge=true, then retry."
	case action == "traefik.reconcile" && strings.Contains(message, "dynamic config"):
		return "traefik_dynamic_config_required", "The reviewed Traefik dynamic config is missing.", "Create the configured dynamic Swarm config, then retry."
	case action == "traefik.reconcile" && strings.Contains(message, "dashboard") && strings.Contains(message, "secret"):
		return "traefik_dashboard_auth_required", "The Traefik dashboard-auth secret is missing.", "Create the configured htpasswd Swarm secret, then retry."
	case safeCode == "docker_ingress_network_missing":
		return "swarm_ingress_network_missing", "Docker has no swarm ingress network, so no service can publish a port.", "Recreate the ingress network on the manager (docker network create --driver overlay --ingress --subnet 10.0.0.0/24 --gateway 10.0.0.1 ingress), then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_network_missing":
		return "traefik_network_required", "Docker rejected the Traefik deployment because its required external overlay network is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_config_missing":
		return "traefik_config_required", "Docker rejected the Traefik deployment because a required external configuration is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_external_secret_missing":
		return "traefik_secret_required", "Docker rejected the Traefik deployment because a required external secret is missing.", "Open Gateway & ports, refresh Installation prerequisites, repair the missing resources, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_placement_unsatisfied":
		return "traefik_placement_unsatisfied", "Docker could not place the Traefik service on an eligible node.", "Open Swarm placement, verify a ready active manager has nim.edge=true and sufficient capacity, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_port_unavailable":
		return "traefik_port_unavailable", "Docker could not start Traefik because a configured gateway port is already in use.", "Inspect the selected manager for an existing gateway using ports 80 or 443, resolve the conflict, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_image_unavailable":
		return "traefik_image_unavailable", "The selected manager could not pull the reviewed Traefik image.", "Verify registry reachability and the configured immutable Traefik image, then retry."
	case action == "traefik.reconcile" && safeCode == "docker_command_timed_out":
		return "traefik_deploy_timed_out", "The Traefik deployment did not converge before the machine-agent deadline.", "Inspect the Traefik service tasks and manager capacity, confirm the intended stack state, then retry only if it is absent."
	case action == "traefik.reconcile" && safeCode == "docker_command_output_limit":
		return "traefik_deploy_output_limit", "The Traefik deployment produced more status output than the bounded machine-agent response allows.", "Inspect the Traefik service tasks for repeated failures, resolve them, then retry only if the stack is absent."
	case action == "traefik.reconcile" && safeCode == "docker_stack_deploy_failed":
		return "traefik_deploy_failed", "Docker rejected or failed to converge the reviewed Traefik stack.", "Inspect Traefik service tasks and the selected manager's current gateway state, resolve the reported Docker condition, then retry only if the stack is absent."
	case strings.Contains(message, "traefik singleton service was not found"):
		return "gateway_required", "The managed Traefik gateway is required before this stack can create private routes.", "Install and verify Traefik under Gateway, routes & DNS, then retry."
	case strings.Contains(message, "nim.stateful"):
		return "stateful_node_required", "No ready active node satisfies the required nim.stateful=true placement.", "Open Swarm, assign the stateful label to the reviewed node, then retry."
	// A policy refusal is not an unconfirmed change. This one fell through to
	// the default bucket and told operators "SwarmOps could not confirm that
	// the requested change completed", which sends them to inspect Docker —
	// where nothing is wrong, because the controller declined before it ever
	// spoke to a machine. It is also deterministic: retrying cannot help.
	case strings.Contains(message, "is not declared in the reviewed platform manifest"):
		return "stack_not_declared", "This stack name is not declared in the reviewed platform manifest.", "Add the stack to the manifest and restart the controller, or deploy an application whose slot the manifest already approves."
	case strings.Contains(message, "reviewed platform manifest"):
		return "platform_manifest_required", "This controller has no reviewed platform manifest, so it will not deploy a stack composed in a browser.", "Mount the reviewed manifest as SWARMOPS_PLATFORM_MANIFEST_FILE on the controller, or deploy through Apps → Deploy, which renders an approved application spec instead."
	case strings.Contains(message, "read trusted stack asset"):
		return "controller_asset_missing", "The controller's reviewed deployment asset is unavailable.", "Repair or update the controller installation before retrying."
	case strings.Contains(message, "config") && strings.Contains(message, "not found"):
		return "swarm_config_missing", "A required versioned Swarm configuration is missing.", "Repair the reviewed platform configurations, then retry the stack deployment."
	case action == "observability.core":
		return "observability_not_confirmed", "SwarmOps could not confirm the Prometheus, Alertmanager, and Jaeger deployment.", "Check the selected manager, Traefik gateway, stateful placement, and reviewed Swarm configs before retrying."
	default:
		return "execution_not_confirmed", "SwarmOps could not confirm that the requested change completed.", "Inspect the explicit target and current resource state before retrying."
	}
}

func setCommandFailureDiagnostic(command *domain.Command, err error) {
	command.FailureCode, command.FailureSummary, command.RecoveryHint = commandFailureDiagnostic(command.Action, err)
}

func clearCommandFailureDiagnostic(command *domain.Command) {
	command.FailureCode = ""
	command.FailureSummary = ""
	command.RecoveryHint = ""
}

// FenceAuthority prevents work accepted by an older Core epoch from crossing
// a promotion boundary. Records remain visible and can be explicitly retried
// under the new authority after the operator reviews the uncertain state.
func (s *Store) FenceAuthority(newEpoch uint64) error {
	if newEpoch == 0 {
		return fmt.Errorf("new authority epoch is required")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	changed := false
	for index := range s.records {
		command := &s.records[index].Command
		if command.AuthorityEpoch >= newEpoch || terminalCommandState(command.State) {
			continue
		}
		command.State = domain.CommandNeedsAttention
		command.LastError = "Core authority changed before this command reached a confirmed terminal state. Review and retry it explicitly."
		command.LeaseExpiresAt = nil
		command.NextAttemptAt = nil
		command.UpdatedAt = now
		changed = true
	}
	if !changed {
		return nil
	}
	return s.saveLocked()
}

func terminalCommandState(state domain.CommandState) bool {
	switch state {
	case domain.CommandSucceeded, domain.CommandFailed, domain.CommandNeedsAttention, domain.CommandSuperseded, domain.CommandCancelled:
		return true
	default:
		return false
	}
}

// SubmitInput is deliberately limited to safe command metadata. Any raw
// Compose document or build archive remains private to the queue store and is
// never copied into an audit record.
type SubmitInput struct {
	Action           string
	Actor            string
	AuthorityEpoch   uint64
	AutoRetry        bool
	ClusterID        string
	IdempotencyKey   string
	MaxArtifactBytes int64
	MaxAttempts      uint
	Payload          []byte
	RequestID        string
	ServerID         string
	Target           string
}

// Record is visible to the worker only. Handlers and API responses use the
// embedded public Command rather than returning Payload or artifact paths.
type Record struct {
	Artifact bool
	Command  domain.Command
	Payload  json.RawMessage
}

// Submission records the public result of a durable enqueue. Superseded holds
// only safe command metadata for audit; payloads and source artifacts never
// leave the encrypted queue store.
type Submission struct {
	Command    domain.Command
	Created    bool
	Superseded []domain.Command
}

type storedRecord struct {
	Artifact       bool            `json:"artifact,omitempty"`
	Command        domain.Command  `json:"command"`
	IdempotencyKey string          `json:"idempotencyKey,omitempty"`
	LeaseID        string          `json:"leaseId,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

// Lease is the private delivery envelope returned only to an authenticated
// pull-connected agent. LeaseID is a capability token and is never copied to
// the browser-facing Command record or audit history.
type Lease struct {
	LeaseID string
	Record  Record
}

type storeFile struct {
	Commands []storedRecord `json:"commands"`
	Version  int            `json:"version"`
}

// Store keeps the command ledger and any transient input artifacts under the
// controller's existing protected data directory. Every state transition is
// fsync'd and atomically renamed before an API success response is returned.
// Succeeded commands are pruned oldest-first beyond historyLimit so a
// long-lived controller keeps bounded memory, disk, and sealed rewrite cost;
// active commands are never pruned.
type Store struct {
	dir          string
	inputsDir    string
	historyLimit int
	now          func() time.Time
	path         string
	records      []storedRecord
	sealer       *securestore.Sealer
	mu           sync.Mutex
}

func Open(dataDir string, dataEncryptionKey []byte, historyLimit int) (*Store, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("command data directory is required")
	}
	if historyLimit < 1 {
		return nil, fmt.Errorf("command history limit must be positive")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure encrypted command store: %w", err)
	}
	dir := filepath.Join(dataDir, "commands")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create command directory: %w", err)
	}
	inputsDir := filepath.Join(dir, "inputs")
	if err := os.MkdirAll(inputsDir, 0o700); err != nil {
		return nil, fmt.Errorf("create command input directory: %w", err)
	}
	store := &Store{dir: dir, inputsDir: inputsDir, historyLimit: historyLimit, now: time.Now, path: filepath.Join(dir, "commands.sealed"), sealer: sealer}
	data, err := store.sealer.ReadFile(store.path, stateKey)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read command store: %w", err)
	}
	if !errors.Is(err, os.ErrNotExist) {
		var persisted storeFile
		if err := json.Unmarshal(data, &persisted); err != nil {
			return nil, fmt.Errorf("decode command store: %w", err)
		}
		if persisted.Version != storeVersion {
			return nil, fmt.Errorf("unsupported command store version")
		}
		for _, record := range persisted.Commands {
			if err := validateStored(record); err != nil {
				return nil, fmt.Errorf("decode command store: %w", err)
			}
		}
		store.records = persisted.Commands
	}
	if err := store.migrateLegacyArtifacts(); err != nil {
		return nil, err
	}
	if err := store.recover(); err != nil {
		return nil, err
	}
	return store, nil
}

// Submit persists a command before the worker is allowed to see it. A caller
// supplied idempotency key returns the original record, preventing a lost HTTP
// response from creating a second platform mutation.
func (s *Store) Submit(input SubmitInput) (domain.Command, bool, error) {
	submission, err := s.SubmitWithResult(input)
	return submission.Command, submission.Created, err
}

// SubmitWithResult makes the newest pending intent authoritative for one
// server/action/target tuple. A duplicate queued or retry-scheduled command is
// removed atomically with the replacement. Running commands and explicit
// needs-attention records are deliberately never cancelled: their remote
// effect may already exist and must remain visible to an operator.
func (s *Store) SubmitWithResult(input SubmitInput) (Submission, error) {
	if err := validateInput(input, false); err != nil {
		return Submission{}, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if command, found, err := s.idempotentLocked(input, false); err != nil {
		return Submission{}, err
	} else if found {
		return Submission{Command: command}, nil
	}
	record, err := s.newRecordLocked(input, false)
	if err != nil {
		return Submission{}, err
	}
	previous := append([]storedRecord(nil), s.records...)
	superseded, artifacts := s.supersedePendingLocked(input)
	s.records = append(s.records, record)
	// Pruning only ever removes terminal records. If this save fails the
	// in-memory ledger keeps the smaller history while the previous sealed
	// file still holds everything; the next successful transition persists
	// the same bounded result.
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		s.records = previous
		return Submission{}, err
	}
	for _, id := range artifacts {
		s.removeArtifact(id)
	}
	return Submission{Command: cloneCommand(record.Command), Created: true, Superseded: superseded}, nil
}

// SubmitArtifact writes source input to the protected command store before it
// changes a command from uploading to queued. A controller restart therefore
// leaves either a recoverable artifact or a visible needs-attention record;
// it never silently drops an accepted upload.
func (s *Store) SubmitArtifact(input SubmitInput, body io.Reader) (domain.Command, bool, error) {
	submission, err := s.SubmitArtifactWithResult(input, body)
	return submission.Command, submission.Created, err
}

// SubmitArtifactWithResult follows the same latest-intent rule while keeping
// source input private. The replacement is persisted before the old artifact
// is removed, so a controller restart cannot revive stale input.
func (s *Store) SubmitArtifactWithResult(input SubmitInput, body io.Reader) (Submission, error) {
	if err := validateInput(input, true); err != nil {
		return Submission{}, err
	}
	if body == nil {
		return Submission{}, fmt.Errorf("command artifact is required")
	}
	s.mu.Lock()
	if command, found, err := s.idempotentLocked(input, true); err != nil {
		s.mu.Unlock()
		return Submission{}, err
	} else if found {
		s.mu.Unlock()
		return Submission{Command: command}, nil
	}
	record, err := s.newRecordLocked(input, true)
	if err != nil {
		s.mu.Unlock()
		return Submission{}, err
	}
	record.Command.State = domain.CommandNeedsAttention
	record.Command.LastError = "Command input is being stored."
	previous := append([]storedRecord(nil), s.records...)
	superseded, artifacts := s.supersedePendingLocked(input)
	s.records = append(s.records, record)
	if err := s.saveLocked(); err != nil {
		s.records = previous
		s.mu.Unlock()
		return Submission{}, err
	}
	s.mu.Unlock()
	for _, id := range artifacts {
		s.removeArtifact(id)
	}

	writeErr := s.writeArtifact(record.Command.ID, body, input.MaxArtifactBytes)
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(record.Command.ID)
	if index < 0 {
		s.removeArtifact(record.Command.ID)
		return Submission{Command: cloneCommand(record.Command), Created: true, Superseded: superseded}, fmt.Errorf("command input was superseded while storing")
	}
	updated := &s.records[index]
	updated.Command.UpdatedAt = s.now().UTC()
	if writeErr != nil {
		updated.Command.State = domain.CommandNeedsAttention
		updated.Command.LastError = "Command input upload did not complete. Submit a new command with the source input."
		s.removeArtifact(record.Command.ID)
	} else {
		updated.Command.State = domain.CommandQueued
		updated.Command.LastError = ""
	}
	if err := s.saveLocked(); err != nil {
		return Submission{}, err
	}
	if writeErr != nil {
		return Submission{Command: cloneCommand(updated.Command), Created: true, Superseded: superseded}, fmt.Errorf("store command input: %w", writeErr)
	}
	return Submission{Command: cloneCommand(updated.Command), Created: true, Superseded: superseded}, nil
}

func (s *Store) List(limit int) ([]domain.Command, error) {
	if limit < 1 {
		return []domain.Command{}, nil
	}
	if limit > 500 {
		limit = 500
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	items := make([]domain.Command, 0, len(s.records))
	for _, record := range s.records {
		items = append(items, cloneCommand(record.Command))
	}
	sort.Slice(items, func(left, right int) bool {
		if items[left].UpdatedAt.Equal(items[right].UpdatedAt) {
			return items[left].ID > items[right].ID
		}
		return items[left].UpdatedAt.After(items[right].UpdatedAt)
	})
	if len(items) > limit {
		items = items[:limit]
	}
	return items, nil
}

// Writable verifies that the controller can create and remove a protected
// queue artifact before it acknowledges another durable command. It does not
// create a semantic command or reveal any existing private payload.
func (s *Store) Writable() error {
	if s == nil {
		return fmt.Errorf("command store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	temporary, err := os.CreateTemp(s.dir, ".command-write-check-*")
	if err != nil {
		return fmt.Errorf("open command store: %w", err)
	}
	path := temporary.Name()
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		_ = os.Remove(path)
		return fmt.Errorf("protect command write check: %w", err)
	}
	if err := temporary.Close(); err != nil {
		_ = os.Remove(path)
		return fmt.Errorf("close command write check: %w", err)
	}
	if err := os.Remove(path); err != nil {
		return fmt.Errorf("remove command write check: %w", err)
	}
	return nil
}

func (s *Store) Get(id string) (domain.Command, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	return cloneCommand(s.records[index].Command), nil
}

// RetryNow starts a new bounded attempt cycle only after an operator has
// explicitly acknowledged a terminal/uncertain outcome.
func (s *Store) RetryNow(id string, authorityEpoch uint64) (domain.Command, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.Command.State != domain.CommandNeedsAttention {
		return domain.Command{}, fmt.Errorf("command is not ready for an operator retry")
	}
	if authorityEpoch == 0 || authorityEpoch < record.Command.AuthorityEpoch {
		return domain.Command{}, fmt.Errorf("command retry authority epoch is stale")
	}
	now := s.now().UTC()
	previousAttempt := record.Command.Attempt
	previousAuthorityEpoch := record.Command.AuthorityEpoch
	previousError := record.Command.LastError
	previousFailureCode := record.Command.FailureCode
	previousFailureSummary := record.Command.FailureSummary
	previousLastAttemptAt := record.Command.LastAttemptAt
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousRecoveryHint := record.Command.RecoveryHint
	previousState := record.Command.State
	previousUpdatedAt := record.Command.UpdatedAt
	record.Command.Attempt = 0
	record.Command.AuthorityEpoch = authorityEpoch
	record.Command.LastError = ""
	clearCommandFailureDiagnostic(&record.Command)
	record.Command.LastAttemptAt = nil
	record.Command.NextAttemptAt = &now
	record.Command.State = domain.CommandQueued
	record.Command.UpdatedAt = now
	if err := s.saveLocked(); err != nil {
		record.Command.Attempt = previousAttempt
		record.Command.AuthorityEpoch = previousAuthorityEpoch
		record.Command.LastError = previousError
		record.Command.FailureCode = previousFailureCode
		record.Command.FailureSummary = previousFailureSummary
		record.Command.LastAttemptAt = previousLastAttemptAt
		record.Command.NextAttemptAt = previousNextAttemptAt
		record.Command.RecoveryHint = previousRecoveryHint
		record.Command.State = previousState
		record.Command.UpdatedAt = previousUpdatedAt
		return domain.Command{}, err
	}
	return cloneCommand(record.Command), nil
}

// ClaimDue marks the oldest runnable command as running. A single claim at a
// time intentionally serializes high-trust cluster mutations.
func (s *Store) ClaimDue() (Record, bool, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, record := range s.records {
		if record.Command.State == domain.CommandRunning {
			return Record{}, false, nil
		}
	}
	now := s.now().UTC()
	index := -1
	for current, record := range s.records {
		if record.Command.State != domain.CommandQueued && record.Command.State != domain.CommandRetryScheduled {
			continue
		}
		if record.Command.NextAttemptAt != nil && record.Command.NextAttemptAt.After(now) {
			continue
		}
		if index == -1 || record.Command.CreatedAt.Before(s.records[index].Command.CreatedAt) {
			index = current
		}
	}
	if index < 0 {
		return Record{}, false, nil
	}
	record := &s.records[index]
	previousAttempt := record.Command.Attempt
	previousLastAttemptAt := record.Command.LastAttemptAt
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousState := record.Command.State
	previousUpdatedAt := record.Command.UpdatedAt
	record.Command.Attempt++
	record.Command.LastAttemptAt = &now
	record.Command.NextAttemptAt = nil
	record.Command.State = domain.CommandRunning
	record.Command.UpdatedAt = now
	if err := s.saveLocked(); err != nil {
		// Without this rollback a failed durable write would leave a phantom
		// running command in memory that permanently blocks every later claim.
		record.Command.Attempt = previousAttempt
		record.Command.LastAttemptAt = previousLastAttemptAt
		record.Command.NextAttemptAt = previousNextAttemptAt
		record.Command.State = previousState
		record.Command.UpdatedAt = previousUpdatedAt
		return Record{}, false, err
	}
	return cloneRecord(*record), true, nil
}

// LeaseDue assigns the oldest runnable command for one explicit agent. It is
// the pull-transport counterpart to ClaimDue: the durable state is written
// before the command leaves Core, and only the matching lease capability can
// advance or finish it.
func (s *Store) LeaseDue(serverID string, authorityEpoch uint64, ttl time.Duration) (Lease, bool, error) {
	serverID = strings.TrimSpace(serverID)
	if serverID == "" || authorityEpoch == 0 {
		return Lease{}, false, fmt.Errorf("agent lease identity is invalid")
	}
	if ttl < 5*time.Second || ttl > 5*time.Minute {
		return Lease{}, false, fmt.Errorf("agent lease duration must be between five seconds and five minutes")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now().UTC()
	if err := s.expireLeasesLocked(now); err != nil {
		return Lease{}, false, err
	}
	for _, record := range s.records {
		if record.Command.ServerID == serverID && oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
			return Lease{}, false, nil
		}
	}
	index := -1
	for current, record := range s.records {
		if record.Command.ServerID != serverID || !oneOfCommandState(record.Command.State, domain.CommandQueued, domain.CommandRetryScheduled) {
			continue
		}
		if record.Command.NextAttemptAt != nil && record.Command.NextAttemptAt.After(now) {
			continue
		}
		if index == -1 || record.Command.CreatedAt.Before(s.records[index].Command.CreatedAt) {
			index = current
		}
	}
	if index < 0 {
		return Lease{}, false, nil
	}
	leaseID, err := newLeaseID()
	if err != nil {
		return Lease{}, false, err
	}
	record := &s.records[index]
	previous := *record
	expires := now.Add(ttl)
	record.Command.Attempt++
	record.Command.AuthorityEpoch = authorityEpoch
	record.Command.LastAttemptAt = &now
	record.Command.LeaseExpiresAt = &expires
	record.Command.NextAttemptAt = nil
	record.Command.State = domain.CommandLeased
	record.Command.UpdatedAt = now
	record.LeaseID = leaseID
	if err := s.saveLocked(); err != nil {
		*record = previous
		return Lease{}, false, err
	}
	return Lease{LeaseID: leaseID, Record: cloneRecord(*record)}, true, nil
}

// AdvanceLease records agent-side preprocessing or execution. State changes
// are monotonic and sequence-free here; the HTTP protocol adds ordered event
// cursors before invoking this store boundary.
func (s *Store) AdvanceLease(id, leaseID string, state domain.CommandState) (domain.Command, error) {
	if !oneOfCommandState(state, domain.CommandPreparing, domain.CommandRunning) {
		return domain.Command{}, fmt.Errorf("invalid leased command state")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.LeaseID == "" || subtleStringMismatch(record.LeaseID, leaseID) {
		return domain.Command{}, fmt.Errorf("command lease is invalid")
	}
	if state == domain.CommandPreparing && record.Command.State != domain.CommandLeased {
		return domain.Command{}, fmt.Errorf("command is not leased")
	}
	if state == domain.CommandRunning && !oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing) {
		return domain.Command{}, fmt.Errorf("command is not preparing")
	}
	previousState, previousUpdatedAt := record.Command.State, record.Command.UpdatedAt
	record.Command.State = state
	record.Command.UpdatedAt = s.now().UTC()
	if err := s.saveLocked(); err != nil {
		record.Command.State, record.Command.UpdatedAt = previousState, previousUpdatedAt
		return domain.Command{}, err
	}
	return cloneCommand(record.Command), nil
}

func (s *Store) RenewLease(id, leaseID string, ttl time.Duration) (domain.Command, error) {
	if ttl < 5*time.Second || ttl > 5*time.Minute {
		return domain.Command{}, fmt.Errorf("agent lease duration must be between five seconds and five minutes")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.LeaseID == "" || subtleStringMismatch(record.LeaseID, leaseID) || !oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
		return domain.Command{}, fmt.Errorf("command lease is invalid")
	}
	previous := record.Command.LeaseExpiresAt
	expires := s.now().UTC().Add(ttl)
	record.Command.LeaseExpiresAt = &expires
	if err := s.saveLocked(); err != nil {
		record.Command.LeaseExpiresAt = previous
		return domain.Command{}, err
	}
	return cloneCommand(record.Command), nil
}

func (s *Store) CompleteLease(id, leaseID string) (domain.Command, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.LeaseID == "" || subtleStringMismatch(record.LeaseID, leaseID) || !oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
		return domain.Command{}, fmt.Errorf("command lease is invalid")
	}
	previous := *record
	now := s.now().UTC()
	record.Command.LastError = ""
	clearCommandFailureDiagnostic(&record.Command)
	record.Command.LeaseExpiresAt = nil
	record.Command.NextAttemptAt = nil
	record.Command.State = domain.CommandSucceeded
	record.Command.UpdatedAt = now
	record.LeaseID = ""
	record.Payload = nil
	artifact := record.Artifact
	record.Artifact = false
	command := cloneCommand(record.Command)
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		*record = previous
		return domain.Command{}, err
	}
	if artifact {
		s.removeArtifact(id)
	}
	return command, nil
}

func (s *Store) FailLease(id, leaseID string, executionErr error) (domain.Command, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, "", fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.LeaseID == "" || subtleStringMismatch(record.LeaseID, leaseID) || !oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
		return domain.Command{}, "", fmt.Errorf("command lease is invalid")
	}
	previous := *record
	now := s.now().UTC()
	event := "needs_attention"
	if record.Command.AutoRetry && !isPermanent(executionErr) && record.Command.Attempt < record.Command.MaxAttempts {
		next := now.Add(backoff(record.Command.Attempt))
		record.Command.LastError = "Execution failed; retry scheduled with backoff."
		record.Command.NextAttemptAt = &next
		record.Command.State = domain.CommandRetryScheduled
		event = "retry_scheduled"
	} else {
		record.Command.LastError = "Execution did not complete; inspect the target before retrying."
		record.Command.NextAttemptAt = nil
		record.Command.State = domain.CommandNeedsAttention
	}
	setCommandFailureDiagnostic(&record.Command, executionErr)
	record.Command.LeaseExpiresAt = nil
	record.Command.UpdatedAt = now
	record.LeaseID = ""
	if err := s.saveLocked(); err != nil {
		*record = previous
		return domain.Command{}, "", err
	}
	return cloneCommand(record.Command), event, nil
}

func (s *Store) Complete(id string) (domain.Command, error) {
	s.mu.Lock()
	index := s.indexLocked(id)
	if index < 0 {
		s.mu.Unlock()
		return domain.Command{}, fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.Command.State != domain.CommandRunning {
		s.mu.Unlock()
		return domain.Command{}, fmt.Errorf("command is not running")
	}
	now := s.now().UTC()
	previousError := record.Command.LastError
	previousFailureCode := record.Command.FailureCode
	previousFailureSummary := record.Command.FailureSummary
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousLeaseExpiresAt := record.Command.LeaseExpiresAt
	previousRecoveryHint := record.Command.RecoveryHint
	previousState := record.Command.State
	previousUpdatedAt := record.Command.UpdatedAt
	previousPayload := record.Payload
	previousArtifact := record.Artifact
	record.Command.LastError = ""
	clearCommandFailureDiagnostic(&record.Command)
	record.Command.NextAttemptAt = nil
	record.Command.LeaseExpiresAt = nil
	record.Command.State = domain.CommandSucceeded
	record.Command.UpdatedAt = now
	// Successful commands retain their safe ledger metadata, never their raw
	// Compose input or build archive.
	record.Payload = nil
	artifact := record.Artifact
	record.Artifact = false
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		record.Command.LastError = previousError
		record.Command.FailureCode = previousFailureCode
		record.Command.FailureSummary = previousFailureSummary
		record.Command.NextAttemptAt = previousNextAttemptAt
		record.Command.LeaseExpiresAt = previousLeaseExpiresAt
		record.Command.RecoveryHint = previousRecoveryHint
		record.Command.State = previousState
		record.Command.UpdatedAt = previousUpdatedAt
		record.Payload = previousPayload
		record.Artifact = previousArtifact
		s.mu.Unlock()
		return domain.Command{}, err
	}
	command := cloneCommand(record.Command)
	s.mu.Unlock()
	if artifact {
		s.removeArtifact(id)
	}
	return command, nil
}

// Fail schedules a bounded exponential retry for reconcilable commands. It
// deliberately turns ambiguous/non-retryable outcomes into needs_attention so
// a forced restart or rollback is never silently executed twice.
func (s *Store) Fail(id string, executionErr error) (domain.Command, string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(id)
	if index < 0 {
		return domain.Command{}, "", fmt.Errorf("command not found")
	}
	record := &s.records[index]
	if record.Command.State != domain.CommandRunning {
		return domain.Command{}, "", fmt.Errorf("command is not running")
	}
	now := s.now().UTC()
	previousError := record.Command.LastError
	previousFailureCode := record.Command.FailureCode
	previousFailureSummary := record.Command.FailureSummary
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousLeaseExpiresAt := record.Command.LeaseExpiresAt
	previousState := record.Command.State
	previousRecoveryHint := record.Command.RecoveryHint
	previousUpdatedAt := record.Command.UpdatedAt
	event := "needs_attention"
	if record.Command.AutoRetry && !isPermanent(executionErr) && record.Command.Attempt < record.Command.MaxAttempts {
		next := now.Add(backoff(record.Command.Attempt))
		record.Command.LastError = "Execution failed; retry scheduled with backoff."
		record.Command.NextAttemptAt = &next
		record.Command.State = domain.CommandRetryScheduled
		event = "retry_scheduled"
	} else {
		record.Command.LastError = "Execution did not complete; inspect the target before retrying."
		record.Command.NextAttemptAt = nil
		record.Command.State = domain.CommandNeedsAttention
	}
	setCommandFailureDiagnostic(&record.Command, executionErr)
	record.Command.UpdatedAt = now
	record.Command.LeaseExpiresAt = nil
	record.LeaseID = ""
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		record.Command.LastError = previousError
		record.Command.FailureCode = previousFailureCode
		record.Command.FailureSummary = previousFailureSummary
		record.Command.NextAttemptAt = previousNextAttemptAt
		record.Command.LeaseExpiresAt = previousLeaseExpiresAt
		record.Command.State = previousState
		record.Command.RecoveryHint = previousRecoveryHint
		record.Command.UpdatedAt = previousUpdatedAt
		return domain.Command{}, "", err
	}
	return cloneCommand(record.Command), event, nil
}

func (s *Store) Artifact(id string) (io.ReadCloser, error) {
	s.mu.Lock()
	index := s.indexLocked(id)
	if index < 0 || !s.records[index].Artifact {
		s.mu.Unlock()
		return nil, fmt.Errorf("command input is unavailable")
	}
	s.mu.Unlock()
	present, err := s.encryptedArtifactPresent(id)
	if err != nil {
		return nil, fmt.Errorf("check encrypted command input: %w", err)
	}
	if !present {
		return nil, fmt.Errorf("command input is unavailable")
	}
	if err := s.sealer.VerifyReaderFile(s.artifactPath(id), s.artifactPurpose(id)); err != nil {
		return nil, fmt.Errorf("verify encrypted command input: %w", err)
	}
	artifact, err := s.sealer.OpenReaderFile(s.artifactPath(id), s.artifactPurpose(id))
	if err != nil {
		return nil, fmt.Errorf("open encrypted command input: %w", err)
	}
	return artifact, nil
}

func (s *Store) recover() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	changed := false
	now := s.now().UTC()
	for index := range s.records {
		record := &s.records[index]
		switch record.Command.State {
		case domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning:
			record.Command.State = domain.CommandNeedsAttention
			record.Command.LastError = "Core restarted while the command lease was in flight; the agent result must be reconciled before retrying."
			setCommandFailureDiagnostic(&record.Command, errors.New(record.Command.LastError))
			record.Command.LeaseExpiresAt = nil
			record.LeaseID = ""
			record.Command.NextAttemptAt = nil
			record.Command.UpdatedAt = now
			changed = true
		case domain.CommandNeedsAttention:
			if record.Artifact && record.Command.LastError == "Command input is being stored." {
				present, err := s.encryptedArtifactPresent(record.Command.ID)
				if err == nil && present {
					record.Command.State = domain.CommandQueued
					record.Command.LastError = ""
					record.Command.UpdatedAt = now
				} else {
					record.Command.LastError = "Command input upload did not complete. Submit a new command with the source input."
					record.Command.UpdatedAt = now
				}
				changed = true
			}
		}
	}
	if changed {
		if err := s.saveLocked(); err != nil {
			return fmt.Errorf("recover command store: %w", err)
		}
	}
	return nil
}

func (s *Store) newRecordLocked(input SubmitInput, artifact bool) (storedRecord, error) {
	id, err := newID()
	if err != nil {
		return storedRecord{}, err
	}
	now := s.now().UTC()
	return storedRecord{
		Artifact:       artifact,
		IdempotencyKey: strings.TrimSpace(input.IdempotencyKey),
		Payload:        append(json.RawMessage(nil), input.Payload...),
		Command: domain.Command{
			Action:         strings.TrimSpace(input.Action),
			Actor:          strings.TrimSpace(input.Actor),
			AuthorityEpoch: max(input.AuthorityEpoch, 1),
			AutoRetry:      input.AutoRetry,
			ClusterID:      valueOrDefault(input.ClusterID, "default"),
			CreatedAt:      now,
			ID:             id,
			MaxAttempts:    input.MaxAttempts,
			NodeID:         strings.TrimSpace(input.ServerID),
			RequestID:      strings.TrimSpace(input.RequestID),
			ServerID:       strings.TrimSpace(input.ServerID),
			State:          domain.CommandQueued,
			Target:         strings.TrimSpace(input.Target),
			UpdatedAt:      now,
		},
	}, nil
}

func (s *Store) idempotentLocked(input SubmitInput, artifact bool) (domain.Command, bool, error) {
	key := strings.TrimSpace(input.IdempotencyKey)
	for _, record := range s.records {
		if record.IdempotencyKey == key && record.Command.Actor == strings.TrimSpace(input.Actor) {
			if record.Artifact != artifact || record.Command.Action != strings.TrimSpace(input.Action) || record.Command.ServerID != strings.TrimSpace(input.ServerID) || record.Command.Target != strings.TrimSpace(input.Target) || !bytes.Equal(record.Payload, input.Payload) {
				return domain.Command{}, false, ErrIdempotencyConflict
			}
			return cloneCommand(record.Command), true, nil
		}
	}
	return domain.Command{}, false, nil
}

// supersedePendingLocked removes only work that has not begun. A running
// command is never erased or interrupted because the controller cannot know
// whether the remote side effect has already happened. A needs-attention
// command also remains until an operator explicitly retries or resolves it;
// the sole exception is an artifact still marked as uploading, which has not
// been eligible to execute yet.
func (s *Store) supersedePendingLocked(input SubmitInput) ([]domain.Command, []string) {
	action := strings.TrimSpace(input.Action)
	serverID := strings.TrimSpace(input.ServerID)
	target := strings.TrimSpace(input.Target)
	retained := make([]storedRecord, 0, len(s.records))
	superseded := make([]domain.Command, 0)
	artifacts := make([]string, 0)
	for _, record := range s.records {
		matches := record.Command.Action == action && record.Command.ServerID == serverID && record.Command.Target == target
		if matches && supersedable(record) {
			superseded = append(superseded, cloneCommand(record.Command))
			if record.Artifact {
				artifacts = append(artifacts, record.Command.ID)
			}
			continue
		}
		retained = append(retained, record)
	}
	s.records = retained
	return superseded, artifacts
}

func supersedable(record storedRecord) bool {
	switch record.Command.State {
	case domain.CommandQueued, domain.CommandRetryScheduled:
		return true
	case domain.CommandNeedsAttention:
		return record.Artifact && record.Command.LastError == "Command input is being stored."
	default:
		return false
	}
}

func (s *Store) indexLocked(id string) int {
	if !commandIDPattern.MatchString(strings.TrimSpace(id)) {
		return -1
	}
	for index, record := range s.records {
		if record.Command.ID == id {
			return index
		}
	}
	return -1
}

func (s *Store) artifactPath(id string) string {
	return filepath.Join(s.inputsDir, id+".input.sealed")
}

func (s *Store) legacyArtifactPath(id string) string {
	return filepath.Join(s.inputsDir, id+".input")
}

func (s *Store) artifactPurpose(id string) string {
	return "command-input:" + id
}

func (s *Store) writeArtifact(id string, body io.Reader, limit int64) error {
	if !commandIDPattern.MatchString(id) || limit < 1 {
		return fmt.Errorf("invalid command input")
	}
	if _, err := s.sealer.WriteReaderFile(s.artifactPath(id), s.artifactPurpose(id), body, limit); err != nil {
		return err
	}
	return nil
}

func (s *Store) migrateLegacyArtifacts() error {
	for _, record := range s.records {
		if !record.Artifact {
			continue
		}
		sealedPath := s.artifactPath(record.Command.ID)
		legacyPath := s.legacyArtifactPath(record.Command.ID)
		sealed, _, err := protectedArtifactFile(sealedPath)
		if err != nil {
			return fmt.Errorf("check encrypted command input: %w", err)
		}
		legacy, legacyInfo, err := protectedArtifactFile(legacyPath)
		if err != nil {
			return fmt.Errorf("check legacy command input: %w", err)
		}
		if sealed && legacy {
			return fmt.Errorf("legacy plaintext command input remains beside sealed state for %s", record.Command.ID)
		}
		if sealed {
			continue
		}
		if !legacy {
			continue
		}
		file, err := os.Open(legacyPath)
		if err != nil {
			return fmt.Errorf("open legacy command input: %w", err)
		}
		written, writeErr := s.sealer.WriteReaderFile(sealedPath, s.artifactPurpose(record.Command.ID), file, legacyInfo.Size())
		closeErr := file.Close()
		if writeErr != nil {
			return fmt.Errorf("seal legacy command input: %w", writeErr)
		}
		if closeErr != nil {
			return fmt.Errorf("close legacy command input: %w", closeErr)
		}
		if written != legacyInfo.Size() {
			return fmt.Errorf("seal legacy command input: copied %d bytes, expected %d", written, legacyInfo.Size())
		}
		if err := securestore.RemoveFile(legacyPath); err != nil {
			return fmt.Errorf("remove migrated plaintext command input: %w", err)
		}
	}
	legacyPaths, err := filepath.Glob(filepath.Join(s.inputsDir, "*.input"))
	if err != nil {
		return fmt.Errorf("check legacy command inputs: %w", err)
	}
	if len(legacyPaths) > 0 {
		return fmt.Errorf("legacy plaintext command input remains at %s", legacyPaths[0])
	}
	return nil
}

func (s *Store) encryptedArtifactPresent(id string) (bool, error) {
	present, _, err := protectedArtifactFile(s.artifactPath(id))
	return present, err
}

func (s *Store) removeArtifact(id string) {
	_ = os.Remove(s.artifactPath(id))
	_ = os.Remove(s.legacyArtifactPath(id))
}

func protectedArtifactFile(path string) (bool, os.FileInfo, error) {
	info, err := os.Lstat(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	if !info.Mode().IsRegular() || info.Mode().Perm()&0o077 != 0 {
		return false, nil, fmt.Errorf("command input must be a regular owner-only file")
	}
	return true, info, nil
}

func (s *Store) saveLocked() error {
	data, err := json.Marshal(storeFile{Commands: s.records, Version: storeVersion})
	if err != nil {
		return fmt.Errorf("encode command store: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, stateKey, data); err != nil {
		return fmt.Errorf("save encrypted command store: %w", err)
	}
	return nil
}

// pruneTerminalLocked drops the oldest succeeded commands once the terminal
// history exceeds the configured bound. Queued, running, retry-scheduled, and
// needs-attention commands are never removed, so pruning cannot lose pending
// work or an operator's explicit retry decision.
func (s *Store) pruneTerminalLocked() {
	total := 0
	for i := range s.records {
		if s.records[i].Command.State == domain.CommandSucceeded {
			total++
		}
	}
	excess := total - s.historyLimit
	if excess <= 0 {
		return
	}
	retained := make([]storedRecord, 0, len(s.records)-excess)
	for _, record := range s.records {
		if excess > 0 && record.Command.State == domain.CommandSucceeded {
			excess--
			continue
		}
		retained = append(retained, record)
	}
	s.records = retained
}

func validateInput(input SubmitInput, artifact bool) error {
	for name, value := range map[string]string{
		"action":    input.Action,
		"actor":     input.Actor,
		"server ID": input.ServerID,
		"target":    input.Target,
	} {
		if strings.TrimSpace(value) == "" || strings.ContainsAny(value, "\r\n\x00") {
			return fmt.Errorf("command %s is invalid", name)
		}
	}
	if len(input.Payload) > maxPayloadBytes || !json.Valid(input.Payload) {
		return fmt.Errorf("command payload is invalid")
	}
	if input.MaxAttempts < 1 || input.MaxAttempts > maxAttemptsLimit {
		return fmt.Errorf("command max attempts must be between 1 and %d", maxAttemptsLimit)
	}
	if key := strings.TrimSpace(input.IdempotencyKey); key == "" || len(key) > 128 || strings.ContainsAny(key, "\r\n\x00") {
		return fmt.Errorf("command idempotency key is invalid")
	}
	if artifact && input.MaxArtifactBytes < 1 {
		return fmt.Errorf("command artifact limit is invalid")
	}
	return nil
}

func validateStored(record storedRecord) error {
	if !commandIDPattern.MatchString(record.Command.ID) || record.Command.Action == "" || record.Command.Actor == "" || record.Command.ServerID == "" || record.Command.Target == "" {
		return fmt.Errorf("command has invalid fields")
	}
	if record.Command.MaxAttempts < 1 || record.Command.MaxAttempts > maxAttemptsLimit {
		return fmt.Errorf("command has invalid retry policy")
	}
	switch record.Command.State {
	case domain.CommandUploading, domain.CommandQueued, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning, domain.CommandRetryScheduled, domain.CommandSucceeded, domain.CommandFailed, domain.CommandNeedsAttention, domain.CommandSuperseded, domain.CommandCancelled:
	default:
		return fmt.Errorf("command has invalid state")
	}
	if len(record.Payload) > maxPayloadBytes || len(record.Payload) > 0 && !json.Valid(record.Payload) {
		return fmt.Errorf("command has invalid payload")
	}
	return nil
}

func cloneRecord(record storedRecord) Record {
	return Record{Artifact: record.Artifact, Command: cloneCommand(record.Command), Payload: append(json.RawMessage(nil), record.Payload...)}
}

func cloneCommand(command domain.Command) domain.Command {
	result := command
	if command.LastAttemptAt != nil {
		value := *command.LastAttemptAt
		result.LastAttemptAt = &value
	}
	if command.NextAttemptAt != nil {
		value := *command.NextAttemptAt
		result.NextAttemptAt = &value
	}
	if command.LeaseExpiresAt != nil {
		value := *command.LeaseExpiresAt
		result.LeaseExpiresAt = &value
	}
	return result
}

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate command ID: %w", err)
	}
	return "cmd-" + hex.EncodeToString(bytes), nil
}

func newLeaseID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate command lease: %w", err)
	}
	return "lease-" + hex.EncodeToString(bytes), nil
}

func oneOfCommandState(value domain.CommandState, choices ...domain.CommandState) bool {
	for _, choice := range choices {
		if value == choice {
			return true
		}
	}
	return false
}

func subtleStringMismatch(left, right string) bool {
	if len(left) != len(right) {
		return true
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) != 1
}

func valueOrDefault(value, fallback string) string {
	if value = strings.TrimSpace(value); value != "" {
		return value
	}
	return fallback
}

func (s *Store) expireLeasesLocked(now time.Time) error {
	changed := false
	for index := range s.records {
		record := &s.records[index]
		if !oneOfCommandState(record.Command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) || record.Command.LeaseExpiresAt == nil || record.Command.LeaseExpiresAt.After(now) {
			continue
		}
		record.LeaseID = ""
		record.Command.LeaseExpiresAt = nil
		record.Command.UpdatedAt = now
		if record.Command.AutoRetry && record.Command.Attempt < record.Command.MaxAttempts {
			next := now.Add(backoff(record.Command.Attempt))
			record.Command.NextAttemptAt = &next
			record.Command.State = domain.CommandRetryScheduled
			record.Command.LastError = "Agent lease expired; retry scheduled with backoff."
		} else {
			record.Command.NextAttemptAt = nil
			record.Command.State = domain.CommandNeedsAttention
			record.Command.LastError = "Agent lease expired with an uncertain remote outcome; reconcile the target before retrying."
		}
		changed = true
	}
	if changed {
		if err := s.saveLocked(); err != nil {
			return fmt.Errorf("expire command leases: %w", err)
		}
	}
	return nil
}

func backoff(attempt uint) time.Duration {
	// 2, 4, 8, 16, 32, 64 seconds, capped to keep an operator-visible command
	// responsive while still avoiding a tight retry loop.
	if attempt > 5 {
		attempt = 5
	}
	return time.Second * time.Duration(1<<attempt)
}

func syncDirectory(path string) error {
	directory, err := os.Open(path)
	if err != nil {
		return err
	}
	defer directory.Close()
	return directory.Sync()
}
