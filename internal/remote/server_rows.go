package remote

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/nimasrn/SwarmOps/internal/domain"
	"github.com/nimasrn/SwarmOps/internal/securestore"
	"github.com/nimasrn/SwarmOps/internal/sqlstore"
)

const serverColumns = `id, name, host, port, username, authentication, connection_type, api_url, host_key_fingerprint,
	tls_certificate_fingerprint, docker_available, docker_version, swarm_control_available, swarm_state, last_connected_at,
	agent_version, agent_checked_at, agent_detail, agent_last_failure_at, agent_last_reachable_at, agent_protocol_version,
	agent_state, agent_summary, agent_uptime_seconds, update_automatic, update_checked_at, update_last_updated_at,
	update_requested_at, update_revision, update_state, update_version`

func loadServerRows(ctx context.Context, db *sqlstore.DB) ([]domain.Server, error) {
	rows, err := db.Pool().QueryContext(ctx, "SELECT "+serverColumns+" FROM servers ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var profiles []domain.Server
	index := map[string]int{}
	for rows.Next() {
		var profile domain.Server
		var connectionType, apiURL, tlsFingerprint, dockerVersion, swarmState sql.NullString
		var agentVersion, agentDetail, agentState, agentSummary sql.NullString
		var updateRevision, updateState, updateVersion sql.NullString
		var lastConnected, checkedAt, lastFailure, lastReachable sql.NullTime
		var updateChecked, updateLast, updateRequested sql.NullTime
		if err := rows.Scan(&profile.ID, &profile.Name, &profile.Host, &profile.Port, &profile.Username, &profile.Authentication,
			&connectionType, &apiURL, &profile.HostKeyFingerprint, &tlsFingerprint, &profile.DockerAvailable, &dockerVersion,
			&profile.SwarmControlAvailable, &swarmState, &lastConnected,
			&agentVersion, &checkedAt, &agentDetail, &lastFailure, &lastReachable, &profile.AgentHealth.ProtocolVersion,
			&agentState, &agentSummary, &profile.AgentHealth.UptimeSeconds, &profile.AgentHealth.Update.Automatic,
			&updateChecked, &updateLast, &updateRequested, &updateRevision, &updateState, &updateVersion); err != nil {
			return nil, err
		}
		profile.ConnectionType, profile.APIURL, profile.TLSCertificateFingerprint = connectionType.String, apiURL.String, tlsFingerprint.String
		profile.DockerVersion, profile.SwarmState, profile.LastConnectedAt = dockerVersion.String, swarmState.String, lastConnected.Time
		health := &profile.AgentHealth
		health.AgentVersion, health.CheckedAt, health.Detail = agentVersion.String, checkedAt.Time, agentDetail.String
		health.LastFailureAt, health.LastReachableAt = lastFailure.Time, lastReachable.Time
		health.State, health.Summary = domain.Health(agentState.String), agentSummary.String
		health.Update.CheckedAt, health.Update.LastUpdatedAt, health.Update.RequestedAt = updateChecked.Time, updateLast.Time, updateRequested.Time
		health.Update.Revision, health.Update.State, health.Update.Version = updateRevision.String, updateState.String, updateVersion.String
		index[profile.ID] = len(profiles)
		profiles = append(profiles, profile)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	events, err := db.Pool().QueryContext(ctx, "SELECT server_id, code, level, message, occurred_at, source FROM server_agent_events ORDER BY server_id, position")
	if err != nil {
		return nil, err
	}
	defer events.Close()
	for events.Next() {
		var id string
		var event domain.AgentEvent
		if err := events.Scan(&id, &event.Code, &event.Level, &event.Message, &event.OccurredAt, &event.Source); err != nil {
			return nil, err
		}
		if position, found := index[id]; found {
			profiles[position].AgentHealth.Events = append(profiles[position].AgentHealth.Events, event)
		}
	}
	return profiles, events.Err()
}

// replaceServerRows makes the servers table equal the given profile set.
func replaceServerRows(ctx context.Context, tx *sql.Tx, profiles []domain.Server) error {
	keep := make(map[string]bool, len(profiles))
	now := time.Now().UTC()
	for _, profile := range profiles {
		keep[profile.ID] = true
		health := profile.AgentHealth
		if _, err := tx.ExecContext(ctx, "INSERT INTO servers ("+serverColumns+`, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), host = VALUES(host), port = VALUES(port), username = VALUES(username),
			 authentication = VALUES(authentication), connection_type = VALUES(connection_type), api_url = VALUES(api_url),
			 host_key_fingerprint = VALUES(host_key_fingerprint), tls_certificate_fingerprint = VALUES(tls_certificate_fingerprint),
			 docker_available = VALUES(docker_available), docker_version = VALUES(docker_version),
			 swarm_control_available = VALUES(swarm_control_available), swarm_state = VALUES(swarm_state),
			 last_connected_at = VALUES(last_connected_at), agent_version = VALUES(agent_version), agent_checked_at = VALUES(agent_checked_at),
			 agent_detail = VALUES(agent_detail), agent_last_failure_at = VALUES(agent_last_failure_at),
			 agent_last_reachable_at = VALUES(agent_last_reachable_at), agent_protocol_version = VALUES(agent_protocol_version),
			 agent_state = VALUES(agent_state), agent_summary = VALUES(agent_summary), agent_uptime_seconds = VALUES(agent_uptime_seconds),
			 update_automatic = VALUES(update_automatic), update_checked_at = VALUES(update_checked_at),
			 update_last_updated_at = VALUES(update_last_updated_at), update_requested_at = VALUES(update_requested_at),
			 update_revision = VALUES(update_revision), update_state = VALUES(update_state), update_version = VALUES(update_version),
			 updated_at = VALUES(updated_at)`,
			profile.ID, profile.Name, profile.Host, profile.Port, profile.Username, profile.Authentication,
			text(profile.ConnectionType), text(profile.APIURL), profile.HostKeyFingerprint, text(profile.TLSCertificateFingerprint),
			profile.DockerAvailable, text(profile.DockerVersion), profile.SwarmControlAvailable, text(profile.SwarmState), moment(profile.LastConnectedAt),
			text(health.AgentVersion), moment(health.CheckedAt), text(health.Detail), moment(health.LastFailureAt), moment(health.LastReachableAt),
			health.ProtocolVersion, text(string(health.State)), text(health.Summary), health.UptimeSeconds, health.Update.Automatic,
			moment(health.Update.CheckedAt), moment(health.Update.LastUpdatedAt), moment(health.Update.RequestedAt),
			text(health.Update.Revision), text(health.Update.State), text(health.Update.Version), now); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "DELETE FROM server_agent_events WHERE server_id = ?", profile.ID); err != nil {
			return err
		}
		for position, event := range health.Events {
			if _, err := tx.ExecContext(ctx, `INSERT INTO server_agent_events (server_id, position, code, level, message, occurred_at, source)
				VALUES (?, ?, ?, ?, ?, ?, ?)`, profile.ID, position, event.Code, event.Level, event.Message, event.OccurredAt.UTC(), event.Source); err != nil {
				return err
			}
		}
	}
	rows, err := tx.QueryContext(ctx, "SELECT id FROM servers")
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
		if !keep[id] {
			stale = append(stale, id)
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, id := range stale {
		if _, err := tx.ExecContext(ctx, "DELETE FROM servers WHERE id = ?", id); err != nil {
			return err
		}
	}
	return nil
}

func text(value string) sql.NullString { return sql.NullString{String: value, Valid: value != ""} }

func moment(value time.Time) sql.NullTime {
	return sql.NullTime{Time: value.UTC(), Valid: !value.IsZero()}
}

const keyStateKey = "server-keys"

type keyFile struct {
	Keys    map[string]string `json:"keys"`
	Version int               `json:"version"`
}

// ImportServerFiles copies pre-database server profiles — servers.sealed, or
// the older plaintext servers.json — and any retained machine-API keys from
// server-keys.sealed into the database. It reports the number of profiles and
// keys imported. The files are kept as the backup.
func ImportServerFiles(ctx context.Context, db *sqlstore.DB, dataDir string, dataEncryptionKey []byte) (int, int, error) {
	sealer, err := securestore.New(dataEncryptionKey)
	if err != nil {
		return 0, 0, err
	}
	manager := &Manager{connections: map[string]*Connection{}, db: db, keys: map[string]string{}, profiles: map[string]domain.Server{}, retainKeys: true}
	data, err := sealer.ReadFile(filepath.Join(dataDir, "servers.sealed"), profileStateKey)
	if errors.Is(err, os.ErrNotExist) {
		data, err = os.ReadFile(filepath.Join(dataDir, "servers.json"))
		if errors.Is(err, os.ErrNotExist) {
			return 0, 0, nil
		}
	}
	if err != nil {
		return 0, 0, fmt.Errorf("read server profiles: %w", err)
	}
	if err := manager.loadProfiles(data); err != nil {
		return 0, 0, err
	}
	keys, err := sealer.ReadFile(filepath.Join(dataDir, "server-keys.sealed"), keyStateKey)
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return 0, 0, fmt.Errorf("read sealed machine API keys: %w", err)
	}
	if err == nil {
		var saved keyFile
		if err := json.Unmarshal(keys, &saved); err != nil {
			return 0, 0, fmt.Errorf("read sealed machine API keys: %w", err)
		}
		if saved.Version != 1 {
			return 0, 0, fmt.Errorf("unsupported sealed machine API key version")
		}
		for id, key := range saved.Keys {
			if _, found := manager.profiles[id]; found && len(strings.TrimSpace(key)) >= 16 {
				manager.keys[id] = key
			}
		}
	}
	manager.mu.Lock()
	defer manager.mu.Unlock()
	if err := manager.saveLocked(); err != nil {
		return 0, 0, err
	}
	if err := manager.saveKeysLocked(); err != nil {
		return 0, 0, err
	}
	return len(manager.profiles), len(manager.keys), nil
}
