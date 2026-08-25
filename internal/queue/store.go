// Package queue persists and schedules the narrow set of SwarmOps mutations.
// It is deliberately a single-controller queue: the API is a Swarm singleton
// backed by one named volume, so an atomic local snapshot avoids adding a
// second control plane or a general-purpose message broker.
package queue

import (
	"bytes"
	"crypto/rand"
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

// SubmitInput is deliberately limited to safe command metadata. Any raw
// Compose document or build archive remains private to the queue store and is
// never copied into an audit record.
type SubmitInput struct {
	Action           string
	Actor            string
	AutoRetry        bool
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

type storedRecord struct {
	Artifact       bool            `json:"artifact,omitempty"`
	Command        domain.Command  `json:"command"`
	IdempotencyKey string          `json:"idempotencyKey,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
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
	if err := validateInput(input, false); err != nil {
		return domain.Command{}, false, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if command, found, err := s.idempotentLocked(input, false); err != nil {
		return domain.Command{}, false, err
	} else if found {
		return command, false, nil
	}
	record, err := s.newRecordLocked(input, false)
	if err != nil {
		return domain.Command{}, false, err
	}
	s.records = append(s.records, record)
	// Pruning only ever removes terminal records. If this save fails the
	// in-memory ledger keeps the smaller history while the previous sealed
	// file still holds everything; the next successful transition persists
	// the same bounded result.
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		s.records = s.records[:len(s.records)-1]
		return domain.Command{}, false, err
	}
	return cloneCommand(record.Command), true, nil
}

// SubmitArtifact writes source input to the protected command store before it
// changes a command from uploading to queued. A controller restart therefore
// leaves either a recoverable artifact or a visible needs-attention record;
// it never silently drops an accepted upload.
func (s *Store) SubmitArtifact(input SubmitInput, body io.Reader) (domain.Command, bool, error) {
	if err := validateInput(input, true); err != nil {
		return domain.Command{}, false, err
	}
	if body == nil {
		return domain.Command{}, false, fmt.Errorf("command artifact is required")
	}
	s.mu.Lock()
	if command, found, err := s.idempotentLocked(input, true); err != nil {
		s.mu.Unlock()
		return domain.Command{}, false, err
	} else if found {
		s.mu.Unlock()
		return command, false, nil
	}
	record, err := s.newRecordLocked(input, true)
	if err != nil {
		s.mu.Unlock()
		return domain.Command{}, false, err
	}
	record.Command.State = domain.CommandNeedsAttention
	record.Command.LastError = "Command input is being stored."
	s.records = append(s.records, record)
	if err := s.saveLocked(); err != nil {
		s.records = s.records[:len(s.records)-1]
		s.mu.Unlock()
		return domain.Command{}, false, err
	}
	s.mu.Unlock()

	writeErr := s.writeArtifact(record.Command.ID, body, input.MaxArtifactBytes)
	s.mu.Lock()
	defer s.mu.Unlock()
	index := s.indexLocked(record.Command.ID)
	if index < 0 {
		return domain.Command{}, false, fmt.Errorf("command disappeared while storing input")
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
		return domain.Command{}, false, err
	}
	if writeErr != nil {
		return cloneCommand(updated.Command), true, fmt.Errorf("store command input: %w", writeErr)
	}
	return cloneCommand(updated.Command), true, nil
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
func (s *Store) RetryNow(id string) (domain.Command, error) {
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
	now := s.now().UTC()
	previousAttempt := record.Command.Attempt
	previousError := record.Command.LastError
	previousLastAttemptAt := record.Command.LastAttemptAt
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousState := record.Command.State
	previousUpdatedAt := record.Command.UpdatedAt
	record.Command.Attempt = 0
	record.Command.LastError = ""
	record.Command.LastAttemptAt = nil
	record.Command.NextAttemptAt = &now
	record.Command.State = domain.CommandQueued
	record.Command.UpdatedAt = now
	if err := s.saveLocked(); err != nil {
		record.Command.Attempt = previousAttempt
		record.Command.LastError = previousError
		record.Command.LastAttemptAt = previousLastAttemptAt
		record.Command.NextAttemptAt = previousNextAttemptAt
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
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousState := record.Command.State
	previousUpdatedAt := record.Command.UpdatedAt
	previousPayload := record.Payload
	previousArtifact := record.Artifact
	record.Command.LastError = ""
	record.Command.NextAttemptAt = nil
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
		record.Command.NextAttemptAt = previousNextAttemptAt
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
	previousNextAttemptAt := record.Command.NextAttemptAt
	previousState := record.Command.State
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
	record.Command.UpdatedAt = now
	s.pruneTerminalLocked()
	if err := s.saveLocked(); err != nil {
		record.Command.LastError = previousError
		record.Command.NextAttemptAt = previousNextAttemptAt
		record.Command.State = previousState
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
		case domain.CommandRunning:
			record.Command.State = domain.CommandNeedsAttention
			record.Command.LastError = "Controller restarted while the command was in flight; inspect the target before retrying."
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
			Action:      strings.TrimSpace(input.Action),
			Actor:       strings.TrimSpace(input.Actor),
			AutoRetry:   input.AutoRetry,
			CreatedAt:   now,
			ID:          id,
			MaxAttempts: input.MaxAttempts,
			RequestID:   strings.TrimSpace(input.RequestID),
			ServerID:    strings.TrimSpace(input.ServerID),
			State:       domain.CommandQueued,
			Target:      strings.TrimSpace(input.Target),
			UpdatedAt:   now,
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
	case domain.CommandQueued, domain.CommandRunning, domain.CommandRetryScheduled, domain.CommandSucceeded, domain.CommandNeedsAttention:
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
	return result
}

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate command ID: %w", err)
	}
	return "cmd-" + hex.EncodeToString(bytes), nil
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
