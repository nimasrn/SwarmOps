package remote

import (
	"context"
	"database/sql"
	"fmt"
	"sort"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

// Machine API keys are sealed beside the server profiles when key retention is
// enabled. This is a deliberate trade: an enrolled operator never sees the key,
// so without retention every controller restart would strand every host until
// its agent was reinstalled. The key is AES-256-GCM sealed with the
// controller's data key and bound to its server id, never returned by any
// endpoint, and never written to the audit trail. Operators who prefer the
// memory-only posture can disable retention and reconnect each host by hand.

// ManagerOptions carries construction settings that are not part of the
// long-standing constructor.
type ManagerOptions struct {
	RetainKeys bool
}

func serverKeyPurpose(id string) string {
	return sqlstore.Purpose("server_keys", "api_key_sealed", id)
}

func (m *Manager) loadKeys() error {
	if !m.retainKeys {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.Background(), managerTimeout)
	defer cancel()
	rows, err := m.db.Pool().QueryContext(ctx, "SELECT server_id, api_key_sealed FROM server_keys")
	if err != nil {
		return fmt.Errorf("read sealed machine API keys: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var id string
		var sealed []byte
		if err := rows.Scan(&id, &sealed); err != nil {
			return fmt.Errorf("read sealed machine API keys: %w", err)
		}
		key, err := m.db.Open(serverKeyPurpose(id), sealed)
		if err != nil {
			return fmt.Errorf("read sealed machine API keys: %w", err)
		}
		if len(key) >= 16 {
			m.keys[id] = string(key)
		}
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("read sealed machine API keys: %w", err)
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

// saveKeysLocked makes server_keys hold exactly the retained keys whose
// profile still exists.
func (m *Manager) saveKeysLocked() error {
	ctx, cancel := context.WithTimeout(context.Background(), managerTimeout)
	defer cancel()
	err := m.db.WithTx(ctx, func(tx *sql.Tx) error {
		rows, err := tx.QueryContext(ctx, "SELECT server_id FROM server_keys")
		if err != nil {
			return err
		}
		var stale []string
		for rows.Next() {
			var id string
			if err := rows.Scan(&id); err != nil {
				_ = rows.Close()
				return err
			}
			if _, keep := m.keys[id]; !keep {
				stale = append(stale, id)
			}
		}
		if err := rows.Close(); err != nil {
			return err
		}
		for _, id := range stale {
			if _, err := tx.ExecContext(ctx, "DELETE FROM server_keys WHERE server_id = ?", id); err != nil {
				return err
			}
		}
		for id, key := range m.keys {
			if _, found := m.profiles[id]; !found {
				continue
			}
			sealed, err := m.db.Seal(serverKeyPurpose(id), []byte(key))
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `INSERT INTO server_keys (server_id, api_key_sealed, updated_at) VALUES (?, ?, UTC_TIMESTAMP(6))
				ON DUPLICATE KEY UPDATE api_key_sealed = VALUES(api_key_sealed), updated_at = VALUES(updated_at)`, id, sealed); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
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
			_, _ = m.recordAgentFailure(id, err)
			continue
		}
		m.mu.Lock()
		if _, found := m.profiles[id]; !found {
			m.mu.Unlock()
			connection.close()
			continue
		}
		previous := m.connections[id]
		previousProfile := m.profiles[id]
		m.profiles[id] = profile
		m.connections[id] = connection
		if err := m.saveLocked(); err != nil {
			m.profiles[id] = previousProfile
			if previous == nil {
				delete(m.connections, id)
			} else {
				m.connections[id] = previous
			}
			m.mu.Unlock()
			connection.close()
			failures = append(failures, fmt.Errorf("resume %s: save health observation: %w", pending[id].Name, err))
			continue
		}
		m.mu.Unlock()
		if previous != nil {
			previous.close()
		}
	}
	return failures
}
