// Package queue persists and schedules the narrow set of SwarmOps mutations.
// The ledger lives in the controller database: a command row is committed
// before any worker or agent may see it, and every state transition is a
// conditional update inside a transaction. Transient build inputs stay as
// sealed files beside the controller, referenced from their command row.
package queue

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

const (
	maxPayloadBytes  = 1 << 20
	maxAttemptsLimit = 8
	storeVersion     = 1
	stateKey         = "command-queue"
	storeTimeout     = 15 * time.Second
)

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
// leave the queue store.
type Submission struct {
	Command    domain.Command
	Created    bool
	Superseded []domain.Command
}

// Lease is the private delivery envelope returned only to an authenticated
// pull-connected agent. LeaseID is a capability token and is never copied to
// the browser-facing Command record or audit history.
type Lease struct {
	LeaseID string
	Record  Record
}

// Store is the command ledger. Succeeded commands are pruned oldest-first
// beyond historyLimit so the table stays bounded; active commands are never
// pruned. mu guards only the logger: scheduling correctness comes from row
// locks, so it holds across controller processes sharing the database.
type Store struct {
	db           *sqlstore.DB
	dir          string
	inputsDir    string
	historyLimit int
	log          *slog.Logger
	now          func() time.Time
	sealer       *securestore.Sealer
	mu           sync.Mutex
}

// commandRow is one ledger row with the private columns the public Command
// does not carry.
type commandRow struct {
	artifact       bool
	command        domain.Command
	idempotencyKey string
	leaseID        string
	payloadDigest  string
}

const commandColumns = `id, action, actor, server_id, node_id, cluster_id, target, state, attempt, max_attempts, auto_retry,
	authority_epoch, request_id, idempotency_key, payload_digest, has_artifact, lease_id, lease_expires_at, last_attempt_at,
	next_attempt_at, last_error, failure_code, failure_summary, recovery_hint, created_at, updated_at`

// Open binds the ledger to the controller database. dataDir holds only the
// sealed build inputs that are too large for a row. Open does not reclaim
// in-flight work: only the active controller may do that, through Recover.
func Open(db *sqlstore.DB, dataDir string, dataEncryptionKey []byte, historyLimit int) (*Store, error) {
	if db == nil {
		return nil, fmt.Errorf("command store requires a database")
	}
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("command data directory is required")
	}
	if historyLimit < 1 {
		return nil, fmt.Errorf("command history limit must be positive")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure encrypted command inputs: %w", err)
	}
	dir := filepath.Join(dataDir, "commands")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return nil, fmt.Errorf("create command directory: %w", err)
	}
	inputsDir := filepath.Join(dir, "inputs")
	if err := os.MkdirAll(inputsDir, 0o700); err != nil {
		return nil, fmt.Errorf("create command input directory: %w", err)
	}
	store := &Store{db: db, dir: dir, inputsDir: inputsDir, historyLimit: historyLimit, now: time.Now, sealer: sealer}
	if err := store.migrateLegacyArtifacts(); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) timestamp() time.Time { return s.now().UTC().Truncate(time.Microsecond) }

func (s *Store) context() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), storeTimeout)
}

func payloadPurpose(id string) string { return sqlstore.Purpose("command_payloads", "payload_sealed", id) }
func outputPurpose(id string) string  { return sqlstore.Purpose("command_outputs", "output_sealed", id) }

