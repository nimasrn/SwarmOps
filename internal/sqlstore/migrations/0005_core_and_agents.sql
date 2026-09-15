-- Control-plane placement (which core is active, under which authority epoch,
-- and any handoff in progress) and the outbound-agent certificate registry.

-- Singleton: the one authority record every core member is judged against.
CREATE TABLE core_authority (
  id TINYINT UNSIGNED NOT NULL,
  active_id VARCHAR(64) NULL,
  authority_epoch BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_core_authority_singleton CHECK (id = 1),
  CONSTRAINT ck_core_authority_epoch CHECK (authority_epoch >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE core_members (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(96) NOT NULL,
  endpoint VARCHAR(512) NOT NULL DEFAULT '',
  role VARCHAR(16) NOT NULL,
  replica_state VARCHAR(32) NOT NULL,
  -- Optional link to the machine agent running on the same host. Not a
  -- foreign key: a standby may be registered before its host is enrolled.
  agent_server_id VARCHAR(64) NULL,
  last_checkpoint_at DATETIME(6) NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_core_members_role CHECK (role IN ('active', 'standby')),
  CONSTRAINT ck_core_members_replica_state CHECK (replica_state IN ('awaiting_restore', 'verified'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- At most one handoff exists at a time, so it is a singleton as well.
CREATE TABLE core_handoffs (
  id TINYINT UNSIGNED NOT NULL,
  from_id VARCHAR(64) NOT NULL,
  to_id VARCHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL,
  prepared_at DATETIME(6) NOT NULL,
  fenced_at DATETIME(6) NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_core_handoffs_singleton CHECK (id = 1),
  CONSTRAINT ck_core_handoffs_state CHECK (state IN ('prepared', 'fenced')),
  CONSTRAINT ck_core_handoffs_distinct CHECK (from_id <> to_id),
  CONSTRAINT ck_core_handoffs_fenced_time CHECK (state <> 'fenced' OR fenced_at IS NOT NULL),
  CONSTRAINT fk_core_handoffs_from FOREIGN KEY (from_id) REFERENCES core_members (id),
  CONSTRAINT fk_core_handoffs_to FOREIGN KEY (to_id) REFERENCES core_members (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Singleton: the private CA that signs outbound agents' client certificates.
-- The certificate is public; the private key is sealed.
CREATE TABLE agent_ca (
  id TINYINT UNSIGNED NOT NULL,
  certificate_pem TEXT NOT NULL,
  private_key_sealed VARBINARY(4096) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_agent_ca_singleton CHECK (id = 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE agents (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(96) NOT NULL,
  certificate_expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One-time enrollment codes are stored only as SHA-256 digests.
CREATE TABLE agent_enrollment_tokens (
  code_digest CHAR(64) NOT NULL,
  name VARCHAR(96) NULL,
  expires_at DATETIME(6) NOT NULL,
  PRIMARY KEY (code_digest),
  KEY ix_agent_enrollment_tokens_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A standalone claim started by an agent and approved by an operator. Its
-- secrets are digests; the issued enrollment, once approved, waits here until
-- the agent redeems it.
CREATE TABLE agent_claims (
  id VARCHAR(64) NOT NULL,
  name VARCHAR(96) NOT NULL,
  csr TEXT NOT NULL,
  code_digest CHAR(64) NOT NULL,
  secret_digest CHAR(64) NOT NULL,
  expires_at DATETIME(6) NOT NULL,
  enrollment_agent_id VARCHAR(64) NULL,
  enrollment_authority_epoch BIGINT UNSIGNED NULL,
  enrollment_certificate TEXT NULL,
  enrollment_expires_at DATETIME(6) NULL,
  position INT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_agent_claims_code (code_digest),
  KEY ix_agent_claims_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
