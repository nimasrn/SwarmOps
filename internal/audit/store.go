// Package audit persists a compact, logically append-only audit record. Its
// state is encrypted before it reaches the controller disk.
package audit

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const auditStateKey = "audit-events"

type auditFile struct {
	Events  []domain.AuditEvent
	Version int
}

type Store struct {
	events     []domain.AuditEvent
	legacyPath string
	maxEvents  int
	mu         sync.Mutex
	now        func() time.Time
	path       string
	store      *securestore.Sealer
}

// Open loads the encrypted audit history and keeps at most maxEvents records.
// The bound stops unauthenticated login-failure spam and ordinary operation
// volume from growing controller memory and the sealed rewrite cost forever;
// the most recent evidence is always retained.
func Open(dataDir string, dataEncryptionKey []byte, maxEvents int) (*Store, error) {
	if maxEvents < 1 {
		return nil, fmt.Errorf("audit retention must be positive")
	}
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return nil, fmt.Errorf("create audit directory: %w", err)
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure encrypted audit store: %w", err)
	}
	store := &Store{
		legacyPath: filepath.Join(dataDir, "audit.ndjson"),
		maxEvents:  maxEvents,
		now:        time.Now,
		path:       filepath.Join(dataDir, "audit.sealed"),
		store:      sealer,
	}
	data, err := store.store.ReadFile(store.path, auditStateKey)
	if errors.Is(err, os.ErrNotExist) {
		if err := store.loadLegacyEvents(); err != nil {
			return nil, err
		}
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read audit log: %w", err)
	}
	if _, err := os.Stat(store.legacyPath); err == nil {
		return nil, fmt.Errorf("legacy plaintext audit log remains; remove %s only after verifying the encrypted migration", store.legacyPath)
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("check legacy audit log: %w", err)
	}
	if err := store.loadEvents(data); err != nil {
		return nil, err
	}
	return store, nil
}

func (s *Store) loadLegacyEvents() error {
	file, err := os.Open(s.legacyPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read legacy audit log: %w", err)
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 8<<10), 1<<20)
	for scanner.Scan() {
		var event domain.AuditEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			return fmt.Errorf("decode legacy audit event: %w", err)
		}
		s.events = append(s.events, cloneEvent(event))
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read legacy audit log: %w", err)
	}
	s.trimLocked()
	if err := s.saveLocked(); err != nil {
		return fmt.Errorf("seal legacy audit log: %w", err)
	}
	if err := securestore.RemoveFile(s.legacyPath); err != nil {
		return fmt.Errorf("remove migrated plaintext audit log: %w", err)
	}
	return nil
}

func (s *Store) loadEvents(data []byte) error {
	var saved auditFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return fmt.Errorf("decode audit log: %w", err)
	}
	if saved.Version != 1 {
		return fmt.Errorf("unsupported audit log version")
	}
	s.events = make([]domain.AuditEvent, 0, len(saved.Events))
	for _, event := range saved.Events {
		s.events = append(s.events, cloneEvent(event))
	}
	s.trimLocked()
	return nil
}

func (s *Store) Record(event domain.AuditEvent) (domain.AuditEvent, error) {
	if s == nil {
		return domain.AuditEvent{}, fmt.Errorf("audit store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if event.ID == "" {
		id, err := newID()
		if err != nil {
			return domain.AuditEvent{}, err
		}
		event.ID = id
	}
	if event.OccurredAt.IsZero() {
		event.OccurredAt = s.now().UTC()
	}
	event = cloneEvent(event)
	s.events = append(s.events, event)
	s.trimLocked()
	if err := s.saveLocked(); err != nil {
		s.events = s.events[:len(s.events)-1]
		return domain.AuditEvent{}, err
	}
	return cloneEvent(event), nil
}

// trimLocked retains only the newest maxEvents records. It runs after load
// and every append so both memory and the sealed rewrite stay bounded even
// when unauthenticated login failures attempt to flood the ledger.
func (s *Store) trimLocked() {
	excess := len(s.events) - s.maxEvents
	if excess <= 0 {
		return
	}
	retained := make([]domain.AuditEvent, len(s.events)-excess)
	copy(retained, s.events[excess:])
	s.events = retained
}

// Writable verifies that the encrypted audit destination can create a
// protected temporary file before a sensitive control-plane operation starts.
// It intentionally does not add a probe record to the semantic audit stream.
func (s *Store) Writable() error {
	if s == nil {
		return fmt.Errorf("audit store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	temporary, err := os.CreateTemp(filepath.Dir(s.path), ".audit-write-check-*")
	if err != nil {
		return fmt.Errorf("open audit log: %w", err)
	}
	temporaryPath := temporary.Name()
	if err := temporary.Chmod(0o600); err != nil {
		_ = temporary.Close()
		_ = os.Remove(temporaryPath)
		return fmt.Errorf("protect audit write check: %w", err)
	}
	if err := temporary.Close(); err != nil {
		_ = os.Remove(temporaryPath)
		return fmt.Errorf("close audit write check: %w", err)
	}
	if err := os.Remove(temporaryPath); err != nil {
		return fmt.Errorf("remove audit write check: %w", err)
	}
	return nil
}

func (s *Store) Recent(limit int) ([]domain.AuditEvent, error) {
	if s == nil {
		return nil, fmt.Errorf("audit store is not configured")
	}
	if limit < 1 {
		return []domain.AuditEvent{}, nil
	}
	if limit > 500 {
		limit = 500
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	count := len(s.events)
	if count > limit {
		count = limit
	}
	items := make([]domain.AuditEvent, 0, count)
	for index := len(s.events) - 1; index >= 0 && len(items) < limit; index-- {
		items = append(items, cloneEvent(s.events[index]))
	}
	return items, nil
}

func (s *Store) saveLocked() error {
	data, err := json.Marshal(auditFile{Events: s.events, Version: 1})
	if err != nil {
		return fmt.Errorf("encode audit log: %w", err)
	}
	if err := s.store.WriteFile(s.path, auditStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save audit log: %w", err)
	}
	return nil
}

func cloneEvent(event domain.AuditEvent) domain.AuditEvent {
	if event.Detail == nil {
		return event
	}
	detail := event.Detail
	event.Detail = make(map[string]string, len(event.Detail))
	for key, value := range detail {
		event.Detail[key] = value
	}
	return event
}

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate audit id: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}