// FenceAuthority prevents work accepted by an older Core epoch from crossing
// a promotion boundary. Records remain visible and can be explicitly retried
// under the new authority after the operator reviews the uncertain state.
func (s *Store) FenceAuthority(newEpoch uint64) error {
	if newEpoch == 0 {
		return fmt.Errorf("new authority epoch is required")
	}
	ctx, cancel := s.context()
	defer cancel()
	_, err := s.db.Pool().ExecContext(ctx, `UPDATE commands SET state = ?, last_error = ?, lease_expires_at = NULL, next_attempt_at = NULL, updated_at = ?
		WHERE authority_epoch < ? AND state NOT IN (?, ?, ?, ?, ?)`,
		string(domain.CommandNeedsAttention), "Core authority changed before this command reached a confirmed terminal state. Review and retry it explicitly.",
		s.timestamp(), newEpoch, string(domain.CommandSucceeded), string(domain.CommandFailed), string(domain.CommandNeedsAttention),
		string(domain.CommandSuperseded), string(domain.CommandCancelled))
	if err != nil {
		return fmt.Errorf("fence command authority: %w", err)
	}
	return nil
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
// removed in the same transaction as the replacement is inserted. Running
// commands and explicit needs-attention records are deliberately never
// cancelled: their remote effect may already exist and must remain visible.
func (s *Store) SubmitWithResult(input SubmitInput) (Submission, error) {
	if err := validateInput(input, false); err != nil {
		return Submission{}, err
	}
	return s.submit(input, true)
}

// SubmitInTx enqueues a command inside a transaction the caller owns. The
// command commits or rolls back together with the caller's own writes, which
// is the transactional outbox the commerce layer provisions through: a wallet
// charge and the deployment it paid for can never exist one without the other.
// After its transaction commits, the caller passes the returned ids to
// ForgetInputs so superseded build inputs leave the disk too.
func (s *Store) SubmitInTx(ctx context.Context, tx *sql.Tx, input SubmitInput) (Submission, []string, error) {
	if err := validateInput(input, false); err != nil {
		return Submission{}, nil, err
	}
	return s.submitTx(ctx, tx, input)
}

// ForgetInputs removes the sealed input files of commands that left the ledger
// in a transaction that has now committed.
func (s *Store) ForgetInputs(ids []string) {
	for _, id := range ids {
		s.removeArtifact(id)
	}
}

func (s *Store) submitTx(ctx context.Context, tx *sql.Tx, input SubmitInput) (Submission, []string, error) {
	if command, found, err := idempotentTx(ctx, tx, input, false); err != nil {
		return Submission{}, nil, err
	} else if found {
		return Submission{Command: command}, nil, nil
	}
	record, err := s.newRecord(input, false)
	if err != nil {
		return Submission{}, nil, err
	}
	superseded, artifacts, err := supersedeTx(ctx, tx, input)
	if err != nil {
		return Submission{}, nil, err
	}
	if err := s.insertTx(ctx, tx, record, input.Payload); err != nil {
		return Submission{}, nil, err
	}
	pruned, err := s.pruneTx(ctx, tx)
	if err != nil {
		return Submission{}, nil, err
	}
	return Submission{Command: cloneCommand(record.command), Created: true, Superseded: superseded}, append(artifacts, pruned...), nil
}

func (s *Store) submit(input SubmitInput, retryDuplicate bool) (Submission, error) {
	ctx, cancel := s.context()
	defer cancel()
	var submission Submission
	var cleanup []string
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		var err error
		submission, cleanup, err = s.submitTx(ctx, tx, input)
		return err
	})
	if sqlstore.IsDuplicate(err) && retryDuplicate {
		// A concurrent submission with the same idempotency key committed
		// first; answering again returns that command.
		return s.submit(input, false)
	}
	if err != nil {
		return Submission{}, storeError(err)
	}
	for _, id := range cleanup {
		s.removeArtifact(id)
	}
	return submission, nil
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
// source input private. The replacement is committed before the old artifact
// is removed, so a controller restart cannot revive stale input.
func (s *Store) SubmitArtifactWithResult(input SubmitInput, body io.Reader) (Submission, error) {
	if err := validateInput(input, true); err != nil {
		return Submission{}, err
	}
	if body == nil {
		return Submission{}, fmt.Errorf("command artifact is required")
	}
	ctx, cancel := s.context()
	defer cancel()
	var submission Submission
	var record commandRow
	var artifacts []string
	existing := false
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		submission, artifacts, existing = Submission{}, nil, false
		if command, found, err := idempotentTx(ctx, tx, input, true); err != nil {
			return err
		} else if found {
			submission.Command, existing = command, true
			return nil
		}
		var err error
		record, err = s.newRecord(input, true)
		if err != nil {
			return err
		}
		record.command.State = domain.CommandNeedsAttention
		record.command.LastError = "Command input is being stored."
		superseded, supersededArtifacts, err := supersedeTx(ctx, tx, input)
		if err != nil {
			return err
		}
		if err := s.insertTx(ctx, tx, record, input.Payload); err != nil {
			return err
		}
		submission = Submission{Command: cloneCommand(record.command), Created: true, Superseded: superseded}
		artifacts = supersededArtifacts
		return nil
	})
	if err != nil {
		return Submission{}, storeError(err)
	}
	if existing {
		return submission, nil
	}
	for _, id := range artifacts {
		s.removeArtifact(id)
	}

	writeErr := s.writeArtifact(record.command.ID, body, input.MaxArtifactBytes)
	ctx, cancel = s.context()
	defer cancel()
	superseded := submission.Superseded
	var updated commandRow
	missing := false
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		row, found, err := lockRow(ctx, tx, record.command.ID)
		if err != nil {
			return err
		}
		if !found {
			missing = true
			return nil
		}
		row.command.UpdatedAt = s.timestamp()
		if writeErr != nil {
			row.command.State = domain.CommandNeedsAttention
			code, summary, recovery := uploadFailureDiagnostic(writeErr, input.MaxArtifactBytes)
			row.command.FailureCode = code
			row.command.FailureSummary = summary
			row.command.RecoveryHint = recovery
			row.command.LastError = summary + " No build ran; submit a new command with the source input."
		} else {
			row.command.State = domain.CommandQueued
			row.command.LastError = ""
		}
		updated = row
		return updateTx(ctx, tx, row)
	})
	if missing {
		s.removeArtifact(record.command.ID)
		return Submission{Command: cloneCommand(record.command), Created: true, Superseded: superseded}, fmt.Errorf("command input was superseded while storing")
	}
	if err != nil {
		return Submission{}, storeError(err)
	}
	if writeErr != nil {
		s.removeArtifact(record.command.ID)
		return Submission{Command: cloneCommand(updated.command), Created: true, Superseded: superseded}, fmt.Errorf("store command input: %w", writeErr)
	}
	return Submission{Command: cloneCommand(updated.command), Created: true, Superseded: superseded}, nil
}

func (s *Store) List(limit int) ([]domain.Command, error) {
	if limit < 1 {
		return []domain.Command{}, nil
	}
	if limit > 500 {
		limit = 500
	}
	ctx, cancel := s.context()
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, "SELECT "+commandColumns+" FROM commands ORDER BY updated_at DESC, id DESC LIMIT ?", limit)
	if err != nil {
		return nil, storeError(err)
	}
	defer rows.Close()
	items := make([]domain.Command, 0, limit)
	for rows.Next() {
		row, err := scanRow(rows)
		if err != nil {
			return nil, storeError(err)
		}
		items = append(items, row.command)
	}
	if err := rows.Err(); err != nil {
		return nil, storeError(err)
	}
	return items, nil
}

// Writable verifies that the ledger and the protected input directory can both
// accept a write before the controller acknowledges another durable command.
// It does not create a semantic command or reveal any existing private payload.
func (s *Store) Writable() error {
	if s == nil {
		return fmt.Errorf("command store is not configured")
	}
	ctx, cancel := s.context()
	defer cancel()
	if err := s.db.Ready(ctx); err != nil {
		return fmt.Errorf("open command store: %w", err)
	}
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
	if !commandIDPattern.MatchString(strings.TrimSpace(id)) {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	ctx, cancel := s.context()
	defer cancel()
	row, err := scanRow(s.db.Pool().QueryRowContext(ctx, "SELECT "+commandColumns+" FROM commands WHERE id = ?", id))
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Command{}, fmt.Errorf("command not found")
	}
	if err != nil {
		return domain.Command{}, storeError(err)
	}
	return row.command, nil
}

