package ops

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const databaseCredentialStateKey = "database-credentials"

// databaseCredentials is the controller's sealed record of the connection URIs
// it generated for managed databases.
//
// A Swarm secret cannot be read back, so without this record SwarmOps could
// never wire a second application to a database it created earlier — it would
// have to rotate the password and restart the database instead. The URIs are
// AES-256-GCM sealed in the controller's own volume with the same key as the
// server profiles and command ledger, are never returned by any endpoint or
// written to the audit trail, and are removed when the database is removed.
type databaseCredentials struct {
	URIs    map[string]string `json:"uris"`
	Version int               `json:"version"`
}

// CredentialStore holds those sealed URIs. A nil store simply reports that no
// credential is available, so a controller configured without one degrades to
// "deploy the database first" rather than failing at startup.
type CredentialStore struct {
	mu     sync.Mutex
	path   string
	sealer *securestore.Sealer
	uris   map[string]string
}

func NewCredentialStore(dataDir string, dataEncryptionKey []byte) (*CredentialStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("credential store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed database credentials: %w", err)
	}
	store := &CredentialStore{path: filepath.Join(dataDir, "database-credentials.sealed"), sealer: sealer, uris: map[string]string{}}
	data, err := sealer.ReadFile(store.path, databaseCredentialStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed database credentials: %w", err)
	}
	var saved databaseCredentials
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("read sealed database credentials: %w", err)
	}
	if saved.Version != 1 {
		return nil, fmt.Errorf("unsupported sealed database credential version")
	}
	for engine, uri := range saved.URIs {
		store.uris[engine] = uri
	}
	return store, nil
}

// Put seals one engine's connection URI, replacing any previous value.
func (s *CredentialStore) Put(engine, uri string) error {
	if s == nil {
		return fmt.Errorf("sealed database credentials are not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, existed := s.uris[engine]
	s.uris[engine] = uri
	if err := s.saveLocked(); err != nil {
		if existed {
			s.uris[engine] = previous
		} else {
			delete(s.uris, engine)
		}
		return err
	}
	return nil
}

// Get returns the sealed URI for one engine.
func (s *CredentialStore) Get(engine string) (string, bool) {
	if s == nil {
		return "", false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	uri, found := s.uris[engine]
	return uri, found
}

// Forget drops one engine's URI. It runs when the database is removed, so the
// controller stops holding a credential for something that no longer exists.
func (s *CredentialStore) Forget(engine string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, found := s.uris[engine]; !found {
		return
	}
	delete(s.uris, engine)
	_ = s.saveLocked()
}

func (s *CredentialStore) saveLocked() error {
	data, err := json.Marshal(databaseCredentials{URIs: s.uris, Version: 1})
	if err != nil {
		return fmt.Errorf("encode sealed database credentials: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, databaseCredentialStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed database credentials: %w", err)
	}
	return nil
}
