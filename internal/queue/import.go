package queue

import (
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

// storedRecord is one command as the pre-database sealed ledger held it.
type storedRecord struct {
	Artifact       bool            `json:"artifact,omitempty"`
	Command        domain.Command  `json:"command"`
	Events         bool            `json:"events,omitempty"`
	Output         bool            `json:"output,omitempty"`
	IdempotencyKey string          `json:"idempotencyKey,omitempty"`
	LeaseID        string          `json:"leaseId,omitempty"`
	Payload        json.RawMessage `json:"payload,omitempty"`
}

type storeFile struct {
	Commands []storedRecord `json:"commands"`
	Version  int            `json:"version"`
}

// ImportFiles copies a pre-database command ledger — commands/commands.sealed
// and the sealed event trails and execution logs beside it — into the database
// and reports how many commands it imported. Commands already present by id
// are skipped, so an interrupted import can be re-run. Build inputs are not
// moved: the database-backed store reads them from the same sealed files. The
// ledger files are kept as the backup.
func ImportFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	dir := filepath.Join(dataDir, "commands")
	inputsDir := filepath.Join(dir, "inputs")
	data, err := sealer.ReadFile(filepath.Join(dir, "commands.sealed"), stateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read command store: %w", err)
	}
	var persisted storeFile
	if err := json.Unmarshal(data, &persisted); err != nil {
		return 0, fmt.Errorf("decode command store: %w", err)
	}
	if persisted.Version != storeVersion {
		return 0, fmt.Errorf("unsupported command store version")
	}
	for _, record := range persisted.Commands {
		if err := validateStored(record); err != nil {
			return 0, fmt.Errorf("decode command store: %w", err)
		}
	}
	store := &Store{db: db, dir: dir, inputsDir: inputsDir, sealer: sealer}
	imported := 0
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		imported = 0
		for _, record := range persisted.Commands {
			var exists int
			err := tx.QueryRowContext(ctx, "SELECT 1 FROM commands WHERE id = ?", record.Command.ID).Scan(&exists)
			if err == nil {
				continue
			}
			if !errors.Is(err, sql.ErrNoRows) {
				return err
			}
			command := normaliseImported(record.Command)
			row := commandRow{artifact: record.Artifact, command: command, idempotencyKey: record.IdempotencyKey, leaseID: record.LeaseID, payloadDigest: digest(record.Payload)}
			if err := store.insertTx(ctx, tx, row, record.Payload); err != nil {
				return fmt.Errorf("import command %s: %w", command.ID, err)
			}
			if record.Events {
				events, err := readLegacyEvents(sealer, inputsDir, command.ID)
				if err != nil {
					return err
				}
				for _, event := range events {
					if _, err := tx.ExecContext(ctx, "INSERT INTO command_events (command_id, sequence, state, evidence, occurred_at) VALUES (?, ?, ?, ?, ?)",
						command.ID, event.Sequence, string(event.State), sql.NullString{String: event.Evidence, Valid: event.Evidence != ""}, event.OccurredAt.UTC()); err != nil {
						return err
					}
				}
			}
			if record.Output {
				output, err := sealer.ReadFile(filepath.Join(inputsDir, command.ID+".output.sealed"), "command-output:"+command.ID)
				if err != nil {
					return fmt.Errorf("read command output: %w", err)
				}
				sealed, err := db.Seal(outputPurpose(command.ID), output)
				if err != nil {
					return err
				}
				if _, err := tx.ExecContext(ctx, "INSERT INTO command_outputs (command_id, output_sealed, retained_at) VALUES (?, ?, ?)",
					command.ID, sealed, command.UpdatedAt); err != nil {
					return err
				}
			}
			imported++
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import command ledger: %w", err)
	}
	return imported, nil
}

func readLegacyEvents(sealer *securestore.Sealer, inputsDir, id string) ([]domain.CommandEvent, error) {
	data, err := sealer.ReadFile(filepath.Join(inputsDir, id+".events.sealed"), "command-events:"+id)
	if err != nil {
		return nil, fmt.Errorf("read command events: %w", err)
	}
	var events []domain.CommandEvent
	if err := json.Unmarshal(data, &events); err != nil {
		return nil, fmt.Errorf("decode command events: %w", err)
	}
	return events, nil
}

// normaliseImported gives a record the epoch floor the schema requires and
// truncates every timestamp to the microsecond the schema stores. MySQL rounds
// finer values on insert, so an untruncated time would read back different
// from the one this function returns.
func normaliseImported(command domain.Command) domain.Command {
	command = cloneCommand(command)
	command.AuthorityEpoch = max(command.AuthorityEpoch, 1)
	command.CreatedAt = command.CreatedAt.UTC().Truncate(time.Microsecond)
	command.UpdatedAt = command.UpdatedAt.UTC().Truncate(time.Microsecond)
	for _, value := range []*time.Time{command.LastAttemptAt, command.NextAttemptAt, command.LeaseExpiresAt} {
		if value != nil {
			*value = value.UTC().Truncate(time.Microsecond)
		}
	}
	return command
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
