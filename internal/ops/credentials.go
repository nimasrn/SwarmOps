package ops

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// CredentialStore holds the connection URIs the controller generated for
// managed databases, sealed per row.
//
// A Swarm secret cannot be read back, so without this record SwarmOps could
// never wire a second application to a database it created earlier — it would
// have to rotate the password and restart the database instead. The URIs are
// AES-256-GCM sealed with the controller's data key, bound to their engine and
// application, never returned by any endpoint or written to the audit trail,
// and removed when the database is removed.
//
// A nil store simply reports that no credential is available, so a controller
// configured without one degrades to "deploy the database first" rather than
// failing at startup.
type CredentialStore struct {
	db *sqlstore.DB
}

func NewCredentialStore(db *sqlstore.DB) (*CredentialStore, error) {
	if db == nil {
		return nil, fmt.Errorf("credential store requires a database")
	}
	return &CredentialStore{db: db}, nil
}

func sharedCredentialPurpose(engine string) string {
	return sqlstore.Purpose("database_credentials", "uri_sealed", engine)
}

func applicationCredentialPurpose(application, engine string) string {
	return sqlstore.Purpose("application_database_credentials", "uri_sealed", application, engine)
}

// PutApplication seals one application's own connection URI for one engine.
// Replacing an existing value is how a repaired bootstrap converges; the
// caller seals before it creates anything in the cluster.
func (s *CredentialStore) PutApplication(application, engine, uri string) error {
	if s == nil {
		return fmt.Errorf("sealed database credentials are not configured")
	}
	sealed, err := s.db.Seal(applicationCredentialPurpose(application, engine), []byte(uri))
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	_, err = s.db.Pool().ExecContext(ctx, `INSERT INTO application_database_credentials (application_name, engine, uri_sealed, updated_at)
		VALUES (?, ?, ?, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE uri_sealed = VALUES(uri_sealed), updated_at = VALUES(updated_at)`,
		application, engine, sealed)
	if err != nil {
		return fmt.Errorf("save sealed database credential: %w", err)
	}
	return nil
}

// GetApplication returns one application's sealed URI for one engine.
func (s *CredentialStore) GetApplication(application, engine string) (string, bool) {
	if s == nil {
		return "", false
	}
	return s.read("SELECT uri_sealed FROM application_database_credentials WHERE application_name = ? AND engine = ?",
		applicationCredentialPurpose(application, engine), application, engine)
}

// ForgetApplication drops every engine credential for one application. It runs
// when the application is removed, so the controller stops holding credentials
// for something that no longer exists. The database user itself survives, in
// the same way a removed database keeps its volume: dropping it would take the
// application's data with it, which is not a removal's business.
func (s *CredentialStore) ForgetApplication(application string) {
	if s == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	_, _ = s.db.Pool().ExecContext(ctx, "DELETE FROM application_database_credentials WHERE application_name = ?", application)
}

// Put seals one engine's connection URI, replacing any previous value.
func (s *CredentialStore) Put(engine, uri string) error {
	if s == nil {
		return fmt.Errorf("sealed database credentials are not configured")
	}
	sealed, err := s.db.Seal(sharedCredentialPurpose(engine), []byte(uri))
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	_, err = s.db.Pool().ExecContext(ctx, `INSERT INTO database_credentials (engine, uri_sealed, updated_at)
		VALUES (?, ?, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE uri_sealed = VALUES(uri_sealed), updated_at = VALUES(updated_at)`,
		engine, sealed)
	if err != nil {
		return fmt.Errorf("save sealed database credential: %w", err)
	}
	return nil
}

// Get returns the sealed URI for one engine.
func (s *CredentialStore) Get(engine string) (string, bool) {
	if s == nil {
		return "", false
	}
	return s.read("SELECT uri_sealed FROM database_credentials WHERE engine = ?", sharedCredentialPurpose(engine), engine)
}

// Forget drops one engine's URI. It runs when the database is removed, so the
// controller stops holding a credential for something that no longer exists.
func (s *CredentialStore) Forget(engine string) {
	if s == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	_, _ = s.db.Pool().ExecContext(ctx, "DELETE FROM database_credentials WHERE engine = ?", engine)
}

func (s *CredentialStore) read(query, purpose string, args ...any) (string, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), appStoreTimeout)
	defer cancel()
	var sealed []byte
	if err := s.db.Pool().QueryRowContext(ctx, query, args...).Scan(&sealed); err != nil {
		return "", false
	}
	uri, err := s.db.Open(purpose, sealed)
	if err != nil {
		return "", false
	}
	return string(uri), true
}

const databaseCredentialStateKey = "database-credentials"

type databaseCredentials struct {
	ApplicationURIs map[string]string `json:"applicationUris,omitempty"`
	URIs            map[string]string `json:"uris"`
	Version         int               `json:"version"`
}

// ImportCredentialFiles copies a pre-database database-credentials.sealed file
// into the database, re-sealing each URI under its row-bound purpose, and
// reports how many URIs it held. The file itself is kept as the backup.
func ImportCredentialFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, err
	}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "database-credentials.sealed"), databaseCredentialStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("read sealed database credentials: %w", err)
	}
	var saved databaseCredentials
	if err := json.Unmarshal(data, &saved); err != nil {
		return 0, fmt.Errorf("read sealed database credentials: %w", err)
	}
	if saved.Version < 1 || saved.Version > 2 {
		return 0, fmt.Errorf("unsupported sealed database credential version")
	}
	count := 0
	err = db.WithTx(ctx, func(tx *sql.Tx) error {
		count = 0
		for engine, uri := range saved.URIs {
			sealed, err := db.Seal(sharedCredentialPurpose(engine), []byte(uri))
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO database_credentials (engine, uri_sealed, updated_at) VALUES (?, ?, UTC_TIMESTAMP(6))
				ON DUPLICATE KEY UPDATE uri_sealed = VALUES(uri_sealed), updated_at = VALUES(updated_at)`, engine, sealed); err != nil {
				return err
			}
			count++
		}
		for key, uri := range saved.ApplicationURIs {
			application, engine, found := strings.Cut(key, "/")
			if !found {
				return fmt.Errorf("sealed application credential key %q is malformed", key)
			}
			sealed, err := db.Seal(applicationCredentialPurpose(application, engine), []byte(uri))
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO application_database_credentials (application_name, engine, uri_sealed, updated_at)
				VALUES (?, ?, ?, UTC_TIMESTAMP(6)) ON DUPLICATE KEY UPDATE uri_sealed = VALUES(uri_sealed), updated_at = VALUES(updated_at)`,
				application, engine, sealed); err != nil {
				return err
			}
			count++
		}
		return nil
	})
	if err != nil {
		return 0, fmt.Errorf("import database credentials: %w", err)
	}
	return count, nil
}
