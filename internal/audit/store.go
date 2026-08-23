// Package audit persists a compact, append-only audit record. The file is on a
// Swarm volume so operational mutations remain inspectable after a restart.
package audit

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

type Store struct {
	mu   sync.Mutex
	now  func() time.Time
	path string
}

func Open(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0o700); err != nil {
		return nil, fmt.Errorf("create audit directory: %w", err)
	}
	return &Store{now: time.Now, path: filepath.Join(dataDir, "audit.ndjson")}, nil
}

func (s *Store) Record(event domain.AuditEvent) (domain.AuditEvent, error) {
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
	file, err := os.OpenFile(s.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return domain.AuditEvent{}, fmt.Errorf("open audit log: %w", err)
	}
	defer file.Close()
	if err := json.NewEncoder(file).Encode(event); err != nil {
		return domain.AuditEvent{}, fmt.Errorf("write audit event: %w", err)
	}
	return event, nil
}

// Writable verifies that the append-only audit destination can be opened
// before a sensitive control-plane operation is attempted. It intentionally
// does not write a probe record, so the event stream remains semantic.
func (s *Store) Writable() error {
	if s == nil {
		return fmt.Errorf("audit store is not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := os.OpenFile(s.path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return fmt.Errorf("open audit log: %w", err)
	}
	if err := file.Close(); err != nil {
		return fmt.Errorf("close audit log: %w", err)
	}
	return nil
}

func (s *Store) Recent(limit int) ([]domain.AuditEvent, error) {
	if limit < 1 {
		return []domain.AuditEvent{}, nil
	}
	if limit > 500 {
		limit = 500
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	file, err := os.Open(s.path)
	if os.IsNotExist(err) {
		return []domain.AuditEvent{}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("open audit log: %w", err)
	}
	defer file.Close()

	items := make([]domain.AuditEvent, 0, limit)
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 8<<10), 1<<20)
	for scanner.Scan() {
		var event domain.AuditEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			return nil, fmt.Errorf("decode audit event: %w", err)
		}
		if len(items) == limit {
			copy(items, items[1:])
			items[len(items)-1] = event
		} else {
			items = append(items, event)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read audit log: %w", err)
	}
	for left, right := 0, len(items)-1; left < right; left, right = left+1, right-1 {
		items[left], items[right] = items[right], items[left]
	}
	return items, nil
}

func newID() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("generate audit id: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}
