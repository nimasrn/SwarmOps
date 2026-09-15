package source

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// storeTimeout bounds one source-store statement; the method set takes no
// context, so each call carries its own deadline.
const storeTimeout = 10 * time.Second

type storedConnection struct {
	Connection
	Token string `json:"token"`
}

// Store owns provider credentials. The only method that returns a token is
// intentionally package-private so HTTP handlers cannot accidentally encode
// one in a response. Tokens are sealed per row and bound to their connection.
type Store struct {
	db  *sqlstore.DB
	now func() time.Time
}

func NewStore(db *sqlstore.DB) (*Store, error) {
	if db == nil {
		return nil, fmt.Errorf("source connection store requires a database")
	}
	return &Store{db: db, now: time.Now}, nil
}

func tokenPurpose(id string) string {
	return sqlstore.Purpose("source_connections", "token_sealed", id)
}

func (s *Store) List() []Connection {
	if s == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	rows, err := s.db.Pool().QueryContext(ctx, `SELECT id, kind, name, base_url, account, created_at, updated_at
		FROM source_connections ORDER BY name, id`)
	if err != nil {
		return nil
	}
	defer rows.Close()
	result := []Connection{}
	for rows.Next() {
		connection, err := scanConnection(rows)
		if err != nil {
			return nil
		}
		result = append(result, connection)
	}
	if rows.Err() != nil {
		return nil
	}
	return result
}

type rowScanner interface {
	Scan(dest ...any) error
}

func scanConnection(row rowScanner, extra ...any) (Connection, error) {
	var connection Connection
	var account sql.NullString
	var kind string
	dest := append([]any{&connection.ID, &kind, &connection.Name, &connection.BaseURL, &account, &connection.CreatedAt, &connection.UpdatedAt}, extra...)
	if err := row.Scan(dest...); err != nil {
		return Connection{}, err
	}
	connection.Kind = ProviderKind(kind)
	connection.Account = account.String
	connection.CredentialState = "stored"
	return connection, nil
}

