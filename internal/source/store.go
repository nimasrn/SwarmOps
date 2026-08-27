package source

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/nimasrn/SwarmOps/internal/securestore"
)

const (
	connectionStateKey = "source-connections"
	connectionVersion  = 1
)

type storedConnection struct {
	Connection
	Token string `json:"token"`
}

type connectionFile struct {
	Connections []storedConnection `json:"connections"`
	Version     int                `json:"version"`
}

// Store owns provider credentials. The only method that returns a token is
// intentionally package-private so HTTP handlers cannot accidentally encode
// one in a response.
type Store struct {
	mu          sync.RWMutex
	now         func() time.Time
	path        string
	sealer      *securestore.Sealer
	connections map[string]storedConnection
}

func NewStore(dataDir string, dataEncryptionKey []byte) (*Store, error) {
	if strings.TrimSpace(dataDir) == "" {
		return nil, fmt.Errorf("source connection data directory is required")
	}
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return nil, fmt.Errorf("configure sealed source connections: %w", err)
	}
	store := &Store{
		connections: map[string]storedConnection{},
		now:         time.Now,
		path:        filepath.Join(dataDir, "source-connections.sealed"),
		sealer:      sealer,
	}
	data, err := sealer.ReadFile(store.path, connectionStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read sealed source connections: %w", err)
	}
	var saved connectionFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return nil, fmt.Errorf("read sealed source connections: %w", err)
	}
	if saved.Version != connectionVersion {
		return nil, fmt.Errorf("unsupported sealed source connection version")
	}
	for _, connection := range saved.Connections {
		if connection.ID == "" || connection.Token == "" {
			return nil, fmt.Errorf("read sealed source connections: invalid record")
		}
		connection.CredentialState = "stored"
		store.connections[connection.ID] = connection
	}
	return store, nil
}

func (s *Store) List() []Connection {
	if s == nil {
		return nil
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]Connection, 0, len(s.connections))
	for _, stored := range s.connections {
		result = append(result, stored.Connection)
	}
	sort.Slice(result, func(left, right int) bool {
		if result[left].Name != result[right].Name {
			return result[left].Name < result[right].Name
		}
		return result[left].ID < result[right].ID
	})
	return result
}

func (s *Store) Create(input ConnectionInput, account string) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("sealed source connections are not configured")
	}
	id, err := newConnectionID()
	if err != nil {
		return Connection{}, err
	}
	now := s.now().UTC()
	record := storedConnection{Connection: Connection{
		Account:         strings.TrimSpace(account),
		BaseURL:         input.BaseURL,
		CreatedAt:       now,
		CredentialState: "stored",
		ID:              id,
		Kind:            input.Kind,
		Name:            input.Name,
		UpdatedAt:       now,
	}, Token: input.Token}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.connections[id] = record
	if err := s.saveLocked(); err != nil {
		delete(s.connections, id)
		return Connection{}, err
	}
	return record.Connection, nil
}

func (s *Store) Update(id string, input ConnectionInput, account string) (Connection, error) {
	if s == nil {
		return Connection{}, fmt.Errorf("sealed source connections are not configured")
	}
	id = strings.TrimSpace(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, found := s.connections[id]
	if !found {
		return Connection{}, os.ErrNotExist
	}
	record := previous
	record.Account = strings.TrimSpace(account)
	record.BaseURL = input.BaseURL
	record.Kind = input.Kind
	record.Name = input.Name
	record.Token = input.Token
	record.UpdatedAt = s.now().UTC()
	record.CredentialState = "stored"
	s.connections[id] = record
	if err := s.saveLocked(); err != nil {
		s.connections[id] = previous
		return Connection{}, err
	}
	return record.Connection, nil
}

func (s *Store) Remove(id string) error {
	if s == nil {
		return fmt.Errorf("sealed source connections are not configured")
	}
	id = strings.TrimSpace(id)
	s.mu.Lock()
	defer s.mu.Unlock()
	previous, found := s.connections[id]
	if !found {
		return os.ErrNotExist
	}
	delete(s.connections, id)
	if err := s.saveLocked(); err != nil {
		s.connections[id] = previous
		return err
	}
	return nil
}

func (s *Store) get(id string) (storedConnection, bool) {
	if s == nil {
		return storedConnection{}, false
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	record, found := s.connections[strings.TrimSpace(id)]
	return record, found
}

func (s *Store) saveLocked() error {
	records := make([]storedConnection, 0, len(s.connections))
	for _, record := range s.connections {
		records = append(records, record)
	}
	sort.Slice(records, func(left, right int) bool { return records[left].ID < records[right].ID })
	data, err := json.Marshal(connectionFile{Connections: records, Version: connectionVersion})
	if err != nil {
		return fmt.Errorf("encode sealed source connections: %w", err)
	}
	if err := s.sealer.WriteFile(s.path, connectionStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed source connections: %w", err)
	}
	return nil
}

func newConnectionID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate source connection id: %w", err)
	}
	return hex.EncodeToString(value), nil
}
