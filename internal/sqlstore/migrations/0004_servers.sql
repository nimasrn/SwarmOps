-- Machine targets. A profile is non-secret metadata about one enrolled or
-- addressed host; its live connection exists only in controller memory. The
-- retained machine-API key, when retention is enabled, is sealed per server.

CREATE TABLE servers (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(96) NOT NULL,
  host VARCHAR(253) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  username VARCHAR(190) NOT NULL DEFAULT '',
  authentication VARCHAR(32) NOT NULL,
  connection_type VARCHAR(32) NULL,
  api_url VARCHAR(512) NULL,
  host_key_fingerprint VARCHAR(128) NOT NULL DEFAULT '',
  tls_certificate_fingerprint VARCHAR(128) NULL,
  docker_available BOOLEAN NOT NULL DEFAULT FALSE,
  docker_version VARCHAR(64) NULL,
  swarm_control_available BOOLEAN NOT NULL DEFAULT FALSE,
  swarm_state VARCHAR(32) NULL,
  last_connected_at DATETIME(6) NULL,
  -- Last observed agent health. These describe the server, not a separate
  -- entity with its own identity, so they stay on the server row.
  agent_version VARCHAR(64) NULL,
  agent_checked_at DATETIME(6) NULL,
  agent_detail TEXT NULL,
  agent_last_failure_at DATETIME(6) NULL,
  agent_last_reachable_at DATETIME(6) NULL,
  agent_protocol_version INT UNSIGNED NOT NULL DEFAULT 0,
  agent_state VARCHAR(16) NULL,
  agent_summary VARCHAR(1024) NULL,
  agent_uptime_seconds BIGINT UNSIGNED NOT NULL DEFAULT 0,
  update_automatic BOOLEAN NOT NULL DEFAULT FALSE,
  update_checked_at DATETIME(6) NULL,
  update_last_updated_at DATETIME(6) NULL,
  update_requested_at DATETIME(6) NULL,
  update_revision VARCHAR(128) NULL,
  update_state VARCHAR(32) NULL,
  update_version VARCHAR(64) NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_servers_name (name, id),
  CONSTRAINT ck_servers_agent_state CHECK (agent_state IS NULL OR agent_state IN ('healthy', 'degraded', 'unknown', 'unhealthy'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The bounded recent-event trail shown on a server's page, in order.
CREATE TABLE server_agent_events (
  server_id VARCHAR(64) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  code VARCHAR(64) NOT NULL,
  level VARCHAR(16) NOT NULL,
  message TEXT NOT NULL,
  occurred_at DATETIME(6) NOT NULL,
  source VARCHAR(32) NOT NULL,
  PRIMARY KEY (server_id, position),
  CONSTRAINT fk_server_agent_events_server FOREIGN KEY (server_id)
    REFERENCES servers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE server_keys (
  server_id VARCHAR(64) NOT NULL,
  api_key_sealed VARBINARY(1024) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (server_id),
  CONSTRAINT fk_server_keys_server FOREIGN KEY (server_id)
    REFERENCES servers (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
