-- The durable command ledger and scheduler. A command row is written before
-- any worker or agent may see it; claiming, leasing, completing and failing are
-- conditional updates on that row inside a transaction.

CREATE TABLE commands (
  seq BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id CHAR(36) NOT NULL,
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(190) NOT NULL,
  -- The target server. Deliberately not a foreign key: a command's history
  -- must outlive the removal of the server it ran against.
  server_id VARCHAR(64) NOT NULL,
  node_id VARCHAR(64) NOT NULL DEFAULT '',
  cluster_id VARCHAR(64) NOT NULL,
  target VARCHAR(512) NOT NULL,
  state VARCHAR(20) NOT NULL,
  attempt INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts TINYINT UNSIGNED NOT NULL,
  auto_retry BOOLEAN NOT NULL,
  authority_epoch BIGINT UNSIGNED NOT NULL,
  request_id VARCHAR(128) NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  -- SHA-256 of the payload while one is retained, so an idempotent resubmission
  -- can be compared without decrypting the sealed payload.
  payload_digest CHAR(64) NULL,
  has_artifact BOOLEAN NOT NULL DEFAULT FALSE,
  lease_id VARCHAR(64) NULL,
  lease_expires_at DATETIME(6) NULL,
  last_attempt_at DATETIME(6) NULL,
  next_attempt_at DATETIME(6) NULL,
  last_error TEXT NULL,
  failure_code VARCHAR(64) NULL,
  failure_summary TEXT NULL,
  recovery_hint TEXT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_commands_seq (seq),
  UNIQUE KEY uq_commands_idempotency (actor, idempotency_key),
  KEY ix_commands_runnable (state, next_attempt_at, created_at),
  KEY ix_commands_server_runnable (server_id, state, next_attempt_at, created_at),
  KEY ix_commands_lease_expiry (state, lease_expires_at),
  KEY ix_commands_recent (updated_at, id),
  KEY ix_commands_intent (action, server_id, target(255)),
  CONSTRAINT ck_commands_state CHECK (state IN ('uploading', 'queued', 'leased', 'preparing', 'running', 'retry_scheduled',
    'succeeded', 'failed', 'needs_attention', 'superseded', 'cancelled')),
  CONSTRAINT ck_commands_attempts CHECK (max_attempts BETWEEN 1 AND 8),
  CONSTRAINT ck_commands_epoch CHECK (authority_epoch >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The raw command input (a Compose document, a deployment spec). Sealed, kept
-- only until the command succeeds, and never returned to a browser.
CREATE TABLE command_payloads (
  command_id CHAR(36) NOT NULL,
  payload_sealed MEDIUMBLOB NOT NULL,
  PRIMARY KEY (command_id),
  CONSTRAINT fk_command_payloads_command FOREIGN KEY (command_id) REFERENCES commands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The progress trail of the current attempt.
CREATE TABLE command_events (
  command_id CHAR(36) NOT NULL,
  sequence INT UNSIGNED NOT NULL,
  state VARCHAR(20) NOT NULL,
  evidence VARCHAR(1024) NULL,
  occurred_at DATETIME(6) NOT NULL,
  PRIMARY KEY (command_id, sequence),
  CONSTRAINT fk_command_events_command FOREIGN KEY (command_id) REFERENCES commands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The bounded execution log a machine returned. It is remote output, so it is
-- sealed and served only when an operator asks for that one command's log.
CREATE TABLE command_outputs (
  command_id CHAR(36) NOT NULL,
  output_sealed MEDIUMBLOB NOT NULL,
  retained_at DATETIME(6) NOT NULL,
  PRIMARY KEY (command_id),
  CONSTRAINT fk_command_outputs_command FOREIGN KEY (command_id) REFERENCES commands (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Scheduler mutexes. Upserting a row takes its exclusive lock until commit, so
-- "one claim at a time" and "one lease per server at a time" hold across every
-- controller process using the database, not only within one.
CREATE TABLE command_locks (
  lock_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (lock_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
