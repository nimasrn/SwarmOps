// Package audit persists a compact, logically append-only audit record in the
// controller database. Events are only inserted; the oldest are trimmed once
// the retention bound is exceeded.
package audit

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// storeTimeout bounds one audit statement. The Store's method set predates the
// database and takes no context, so every call carries its own deadline rather
// than blocking a request on a database that stopped answering.
const storeTimeout = 10 * time.Second

type Store struct {
	db        *sqlstore.DB
	maxEvents int
	now       func() time.Time
}

// Open binds the audit ledger to the controller database and keeps at most
// maxEvents records. The bound stops unauthenticated login-failure spam and
// ordinary operation volume from growing the table forever; the most recent
// evidence is always retained.
func Open(db *sqlstore.DB, maxEvents int) (*Store, error) {
	if db == nil {
		return nil, fmt.Errorf("audit store requires a database")
	}
	if maxEvents < 1 {
		return nil, fmt.Errorf("audit retention must be positive")
	}
	return &Store{db: db, maxEvents: maxEvents, now: time.Now}, nil
}

// Database is the controller database this ledger lives in. The HTTP server
// opens the rest of its durable state on the same database, so a process can
// never record audit evidence in one place and act on state kept in another.
func (s *Store) Database() *sqlstore.DB {
	if s == nil {
		return nil
	}
	return s.db
}

func (s *Store) Record(event domain.AuditEvent) (domain.AuditEvent, error) {
	if s == nil {
		return domain.AuditEvent{}, fmt.Errorf("audit store is not configured")
	}
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
	event.OccurredAt = event.OccurredAt.UTC().Truncate(time.Microsecond)
	event = cloneEvent(event)
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	err := s.db.WithTx(ctx, func(tx *sql.Tx) error {
		if err := insertEvent(ctx, tx, event); err != nil {
			return err
		}
		return trim(ctx, tx, s.maxEvents)
	})
	if err != nil {
		return domain.AuditEvent{}, fmt.Errorf("save audit event: %w", err)
	}
	return cloneEvent(event), nil
}

func insertEvent(ctx context.Context, tx *sql.Tx, event domain.AuditEvent) error {
	result, err := tx.ExecContext(ctx, `INSERT INTO audit_events (id, occurred_at, actor, action, target, outcome, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		event.ID, event.OccurredAt, event.Actor, event.Action, event.Target, event.Outcome, nullString(event.RequestID))
	if err != nil {
		return err
	}
	seq, err := result.LastInsertId()
	if err != nil {
		return err
	}
	for key, value := range event.Detail {
		if _, err := tx.ExecContext(ctx, "INSERT INTO audit_event_details (event_seq, detail_key, detail_value) VALUES (?, ?, ?)", seq, key, value); err != nil {
			return err
		}
	}
	return nil
}

// trim deletes every event older than the newest maxEvents. Details go with
// their event through the ON DELETE CASCADE foreign key.
func trim(ctx context.Context, tx *sql.Tx, maxEvents int) error {
	var boundary int64
	err := tx.QueryRowContext(ctx, "SELECT seq FROM audit_events ORDER BY seq DESC LIMIT 1 OFFSET ?", maxEvents).Scan(&boundary)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(ctx, "DELETE FROM audit_events WHERE seq <= ?", boundary)
	return err
}

// Writable verifies the ledger can accept a write before a sensitive
// control-plane operation starts. It does not add a probe record to the
// semantic audit stream.
func (s *Store) Writable() error {
	if s == nil {
		return fmt.Errorf("audit store is not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	if err := s.db.Ready(ctx); err != nil {
		return fmt.Errorf("open audit log: %w", err)
	}
	return nil
}

// Recent returns up to limit events, newest first.
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
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT seq, id, occurred_at, actor, action, target, outcome, request_id
		FROM audit_events ORDER BY seq DESC LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("read audit log: %w", err)
	}
	defer rows.Close()
	items := make([]domain.AuditEvent, 0, limit)
	bySeq := map[int64]int{}
	seqs := make([]any, 0, limit)
	for rows.Next() {
		var seq int64
		var event domain.AuditEvent
		var requestID sql.NullString
		if err := rows.Scan(&seq, &event.ID, &event.OccurredAt, &event.Actor, &event.Action, &event.Target, &event.Outcome, &requestID); err != nil {
			return nil, fmt.Errorf("read audit log: %w", err)
		}
		event.RequestID = requestID.String
		bySeq[seq] = len(items)
		seqs = append(seqs, seq)
		items = append(items, event)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("read audit log: %w", err)
	}
	if len(seqs) == 0 {
		return items, nil
	}
	details, err := s.db.Pool().QueryContext(ctx,
		"SELECT event_seq, detail_key, detail_value FROM audit_event_details WHERE event_seq IN ("+placeholders(len(seqs))+")", seqs...)
	if err != nil {
		return nil, fmt.Errorf("read audit details: %w", err)
	}
	defer details.Close()
	for details.Next() {
		var seq int64
		var key, value string
		if err := details.Scan(&seq, &key, &value); err != nil {
			return nil, fmt.Errorf("read audit details: %w", err)
		}
		index := bySeq[seq]
		if items[index].Detail == nil {
			items[index].Detail = map[string]string{}
		}
		items[index].Detail[key] = value
	}
	if err := details.Err(); err != nil {
		return nil, fmt.Errorf("read audit details: %w", err)
	}
	return items, nil
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

func nullString(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

func placeholders(count int) string {
	return strings.TrimSuffix(strings.Repeat("?,", count), ",")
}