func (s *Store) Create(input ConnectionInput, account string) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("source connections are not configured")
	}
	id, err := newConnectionID()
	if err != nil {
		return Connection{}, err
	}
	now := s.now().UTC().Truncate(time.Microsecond)
	record := Connection{
		Account:         strings.TrimSpace(account),
		BaseURL:         input.BaseURL,
		CreatedAt:       now,
		CredentialState: "stored",
		ID:              id,
		Kind:            input.Kind,
		Name:            input.Name,
		UpdatedAt:       now,
	}
	sealed, err := s.db.Seal(tokenPurpose(id), []byte(input.Token))
	if err != nil {
		return Connection{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	if _, err := s.db.Pool().ExecContext(ctx, `INSERT INTO source_connections (id, kind, name, base_url, account, token_sealed, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		id, string(record.Kind), record.Name, record.BaseURL, nullText(record.Account), sealed, now, now); err != nil {
		return Connection{}, fmt.Errorf("save source connection: %w", err)
	}
	return record, nil
}

func (s *Store) Update(id string, input ConnectionInput, account string) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("source connections are not configured")
	}
	id = strings.TrimSpace(id)
	sealed, err := s.db.Seal(tokenPurpose(id), []byte(input.Token))
	if err != nil {
		return Connection{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	var updated Connection
	err = s.db.WithTx(ctx, func(tx *sql.Tx) error {
		existing, err := scanConnection(tx.QueryRowContext(ctx, `SELECT id, kind, name, base_url, account, created_at, updated_at
			FROM source_connections WHERE id = ? FOR UPDATE`, id))
		if errors.Is(err, sql.ErrNoRows) {
			return os.ErrNotExist
		}
		if err != nil {
			return err
		}
		updated = existing
		updated.Account = strings.TrimSpace(account)
		updated.BaseURL = input.BaseURL
		updated.Kind = input.Kind
		updated.Name = input.Name
		updated.UpdatedAt = s.now().UTC().Truncate(time.Microsecond)
		_, err = tx.ExecContext(ctx, `UPDATE source_connections SET kind = ?, name = ?, base_url = ?, account = ?, token_sealed = ?, updated_at = ?
			WHERE id = ?`, string(updated.Kind), updated.Name, updated.BaseURL, nullText(updated.Account), sealed, updated.UpdatedAt, id)
		return err
	})
	if errors.Is(err, os.ErrNotExist) {
		return Connection{}, os.ErrNotExist
	}
	if err != nil {
		return Connection{}, fmt.Errorf("save source connection: %w", err)
	}
	return updated, nil
}

func (s *Store) Remove(id string) error {
	if s == nil {
		return fmt.Errorf("source connections are not configured")
	}
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	result, err := s.db.Pool().ExecContext(ctx, "DELETE FROM source_connections WHERE id = ?", strings.TrimSpace(id))
	if err != nil {
		return fmt.Errorf("remove source connection: %w", err)
	}
	if affected, err := result.RowsAffected(); err == nil && affected == 0 {
		return os.ErrNotExist
	}
	return nil
}

func (s *Store) get(id string) (storedConnection, bool) {
	if s == nil {
		return storedConnection{}, false
	}
	id = strings.TrimSpace(id)
	ctx, cancel := context.WithTimeout(context.Background(), storeTimeout)
	defer cancel()
	var sealed []byte
	connection, err := scanConnection(s.db.Pool().QueryRowContext(ctx, `SELECT id, kind, name, base_url, account, created_at, updated_at, token_sealed
		FROM source_connections WHERE id = ?`, id), &sealed)
	if err != nil {
		return storedConnection{}, false
	}
	token, err := s.db.Open(tokenPurpose(connection.ID), sealed)
	if err != nil {
		return storedConnection{}, false
	}
	return storedConnection{Connection: connection, Token: string(token)}, true
}

func newConnectionID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate source connection id: %w", err)
	}
	return hex.EncodeToString(value), nil
}

func nullText(value string) sql.NullString {
	return sql.NullString{String: value, Valid: value != ""}
}

const connectionStateKey = "source-connections"

type connectionFile struct {
	Connections []storedConnection `json:"connections"`
	Version     int                `json:"version"`
}

// ImportConnectionFiles copies a pre-database source-connections.sealed file
// into the database, re-sealing each token under its row-bound purpose, and
// reports how many connections it held. Re-running it overwrites each row with
// the file's copy. The file itself is kept as the backup.
func ImportConnectionFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "source-connections.sealed"), connectionStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read sealed source connections: %w", err)
	}
	var saved connectionFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return 0, fmt.Errorf("read sealed source connections: %w", err)
	}
	if saved.Version != 1 {
		return 0, fmt.Errorf("unsupported sealed source connection version")
	}
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		for _, connection := range saved.Connections {
			if connection.ID == "" || connection.Token == "" {
				return fmt.Errorf("read sealed source connections: invalid record")
			}
			sealed, err := db.Seal(tokenPurpose(connection.ID), []byte(connection.Token))
			if err != nil {
				return err
			}
			created := connection.CreatedAt.UTC().Truncate(time.Microsecond)
			updated := connection.UpdatedAt.UTC().Truncate(time.Microsecond)
			if created.IsZero() {
				created = time.Now().UTC().Truncate(time.Microsecond)
			}
			if updated.IsZero() {
				updated = created
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO source_connections (id, kind, name, base_url, account, token_sealed, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE kind = VALUES(kind), name = VALUES(name), base_url = VALUES(base_url), account = VALUES(account),
				 token_sealed = VALUES(token_sealed), updated_at = VALUES(updated_at)`,
				connection.ID, string(connection.Kind), connection.Name, connection.BaseURL, nullText(connection.Account), sealed, created, updated); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import source connections: %w", err)
	}
	return len(saved.Connections), nil
}
