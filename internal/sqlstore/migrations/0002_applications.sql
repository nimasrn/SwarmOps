-- Rendered applications, their last deployment outcome, and the sealed
-- connection URIs the controller generated for managed databases.

CREATE TABLE applications (
  name VARCHAR(41) NOT NULL,
  image VARCHAR(512) NOT NULL,
  port SMALLINT UNSIGNED NOT NULL,
  replicas INT UNSIGNED NOT NULL,
  cpus DOUBLE NOT NULL,
  memory_mib BIGINT NOT NULL,
  plan VARCHAR(32) NULL,
  -- UNIQUE on a nullable column: many applications may have no domain, but
  -- no two may share one. The engine enforces what Put used to check by hand.
  domain VARCHAR(253) NULL,
  resolver VARCHAR(64) NULL,
  -- Backend names another application by name. It is deliberately not a
  -- foreign key: a frontend may be declared before its API is deployed.
  backend VARCHAR(41) NULL,
  database_delivery VARCHAR(32) NULL,
  health_path VARCHAR(201) NULL,
  metrics BOOLEAN NOT NULL DEFAULT FALSE,
  metrics_path VARCHAR(201) NULL,
  metrics_port SMALLINT UNSIGNED NULL,
  tracing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (name),
  UNIQUE KEY uq_applications_domain (domain),
  CONSTRAINT ck_applications_resources CHECK (cpus > 0 AND memory_mib > 0 AND port > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Environment values can carry operator secrets, so the value is sealed and
-- bound to its application and key.
CREATE TABLE application_env (
  application_name VARCHAR(41) NOT NULL,
  env_key VARCHAR(64) NOT NULL,
  env_value_sealed VARBINARY(8192) NOT NULL,
  PRIMARY KEY (application_name, env_key),
  CONSTRAINT fk_application_env_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE application_health_command (
  application_name VARCHAR(41) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  argument VARCHAR(1024) NOT NULL,
  PRIMARY KEY (application_name, position),
  CONSTRAINT fk_application_health_command_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE application_databases (
  application_name VARCHAR(41) NOT NULL,
  engine VARCHAR(16) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (application_name, engine),
  CONSTRAINT fk_application_databases_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The environment variable names an application reads one engine's URI from.
CREATE TABLE application_database_env (
  application_name VARCHAR(41) NOT NULL,
  engine VARCHAR(16) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  env_name VARCHAR(64) NOT NULL,
  PRIMARY KEY (application_name, engine, position),
  CONSTRAINT fk_application_database_env_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per application that has been attempted. last_command_id is not a
-- foreign key because succeeded commands are pruned from history while the
-- outcome that cites them is kept.
CREATE TABLE application_outcomes (
  application_name VARCHAR(41) NOT NULL,
  started BOOLEAN NOT NULL DEFAULT FALSE,
  started_at DATETIME(6) NULL,
  last_attempt_at DATETIME(6) NULL,
  last_command_id VARCHAR(64) NULL,
  failure_summary TEXT NULL,
  PRIMARY KEY (application_name),
  CONSTRAINT fk_application_outcomes_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Shared (per-engine) connection URIs. A Swarm secret cannot be read back, so
-- this sealed copy is the only way to wire a later application to a database.
CREATE TABLE database_credentials (
  engine VARCHAR(16) NOT NULL,
  uri_sealed VARBINARY(4096) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (engine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-application URIs. Not a foreign key to applications: the credential is
-- sealed before the application's spec is first stored, and it must survive a
-- failed first deployment so the retry reuses the same password.
CREATE TABLE application_database_credentials (
  application_name VARCHAR(41) NOT NULL,
  engine VARCHAR(16) NOT NULL,
  uri_sealed VARBINARY(4096) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (application_name, engine)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