// RetryNow starts a new bounded attempt cycle only after an operator has
// explicitly acknowledged a terminal/uncertain outcome.
func (s *Store) RetryNow(id string, authorityEpoch uint64) (domain.Command, error) {
	var result domain.Command
	err := s.transition(id, func(row *commandRow) error {
		if row.command.State != domain.CommandNeedsAttention {
			return fmt.Errorf("command is not ready for an operator retry")
		}
		if authorityEpoch == 0 || authorityEpoch < row.command.AuthorityEpoch {
			return fmt.Errorf("command retry authority epoch is stale")
		}
		// An artifact-backed command carries its source input beside it. When
		// storing that input failed the artifact was removed, so requeueing the
		// record only buys the operator a second identical failure — with the
		// build context now gone, it cannot succeed at all.
		if row.artifact {
			stored, _, err := protectedArtifactFile(s.artifactPath(row.command.ID))
			if err != nil {
				return err
			}
			if !stored {
				return fmt.Errorf("this command's source input was never stored, so it cannot be retried; submit a new deployment from the deployment screen")
			}
		}
		now := s.timestamp()
		row.command.Attempt = 0
		row.command.AuthorityEpoch = authorityEpoch
		row.command.LastError = ""
		clearCommandFailureDiagnostic(&row.command)
		row.command.LastAttemptAt = nil
		row.command.NextAttemptAt = &now
		row.command.State = domain.CommandQueued
		row.command.UpdatedAt = now
		result = row.command
		return nil
	})
	if err != nil {
		return domain.Command{}, err
	}
	return cloneCommand(result), nil
}

// ClaimDue marks the oldest runnable command as running. A single claim at a
// time intentionally serializes high-trust cluster mutations; the scheduler
// lock row makes that hold across controller processes too.
func (s *Store) ClaimDue() (Record, bool, error) {
	ctx, cancel := s.context()
	defer cancel()
	var record Record
	claimed := false
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		record, claimed = Record{}, false
		if err := schedulerLock(ctx, tx, "claim:global"); err != nil {
			return err
		}
		var running int
		err := tx.QueryRowContext(ctx, "SELECT 1 FROM commands WHERE state = ? LIMIT 1", string(domain.CommandRunning)).Scan(&running)
		if err == nil {
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		now := s.timestamp()
		row, err := scanRow(tx.QueryRowContext(ctx, "SELECT "+commandColumns+` FROM commands
			WHERE state IN (?, ?) AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			ORDER BY created_at, seq LIMIT 1 FOR UPDATE SKIP LOCKED`,
			string(domain.CommandQueued), string(domain.CommandRetryScheduled), now))
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		row.command.Attempt++
		// The trail describes the attempt being watched. Keeping every
		// attempt's steps turned a command that retried eight times into the
		// same two lines eight times over; what an operator is looking at is
		// where this attempt has reached.
		if _, err := tx.ExecContext(ctx, "DELETE FROM command_events WHERE command_id = ?", row.command.ID); err != nil {
			return err
		}
		row.command.LastAttemptAt = &now
		row.command.NextAttemptAt = nil
		row.command.State = domain.CommandRunning
		row.command.UpdatedAt = now
		if err := updateTx(ctx, tx, row); err != nil {
			return err
		}
		payload, err := s.payloadTx(ctx, tx, row.command.ID)
		if err != nil {
			return err
		}
		record = Record{Artifact: row.artifact, Command: cloneCommand(row.command), Payload: payload}
		claimed = true
		return nil
	})
	if err != nil {
		return Record{}, false, storeError(err)
	}
	return record, claimed, nil
}

// LeaseDue assigns the oldest runnable command for one explicit agent. It is
// the pull-transport counterpart to ClaimDue: the lease is committed before
// the command leaves Core, and only the matching lease capability can advance
// or finish it.
func (s *Store) LeaseDue(serverID string, authorityEpoch uint64, ttl time.Duration) (Lease, bool, error) {
	serverID = strings.TrimSpace(serverID)
	if serverID == "" || authorityEpoch == 0 {
		return Lease{}, false, fmt.Errorf("agent lease identity is invalid")
	}
	if ttl < 5*time.Second || ttl > 5*time.Minute {
		return Lease{}, false, fmt.Errorf("agent lease duration must be between five seconds and five minutes")
	}
	if err := s.expireLeases(s.timestamp()); err != nil {
		return Lease{}, false, err
	}
	leaseID, err := newLeaseID()
	if err != nil {
		return Lease{}, false, err
	}
	ctx, cancel := s.context()
	defer cancel()
	var lease Lease
	leased := false
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		lease, leased = Lease{}, false
		if err := schedulerLock(ctx, tx, "lease:"+serverID); err != nil {
			return err
		}
		var busy int
		err := tx.QueryRowContext(ctx, "SELECT 1 FROM commands WHERE server_id = ? AND state IN (?, ?, ?) LIMIT 1", serverID,
			string(domain.CommandLeased), string(domain.CommandPreparing), string(domain.CommandRunning)).Scan(&busy)
		if err == nil {
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
		now := s.timestamp()
		row, err := scanRow(tx.QueryRowContext(ctx, "SELECT "+commandColumns+` FROM commands
			WHERE server_id = ? AND state IN (?, ?) AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
			ORDER BY created_at, seq LIMIT 1 FOR UPDATE SKIP LOCKED`,
			serverID, string(domain.CommandQueued), string(domain.CommandRetryScheduled), now))
		if errors.Is(err, sql.ErrNoRows) {
			return nil
		}
		if err != nil {
			return err
		}
		expires := now.Add(ttl)
		row.command.Attempt++
		if _, err := tx.ExecContext(ctx, "DELETE FROM command_events WHERE command_id = ?", row.command.ID); err != nil {
			return err
		}
		row.command.AuthorityEpoch = authorityEpoch
		row.command.LastAttemptAt = &now
		row.command.LeaseExpiresAt = &expires
		row.command.NextAttemptAt = nil
		row.command.State = domain.CommandLeased
		row.command.UpdatedAt = now
		row.leaseID = leaseID
		if err := updateTx(ctx, tx, row); err != nil {
			return err
		}
		payload, err := s.payloadTx(ctx, tx, row.command.ID)
		if err != nil {
			return err
		}
		lease = Lease{LeaseID: leaseID, Record: Record{Artifact: row.artifact, Command: cloneCommand(row.command), Payload: payload}}
		leased = true
		return nil
	})
	if err != nil {
		return Lease{}, false, storeError(err)
	}
	return lease, leased, nil
}

