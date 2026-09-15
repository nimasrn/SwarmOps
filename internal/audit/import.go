package audit

import (
	"bufio"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// auditStateKey is the purpose the pre-database sealed audit file was bound to.
const auditStateKey = "audit-events"

type auditFile struct {
	Events  []domain.AuditEvent
	Version int
}

// ImportFiles copies a pre-database audit history — the sealed audit.sealed
// file, or the older plaintext audit.ndjson — into the database in its
// original order. Events already present by id are skipped, so an interrupted
// import can be re-run. The source files are left in place as the backup.
func ImportFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	events, err := readFiles(dataDir, dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	imported := 0
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		imported = 0
		for _, event := range events {
			var exists int
			err := tx.QueryRowContext(ctx, "SELECT 1 FROM audit_events WHERE id = ?", event.ID).Scan(&exists)
			if err == nil {
				continue
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			if err := insertEvent(ctx, tx, event); err != nil {
				return err
			}
			imported++
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import audit history: %w", err)
	}
	return imported, nil
}

func readFiles(dataDir string, key []byte) ([]domain.AuditEvent, error) {
	sealer, err := securestore.New(key)
	if err != nil {
		return nil, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "audit.sealed"), auditStateKey)
	if err == nil {
		var saved auditFile
		if err := json.Unmarshal(data, &saved); err != nil {
			return nil, fmt.Errorf("decode audit log: %w", err)
		}
		if saved.Version != 1 {
			return nil, fmt.Errorf("unsupported audit log version")
		}
		return normalise(saved.Events)
	}
	if !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("read audit log: %w", err)
	}
	file, err := os.Open(filepath.Join(dataDir, "audit.ndjson"))
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read legacy audit log: %w", err)
	}
	defer file.Close()
	var events []domain.AuditEvent
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 8<<10), 1<<20)
	for scanner.Scan() {
		var event domain.AuditEvent
		if err := json.Unmarshal(scanner.Bytes(), &event); err != nil {
			return nil, fmt.Errorf("decode legacy audit event: %w", err)
		}
		events = append(events, event)
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read legacy audit log: %w", err)
	}
	return normalise(events)
}

// normalise gives every imported event an id and a storable timestamp. An old
// plaintext record may carry no time at all; MySQL's strict mode refuses the
// zero date, so such an event is stamped with the import time and says so in
// its details rather than pretending to know when it happened.
func normalise(events []domain.AuditEvent) ([]domain.AuditEvent, error) {
	importedAt := time.Now().UTC().Truncate(time.Microsecond)
	for index := range events {
		if events[index].ID == "" {
			id, err := newID()
			if err != nil {
				return nil, err
			}
			events[index].ID = id
		}
		if events[index].OccurredAt.IsZero() {
			events[index].OccurredAt = importedAt
			detail := make(map[string]string, len(events[index].Detail)+1)
			for key, value := range events[index].Detail {
				detail[key] = value
			}
			detail["importedWithoutTimestamp"] = "true"
			events[index].Detail = detail
		}
		events[index].OccurredAt = events[index].OccurredAt.UTC().Truncate(time.Microsecond)
	}
	return events, nil
}
