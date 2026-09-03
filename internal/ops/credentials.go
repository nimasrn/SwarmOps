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
	// ApplicationURIs holds the per-application credentials keyed by
	// "<application>/<engine>". They exist for the same reason as URIs: the
	// password inside them was written to a Swarm secret that can never be
	// read back, so this record is the only way a later deployment of the same
	// application can be handed the credential it already owns instead of
	// having one rotated underneath it.
	ApplicationURIs map[string]string `json:"applicationUris,omitempty"`
	URIs            map[string]string `json:"uris"`
	Version         int               `json:"version"`
}

// credentialVersion is 2 since per-application URIs were added. A version 1
// file is still read: it simply has no application credentials yet.
const credentialVersion = 2

func applicationCredentialKey(application, engine string) string {
	return application + "/" + engine
}

// CredentialStore holds those sealed URIs. A nil store simply reports that no
// credential is available, so a controller configured without one degrades to
// "deploy the database first" rather than failing at startup.
type CredentialStore struct {
	applicationURIs map[string]string
	mu              sync.Mutex
	path            string
	sealer          *securestore.Sealer
	uris            map[string]string
}

func NewCredentialStore(dataDir string, dataEncryptionKey []byte) (*CredentialStore, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("credential store data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed database credentials: %w", err)
	}
	store := &CredentialStore{applicationURIs: map[string]string{}, path: filepath.Join(dataDir, "database-credentials.sealed"), sealer: sealer, uris: map[string]string{}}
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
	if saved.Version < 1 || saved.Version > credentialVersion {
		return nil, fmt.Errorf("unsupported sealed database credential version")
	}
	for engine, uri := range saved.URIs {
		store.uris[engine] = uri
	}
	for key, uri := range saved.ApplicationURIs {
		store.applicationURIs[key] = uri
	}
	return store, nil
}

// PutApplication seals one application's own connection URI for one engine.
// Replacing an existing value is how a repaired bootstrap converges; the
// caller seals before it creates anything in the cluster.
func (s *CredentialStore) PutApplication(application, engine, uri string) error {
	if s == nil {
		return fmt.Errorf("sealed database credentials are not configured")
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	key := applicationCredentialKey(application, engine)
	previous, existed := s.applicationURIs[key]
	s.applicationURIs[key] = uri
	if err := s.saveLocked(); err != nil {
		if existed {
			s.applicationURIs[key] = previous
		} else {
			delete(s.applicationURIs, key)
		}
		return err
	}
	return nil
}

// GetApplication returns one application's sealed URI for one engine.
func (s *CredentialStore) GetApplication(application, engine string) (string, bool) {
	if s == nil {
		return "", false
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	uri, found := s.applicationURIs[applicationCredentialKey(application, engine)]
	return uri, found
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
	s.mu.Lock()
	defer s.mu.Unlock()
	prefix := application + "/"
	removed := false
	for key := range s.applicationURIs {
		if strings.HasPrefix(key, prefix) {
			delete(s.applicationURIs, key)
			removed = true
		}
	}
	if removed {
		_ = s.saveLocked()
	}
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
	data, err := json.Marshal(databaseCredentials{ApplicationURIs: s.applicationURIs, URIs: s.uris, Version: credentialVersion})
	if err != nil {
		return fmt.Errorf("encode sealed database credentials: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, databaseCredentialStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed database credentials: %w", err)
	}
	return nil
}