// AdvanceLease records agent-side preprocessing or execution. State changes
// are monotonic and sequence-free here; the HTTP protocol adds ordered event
// cursors before invoking this store boundary.
func (s *Store) AdvanceLease(id, leaseID string, state domain.CommandState) (domain.Command, error) {
	if !oneOfCommandState(state, domain.CommandPreparing, domain.CommandRunning) {
		return domain.Command{}, fmt.Errorf("invalid leased command state")
	}
	var result domain.Command
	err := s.transition(id, func(row *commandRow) error {
		if row.leaseID == "" || subtleStringMismatch(row.leaseID, leaseID) {
			return fmt.Errorf("command lease is invalid")
		}
		if state == domain.CommandPreparing && row.command.State != domain.CommandLeased {
			return fmt.Errorf("command is not leased")
		}
		if state == domain.CommandRunning && !oneOfCommandState(row.command.State, domain.CommandLeased, domain.CommandPreparing) {
			return fmt.Errorf("command is not preparing")
		}
		row.command.State = state
		row.command.UpdatedAt = s.timestamp()
		result = row.command
		return nil
	})
	if err != nil {
		return domain.Command{}, err
	}
	return cloneCommand(result), nil
}

func (s *Store) RenewLease(id, leaseID string, ttl time.Duration) (domain.Command, error) {
	if ttl < 5*time.Second || ttl > 5*time.Minute {
		return domain.Command{}, fmt.Errorf("agent lease duration must be between five seconds and five minutes")
	}
	var result domain.Command
	err := s.transition(id, func(row *commandRow) error {
		if row.leaseID == "" || subtleStringMismatch(row.leaseID, leaseID) || !oneOfCommandState(row.command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
			return fmt.Errorf("command lease is invalid")
		}
		expires := s.timestamp().Add(ttl)
		row.command.LeaseExpiresAt = &expires
		result = row.command
		return nil
	})
	if err != nil {
		return domain.Command{}, err
	}
	return cloneCommand(result), nil
}

func (s *Store) CompleteLease(id, leaseID string) (domain.Command, error) {
	return s.succeed(id, func(row *commandRow) error {
		if row.leaseID == "" || subtleStringMismatch(row.leaseID, leaseID) || !oneOfCommandState(row.command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
			return fmt.Errorf("command lease is invalid")
		}
		return nil
	})
}

func (s *Store) FailLease(id, leaseID string, executionErr error) (domain.Command, string, error) {
	return s.fail(id, executionErr, false, func(row *commandRow) error {
		if row.leaseID == "" || subtleStringMismatch(row.leaseID, leaseID) || !oneOfCommandState(row.command.State, domain.CommandLeased, domain.CommandPreparing, domain.CommandRunning) {
			return fmt.Errorf("command lease is invalid")
		}
		return nil
	})
}

func (s *Store) Complete(id string) (domain.Command, error) {
	return s.succeed(id, func(row *commandRow) error {
		if row.command.State != domain.CommandRunning {
			return fmt.Errorf("command is not running")
		}
		return nil
	})
}

// succeed marks a command succeeded after check accepts it. Successful
// commands retain their safe ledger metadata, never their raw input: the
// sealed payload row is deleted with the transition, and the input file after
// it commits. The execution log is kept, because it is the only account of
// what the machine did.
func (s *Store) succeed(id string, check func(*commandRow) error) (domain.Command, error) {
	var result domain.Command
	var artifact bool
	var pruned []string
	err := s.transitionTx(id, func(ctx context.Context, tx *sql.Tx, row *commandRow) error {
		if err := check(row); err != nil {
			return err
		}
		now := s.timestamp()
		row.command.LastError = ""
		clearCommandFailureDiagnostic(&row.command)
		row.command.LeaseExpiresAt = nil
		row.command.NextAttemptAt = nil
		row.command.State = domain.CommandSucceeded
		row.command.UpdatedAt = now
		row.leaseID = ""
		row.payloadDigest = ""
		artifact = row.artifact
		row.artifact = false
		if _, err := tx.ExecContext(ctx, "DELETE FROM command_payloads WHERE command_id = ?", row.command.ID); err != nil {
			return err
		}
		if err := updateTx(ctx, tx, *row); err != nil {
			return err
		}
		var err error
		pruned, err = s.pruneTx(ctx, tx)
		result = row.command
		return err
	})
	if err != nil {
		return domain.Command{}, err
	}
	if artifact {
		s.removeArtifact(id)
	}
	for _, prunedID := range pruned {
		s.removeArtifact(prunedID)
	}
	return cloneCommand(result), nil
}

// Fail schedules a bounded exponential retry for reconcilable commands. It
// deliberately turns ambiguous/non-retryable outcomes into needs_attention so
// a forced restart or rollback is never silently executed twice.
func (s *Store) Fail(id string, executionErr error) (domain.Command, string, error) {
	return s.fail(id, executionErr, true, func(row *commandRow) error {
		if row.command.State != domain.CommandRunning {
			return fmt.Errorf("command is not running")
		}
		return nil
	})
}

