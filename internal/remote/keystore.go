package remote

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"

	"github.com/nimasrn/SwarmOps/internal/domain"
)

const keyStateKey = "server-keys"

// Machine API keys are sealed beside the server profiles when key retention is
// enabled. This is a deliberate trade: an enrolled operator never sees the key,
// so without retention every controller restart would strand every host until
// its agent was reinstalled. The key is AES-256-GCM sealed in the controller's
// own volume, never returned by any endpoint, and never written to the audit
// trail. Operators who prefer the memory-only posture can disable retention and
// reconnect each host by hand.
type keyFile struct {
	Keys    map[string]string `json:"keys"`
	Version int               `json:"version"`
}

// ManagerOptions carries construction settings that are not part of the
// long-standing two-argument constructor.
type ManagerOptions struct {
	RetainKeys bool
}

func (m *Manager) loadKeys() error {
	if !m.retainKeys {
		return nil
	}
	data, err := m.store.ReadFile(m.keysPath, keyStateKey)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("read sealed machine API keys: %w", err)
	}
	var saved keyFile
	if err := json.Unmarshal(data, &saved); err != nil {
		return fmt.Errorf("read sealed machine API keys: %w", err)
	}
	if saved.Version != 1 {
		return fmt.Errorf("unsupported sealed machine API key version")
	}
	for id, key := range saved.Keys {
		if len(key) >= 16 {
			m.keys[id] = key
		}
	}
	return nil
}

// rememberKeyLocked must be called with the write lock held. A failure to seal
// the key is reported, not swallowed: a silently unsaved key would produce a
// host that reconnects today and is stranded after the next restart.
func (m *Manager) rememberKeyLocked(id, key string) error {
	if !m.retainKeys || len(key) < 16 {
		return nil
	}
	previous, existed := m.keys[id]
	m.keys[id] = key
	if err := m.saveKeysLocked(); err != nil {
		if existed {
			m.keys[id] = previous
		} else {
			delete(m.keys, id)
		}
		return err
	}
	return nil
}

func (m *Manager) forgetKeyLocked(id string) {
	if !m.retainKeys {
		return
	}
	if _, found := m.keys[id]; !found {
		return
	}
	delete(m.keys, id)
	// A stale sealed key is a credential-lifetime problem, not a request
	// failure: the caller has already disconnected or removed the profile.
	_ = m.saveKeysLocked()
}

func (m *Manager) saveKeysLocked() error {
	keys := make(map[string]string, len(m.keys))
	for id, key := range m.keys {
		if _, found := m.profiles[id]; found {
			keys[id] = key
		}
	}
	data, err := json.Marshal(keyFile{Keys: keys, Version: 1})
	if err != nil {
		return fmt.Errorf("encode sealed machine API keys: %w", err)
	}
	if err := m.store.WriteFile(m.keysPath, keyStateKey, append(data, '\n')); err != nil {
		return fmt.Errorf("save sealed machine API keys: %w", err)
	}
	return nil
}

// Resume reconnects every saved machine-API profile whose key was retained. A
// host that cannot be reached is left disconnected rather than blocking
// startup; the console shows it as needing attention and the operator can
// reconnect or re-enroll it.
func (m *Manager) Resume(ctx context.Context) []error {
	if !m.retainKeys {
		return nil
	}
	m.mu.RLock()
	pending := make(map[string]domain.Server, len(m.keys))
	for id, profile := range m.profiles {
		if _, found := m.keys[id]; found && profile.ConnectionType == ConnectionAgentAPI {
			pending[id] = profile
		}
	}
	m.mu.RUnlock()

	ids := make([]string, 0, len(pending))
	for id := range pending {
		ids = append(ids, id)
	}
	sort.Strings(ids)

	failures := make([]error, 0)
	for _, id := range ids {
		m.mu.RLock()
		key := m.keys[id]
		m.mu.RUnlock()
		credentials := Credentials{APIKey: key, Authentication: AuthenticationAPIKey}
		connection, profile, err := establish(ctx, pending[id], credentials)
		scrubCredentials(&credentials)
		if err != nil {
			failures = append(failures, fmt.Errorf("resume %s: %w", pending[id].Name, err))
			continue
		}
		m.mu.Lock()
		if _, found := m.profiles[id]; !found {
			m.mu.Unlock()
			connection.close()
			continue
		}
		previous := m.connections[id]
		m.profiles[id] = profile
		m.connections[id] = connection
		m.mu.Unlock()
		if previous != nil {
			previous.close()
		}
	}
	return failures
}

func keysPathFor(dataDir string) string { return filepath.Join(dataDir, "server-keys.sealed") }