func (s *Store) fail(id string, executionErr error, prune bool, check func(*commandRow) error) (domain.Command, string, error) {
	var result domain.Command
	var event string
	var pruned []string
	err := s.transitionTx(id, func(ctx context.Context, tx *sql.Tx, row *commandRow) error {
		if err := check(row); err != nil {
			return err
		}
		now := s.timestamp()
		event = "needs_attention"
		if row.command.AutoRetry && !isPermanent(executionErr) && row.command.Attempt < row.command.MaxAttempts {
			next := now.Add(backoff(row.command.Attempt))
			row.command.NextAttemptAt = &next
			row.command.State = domain.CommandRetryScheduled
			event = "retry_scheduled"
		} else {
			row.command.NextAttemptAt = nil
			row.command.State = domain.CommandNeedsAttention
		}
		setCommandFailureDiagnostic(&row.command, executionErr)
		row.command.LastError = failureNarrative(row.command)
		row.command.LeaseExpiresAt = nil
		row.command.UpdatedAt = now
		row.leaseID = ""
		if err := updateTx(ctx, tx, *row); err != nil {
			return err
		}
		result = row.command
		if prune {
			var err error
			pruned, err = s.pruneTx(ctx, tx)
			return err
		}
		return nil
	})
	if err != nil {
		return domain.Command{}, "", err
	}
	// Logged after the commit, so a transaction the database retried cannot
	// write the same cause twice.
	s.logUnclassifiedFailure(result, executionErr)
	for _, prunedID := range pruned {
		s.removeArtifact(prunedID)
	}
	return cloneCommand(result), event, nil
}

func (s *Store) Artifact(id string) (io.ReadCloser, error) {
	command, err := s.Get(id)
	if err != nil {
		return nil, fmt.Errorf("command input is unavailable")
	}
	ctx, cancel := s.context()
	defer cancel()
	var artifact bool
	if err := s.db.Pool().QueryRowContext(ctx, "SELECT has_artifact FROM commands WHERE id = ?", command.ID).Scan(&artifact); err != nil || !artifact {
		return nil, fmt.Errorf("command input is unavailable")
	}
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
	reader, err := s.sealer.OpenReaderFile(s.artifactPath(id), s.artifactPurpose(id))
	if err != nil {
		return nil, fmt.Errorf("open encrypted command input: %w", err)
	}
	return reader, nil
}

// MaxCommandEvents bounds the progress recorded for one command. A source
// deployment reports six or seven steps; the cap exists so a future command
// that loops cannot grow its own record without limit.
const MaxCommandEvents = 64

// maxEvidenceRunes bounds one step's description. Evidence is written by the
// controller about its own progress, never copied from a machine, so this is a
// guard against a long path or image reference rather than against untrusted
// text.
const maxEvidenceRunes = 240

// AppendEvent records one step of a command's execution.
//
// A command moved from queued to succeeded or needs_attention with nothing in
// between, so a source deployment that installs a gateway, enables a database,
// reconciles a stack, builds an image and then deploys it reported one word for
// all five. The steps are rows of their own, read only when someone asks for
// this command's trail.
func (s *Store) AppendEvent(id string, state domain.CommandState, evidence string) error {
	evidence = strings.TrimSpace(evidence)
	if runes := []rune(evidence); len(runes) > maxEvidenceRunes {
		evidence = string(runes[:maxEvidenceRunes]) + "…"
	}
	return s.transitionTx(id, func(ctx context.Context, tx *sql.Tx, row *commandRow) error {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM command_events WHERE command_id = ?", row.command.ID).Scan(&count); err != nil {
			return err
		}
		if count >= MaxCommandEvents {
			return nil
		}
		_, err := tx.ExecContext(ctx, "INSERT INTO command_events (command_id, sequence, state, evidence, occurred_at) VALUES (?, ?, ?, ?, ?)",
			row.command.ID, count+1, string(state), sql.NullString{String: evidence, Valid: evidence != ""}, s.timestamp())
		return err
	})
}

// Events returns a command's ordered progress trail.
func (s *Store) Events(id string) ([]domain.CommandEvent, error) {
	if _, err := s.Get(id); err != nil {
		return nil, err
	}
	ctx, cancel := s.context()
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, "SELECT sequence, state, evidence, occurred_at FROM command_events WHERE command_id = ? ORDER BY sequence", id)
	if err != nil {
		return nil, fmt.Errorf("read command events: %w", err)
	}
	defer rows.Close()
	var events []domain.CommandEvent
	for rows.Next() {
		event := domain.CommandEvent{CommandID: id}
		var state string
		var evidence sql.NullString
		if err := rows.Scan(&event.Sequence, &state, &evidence, &event.OccurredAt); err != nil {
			return nil, fmt.Errorf("read command events: %w", err)
		}
		event.State, event.Evidence = domain.CommandState(state), evidence.String
		events = append(events, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read command events: %w", err)
	}
	return events, nil
}

// MaxOutputBytes bounds one retained execution log. A build that loops on a
// failing step can produce megabytes; what explains the failure is at the end
// of it, and the head is kept only so the failing step has context.
const MaxOutputBytes = 256 << 10

// RetainOutput seals a command's execution log beside its record.
//
// The log is what the machine actually said — the Docker build output that
// names the step and the error. It is sealed rather than written to the ledger
// columns because it is remote output: it stays out of the command record and
// out of any list, and is served only when an operator asks for that one
// command's log.
func (s *Store) RetainOutput(id, log string) error {
	// Emptiness is judged on the trimmed text; what is stored is the bytes the
	// machine produced. Trimming a log before sealing it would be this
	// controller editing the evidence it exists to keep.
	if strings.TrimSpace(log) == "" {
		return nil
	}
	if !commandIDPattern.MatchString(strings.TrimSpace(id)) {
		return fmt.Errorf("command not found")
	}
	// Keep the end, which is where a build says why it stopped, and enough of
	// the head to name the step it was on.
	if len(log) > MaxOutputBytes {
		head := MaxOutputBytes / 4
		tail := MaxOutputBytes - head
		log = log[:head] + "\n… (truncated) …\n" + log[len(log)-tail:]
	}
	sealed, err := s.db.Seal(outputPurpose(id), []byte(log))
	if err != nil {
		return err
	}
	return s.transitionTx(id, func(ctx context.Context, tx *sql.Tx, row *commandRow) error {
		_, err := tx.ExecContext(ctx, `INSERT INTO command_outputs (command_id, output_sealed, retained_at) VALUES (?, ?, ?)
			ON DUPLICATE KEY UPDATE output_sealed = VALUES(output_sealed), retained_at = VALUES(retained_at)`, row.command.ID, sealed, s.timestamp())
		return err
	})
}

// Output returns a command's retained execution log.
func (s *Store) Output(id string) (string, error) {
	if !commandIDPattern.MatchString(strings.TrimSpace(id)) {
		return "", fmt.Errorf("command output is unavailable")
	}
	ctx, cancel := s.context()
	defer cancel()
	var sealed []byte
	err := s.db.Pool().QueryRowContext(ctx, "SELECT output_sealed FROM command_outputs WHERE command_id = ?", id).Scan(&sealed)
	if errors.Is(err, sql.ErrNoRows) {
		return "", fmt.Errorf("command output is unavailable")
	}
	if err != nil {
		return "", fmt.Errorf("read command output: %w", err)
	}
	output, err := s.db.Open(outputPurpose(id), sealed)
	if err != nil {
		return "", fmt.Errorf("read command output: %w", err)
	}
	return string(output), nil
}

// Recover reclaims work a previous run of this controller left in flight. A
// leased, preparing or running command has an uncertain remote outcome, so it
// becomes needs_attention rather than being replayed; an artifact upload that
// was interrupted is queued if its input reached disk and explained if not.
//
// Only the active controller may call it. A standby that reclaimed on start
// would take over commands the active controller is still executing.
func (s *Store) Recover() error {
	ctx, cancel := s.context()
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		inFlight, err := lockRows(ctx, tx, "SELECT "+commandColumns+" FROM commands WHERE state IN (?, ?, ?) FOR UPDATE",
			string(domain.CommandLeased), string(domain.CommandPreparing), string(domain.CommandRunning))
		if err != nil {
			return err
		}
		now := s.timestamp()
		for _, row := range inFlight {
			row.command.State = domain.CommandNeedsAttention
			row.command.LastError = "Core restarted while the command lease was in flight; the agent result must be reconciled before retrying."
			setCommandFailureDiagnostic(&row.command, errors.New(row.command.LastError))
			row.command.LeaseExpiresAt = nil
			row.leaseID = ""
			row.command.NextAttemptAt = nil
			row.command.UpdatedAt = now
			if err := updateTx(ctx, tx, row); err != nil {
				return err
			}
		}
		uploads, err := lockRows(ctx, tx, "SELECT "+commandColumns+" FROM commands WHERE state = ? AND has_artifact = TRUE AND last_error = ? FOR UPDATE",
			string(domain.CommandNeedsAttention), "Command input is being stored.")
		if err != nil {
			return err
		}
		for _, row := range uploads {
			present, err := s.encryptedArtifactPresent(row.command.ID)
			if err == nil && present {
				row.command.State = domain.CommandQueued
				row.command.LastError = ""
			} else {
				row.command.LastError = "Command input upload did not complete. Submit a new command with the source input."
			}
			row.command.UpdatedAt = now
			if err := updateTx(ctx, tx, row); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("recover command store: %w", err)
	}
	return nil
}

// expireLeases turns every lapsed agent lease into a scheduled retry or an
// attention record. It runs before a lease is handed out, in its own
// transaction, skipping rows another transaction is changing.
func (s *Store) expireLeases(now time.Time) error {
	ctx, cancel := s.context()
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		expired, err := lockRows(ctx, tx, "SELECT "+commandColumns+` FROM commands
			WHERE state IN (?, ?, ?) AND lease_expires_at IS NOT NULL AND lease_expires_at <= ? FOR UPDATE SKIP LOCKED`,
			string(domain.CommandLeased), string(domain.CommandPreparing), string(domain.CommandRunning), now)
		if err != nil {
			return err
		}
		for _, row := range expired {
			row.leaseID = ""
			row.command.LeaseExpiresAt = nil
			row.command.UpdatedAt = now
			if row.command.AutoRetry && row.command.Attempt < row.command.MaxAttempts {
				next := now.Add(backoff(row.command.Attempt))
				row.command.NextAttemptAt = &next
				row.command.State = domain.CommandRetryScheduled
				row.command.LastError = "Agent lease expired; retry scheduled with backoff."
			} else {
				row.command.NextAttemptAt = nil
				row.command.State = domain.CommandNeedsAttention
				row.command.LastError = "Agent lease expired with an uncertain remote outcome; reconcile the target before retrying."
			}
			if err := updateTx(ctx, tx, row); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return fmt.Errorf("expire command leases: %w", err)
	}
	return nil
}

// transition runs fn on one locked command row and writes what it leaves.
func (s *Store) transition(id string, fn func(*commandRow) error) error {
	return s.transitionTx(id, func(ctx context.Context, tx *sql.Tx, row *commandRow) error {
		before := *row
		if err := fn(row); err != nil {
			return err
		}
		if *row == before {
			return nil
		}
		return updateTx(ctx, tx, *row)
	})
}

// transitionTx locks one command row and hands it to fn inside the
// transaction. An unknown or malformed id is "command not found".
func (s *Store) transitionTx(id string, fn func(context.Context, *sql.Tx, *commandRow) error) error {
	if !commandIDPattern.MatchString(strings.TrimSpace(id)) {
		return fmt.Errorf("command not found")
	}
	ctx, cancel := s.context()
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		row, found, err := lockRow(ctx, tx, id)
		if err != nil {
			return err
		}
		if !found {
			return errCommandNotFound
		}
		return fn(ctx, tx, &row)
	})
	if errors.Is(err, errCommandNotFound) {
		return fmt.Errorf("command not found")
	}
	return storeError(err)
}

var errCommandNotFound = errors.New("command not found")

func (s *Store) newRecord(input SubmitInput, artifact bool) (commandRow, error) {
	id, err := newID()
	if err != nil {
		return commandRow{}, err
	}
	now := s.timestamp()
	return commandRow{
		artifact:       artifact,
		idempotencyKey: strings.TrimSpace(input.IdempotencyKey),
		payloadDigest:  digest(input.Payload),
		command: domain.Command{
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

// idempotentTx returns the command an earlier submission with the same actor
// and key created, or ErrIdempotencyConflict when that command was for
// something else. A payload is compared by digest while it is retained; a
// succeeded command no longer holds one, exactly as before.
func idempotentTx(ctx context.Context, tx *sql.Tx, input SubmitInput, artifact bool) (domain.Command, bool, error) {
	row, err := scanRow(tx.QueryRowContext(ctx, "SELECT "+commandColumns+" FROM commands WHERE actor = ? AND idempotency_key = ? FOR UPDATE",
		strings.TrimSpace(input.Actor), strings.TrimSpace(input.IdempotencyKey)))
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Command{}, false, nil
	}
	if err != nil {
		return domain.Command{}, false, err
	}
	samePayload := row.payloadDigest == digest(input.Payload)
	if row.payloadDigest == "" {
		samePayload = len(input.Payload) == 0
	}
	if row.artifact != artifact || row.command.Action != strings.TrimSpace(input.Action) || row.command.ServerID != strings.TrimSpace(input.ServerID) || row.command.Target != strings.TrimSpace(input.Target) || !samePayload {
		return domain.Command{}, false, ErrIdempotencyConflict
	}
	return row.command, true, nil
}

// supersedeTx removes only work that has not begun. A running command is never
// erased or interrupted because the controller cannot know whether the remote
// side effect has already happened. A needs-attention command also remains
// until an operator explicitly retries or resolves it; the sole exception is an
// artifact still marked as uploading, which has not been eligible to execute.
func supersedeTx(ctx context.Context, tx *sql.Tx, input SubmitInput) ([]domain.Command, []string, error) {
	candidates, err := lockRows(ctx, tx, "SELECT "+commandColumns+" FROM commands WHERE action = ? AND server_id = ? AND target = ? AND state IN (?, ?, ?) ORDER BY seq FOR UPDATE",
		strings.TrimSpace(input.Action), strings.TrimSpace(input.ServerID), strings.TrimSpace(input.Target),
		string(domain.CommandQueued), string(domain.CommandRetryScheduled), string(domain.CommandNeedsAttention))
	if err != nil {
		return nil, nil, err
	}
	superseded := make([]domain.Command, 0)
	artifacts := make([]string, 0)
	for _, row := range candidates {
		if !supersedable(row) {
			continue
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM commands WHERE id = ?", row.command.ID); err != nil {
			return nil, nil, err
		}
		superseded = append(superseded, row.command)
		if row.artifact {
			artifacts = append(artifacts, row.command.ID)
		}
	}
	return superseded, artifacts, nil
}

func supersedable(row commandRow) bool {
	switch row.command.State {
	case domain.CommandQueued, domain.CommandRetryScheduled:
		return true
	case domain.CommandNeedsAttention:
		return row.artifact && row.command.LastError == "Command input is being stored."
	default:
		return false
	}
}

// pruneTx deletes the oldest succeeded commands beyond the history limit and
// reports their ids so any file left beside them can be removed after commit.
// Queued, running, retry-scheduled and needs-attention commands are never
// removed, so pruning cannot lose pending work or an operator's decision. The
// command's events, payload and retained log go with it by ON DELETE CASCADE.
func (s *Store) pruneTx(ctx context.Context, tx *sql.Tx) ([]string, error) {
	var total int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM commands WHERE state = ?", string(domain.CommandSucceeded)).Scan(&total); err != nil {
		return nil, err
	}
	excess := total - s.historyLimit
	if excess <= 0 {
		return nil, nil
	}
	rows, err := tx.QueryContext(ctx, "SELECT id FROM commands WHERE state = ? ORDER BY seq LIMIT ? FOR UPDATE", string(domain.CommandSucceeded), excess)
	if err != nil {
		return nil, err
	}
	var pruned []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			_ = rows.Close()
			return nil, err
		}
		pruned = append(pruned, id)
	}
	if err := rows.Close(); err != nil {
		return nil, err
	}
	for _, id := range pruned {
		if _, err := tx.ExecContext(ctx, "DELETE FROM commands WHERE id = ?", id); err != nil {
			return nil, err
		}
	}
	return pruned, nil
}

func (s *Store) insertTx(ctx context.Context, tx *sql.Tx, row commandRow, payload []byte) error {
	c := row.command
	if _, err := tx.ExecContext(ctx, "INSERT INTO commands ("+commandColumns+`) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.ID, c.Action, c.Actor, c.ServerID, c.NodeID, c.ClusterID, c.Target, string(c.State), c.Attempt, c.MaxAttempts, c.AutoRetry,
		c.AuthorityEpoch, text(c.RequestID), row.idempotencyKey, text(row.payloadDigest), row.artifact, text(row.leaseID),
		moment(c.LeaseExpiresAt), moment(c.LastAttemptAt), moment(c.NextAttemptAt), text(c.LastError), text(c.FailureCode),
		text(c.FailureSummary), text(c.RecoveryHint), c.CreatedAt, c.UpdatedAt); err != nil {
		return err
	}
	if row.payloadDigest == "" {
		return nil
	}
	sealed, err := s.db.Seal(payloadPurpose(c.ID), payload)
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "INSERT INTO command_payloads (command_id, payload_sealed) VALUES (?, ?)", c.ID, sealed)
	return err
}

func updateTx(ctx context.Context, tx *sql.Tx, row commandRow) error {
	c := row.command
	_, err := tx.ExecContext(ctx, `UPDATE commands SET state = ?, attempt = ?, authority_epoch = ?, payload_digest = ?, has_artifact = ?,
		lease_id = ?, lease_expires_at = ?, last_attempt_at = ?, next_attempt_at = ?, last_error = ?, failure_code = ?, failure_summary = ?,
		recovery_hint = ?, updated_at = ? WHERE id = ?`,
		string(c.State), c.Attempt, c.AuthorityEpoch, text(row.payloadDigest), row.artifact, text(row.leaseID), moment(c.LeaseExpiresAt),
		moment(c.LastAttemptAt), moment(c.NextAttemptAt), text(c.LastError), text(c.FailureCode), text(c.FailureSummary),
		text(c.RecoveryHint), c.UpdatedAt, c.ID)
	return err
}

func (s *Store) payloadTx(ctx context.Context, tx *sql.Tx, id string) (json.RawMessage, error) {
	var sealed []byte
	err := tx.QueryRowContext(ctx, "SELECT payload_sealed FROM command_payloads WHERE command_id = ?", id).Scan(&sealed)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	payload, err := s.db.Open(payloadPurpose(id), sealed)
	if err != nil {
		return nil, err
	}
	return json.RawMessage(payload), nil
}

// schedulerLock takes the exclusive lock on one command_locks row until the
// transaction ends, creating the row the first time.
func schedulerLock(ctx context.Context, tx *sql.Tx, name string) error {
	_, err := tx.ExecContext(ctx, "INSERT INTO command_locks (lock_name) VALUES (?) ON DUPLICATE KEY UPDATE lock_name = VALUES(lock_name)", name)
	return err
}

func lockRow(ctx context.Context, tx *sql.Tx, id string) (commandRow, bool, error) {
	row, err := scanRow(tx.QueryRowContext(ctx, "SELECT "+commandColumns+" FROM commands WHERE id = ? FOR UPDATE", id))
	if errors.Is(err, sql.ErrNoRows) {
		return commandRow{}, false, nil
	}
	if err != nil {
		return commandRow{}, false, err
	}
	return row, true, nil
}

func lockRows(ctx context.Context, tx *sql.Tx, query string, args ...any) ([]commandRow, error) {
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []commandRow
	for rows.Next() {
		row, err := scanRow(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

type scanner interface {
	Scan(dest ...any) error
}

func scanRow(source scanner) (commandRow, error) {
	var row commandRow
	var state string
	var requestID, payloadDigest, leaseID, lastError, failureCode, failureSummary, recoveryHint sql.NullString
	var leaseExpires, lastAttempt, nextAttempt sql.NullTime
	c := &row.command
	if err := source.Scan(&c.ID, &c.Action, &c.Actor, &c.ServerID, &c.NodeID, &c.ClusterID, &c.Target, &state, &c.Attempt, &c.MaxAttempts,
		&c.AutoRetry, &c.AuthorityEpoch, &requestID, &row.idempotencyKey, &payloadDigest, &row.artifact, &leaseID, &leaseExpires,
		&lastAttempt, &nextAttempt, &lastError, &failureCode, &failureSummary, &recoveryHint, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return commandRow{}, err
	}
	c.State = domain.CommandState(state)
	c.RequestID, c.LastError, c.FailureCode = requestID.String, lastError.String, failureCode.String
	c.FailureSummary, c.RecoveryHint = failureSummary.String, recoveryHint.String
	c.LeaseExpiresAt, c.LastAttemptAt, c.NextAttemptAt = pointer(leaseExpires), pointer(lastAttempt), pointer(nextAttempt)
	row.payloadDigest, row.leaseID = payloadDigest.String, leaseID.String
	return row, nil
}

// storeError marks a database failure as a command-store failure while leaving
// the domain errors a transition returns to abort untouched.
func storeError(err error) error {
	if err == nil || !sqlstore.IsServerError(err) {
		return err
	}
	return fmt.Errorf("save command store: %w", err)
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

// migrateLegacyArtifacts seals any plaintext build input a much older
// controller left beside a command that still holds one.
func (s *Store) migrateLegacyArtifacts() error {
	legacyPaths, err := filepath.Glob(filepath.Join(s.inputsDir, "*.input"))
	if err != nil {
		return fmt.Errorf("check legacy command inputs: %w", err)
	}
	for _, legacyPath := range legacyPaths {
		id := strings.TrimSuffix(filepath.Base(legacyPath), ".input")
		if !commandIDPattern.MatchString(id) {
			return fmt.Errorf("legacy plaintext command input remains at %s", legacyPath)
		}
		sealed, _, err := protectedArtifactFile(s.artifactPath(id))
		if err != nil {
			return fmt.Errorf("check encrypted command input: %w", err)
		}
		if sealed {
			return fmt.Errorf("legacy plaintext command input remains beside sealed state for %s", id)
		}
		_, legacyInfo, err := protectedArtifactFile(legacyPath)
		if err != nil {
			return fmt.Errorf("check legacy command input: %w", err)
		}
		file, err := os.Open(legacyPath)
		if err != nil {
			return fmt.Errorf("open legacy command input: %w", err)
		}
		written, writeErr := s.sealer.WriteReaderFile(s.artifactPath(id), s.artifactPurpose(id), file, legacyInfo.Size())
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

func digest(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}
	sum := sha256.Sum256(payload)
	return hex.EncodeToString(sum[:])
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

func text(value string) sql.NullString { return sql.NullString{String: value, Valid: value != ""} }

func moment(value *time.Time) sql.NullTime {
	if value == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: value.UTC(), Valid: true}
}

func pointer(value sql.NullTime) *time.Time {
	if !value.Valid {
		return nil
	}
	result := value.Time
	return &result
}

func backoff(attempt uint) time.Duration {
	// 2, 4, 8, 16, 32, 64 seconds, capped to keep an operator-visible command
	// responsive while still avoiding a tight retry loop.
	if attempt > 5 {
		attempt = 5
	}
	return time.Second * time.Duration(1<<attempt)
}
