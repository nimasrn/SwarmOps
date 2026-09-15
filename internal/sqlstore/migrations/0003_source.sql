-- Source-provider boundary: sealed provider connections and the single row of
-- console-owned source settings.

CREATE TABLE source_connections (
  id CHAR(32) NOT NULL,
  kind VARCHAR(32) NOT NULL,
  name VARCHAR(190) NOT NULL,
  base_url VARCHAR(512) NOT NULL,
  account VARCHAR(190) NULL,
  -- The provider token, sealed and bound to this connection id.
  token_sealed VARBINARY(8192) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_source_connections_name (name, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A singleton: the CHECK on id allows exactly one row, so "the settings" is a
-- row that exists or does not, never a set to choose from.
CREATE TABLE source_settings (
  id TINYINT UNSIGNED NOT NULL,
  enabled BOOLEAN NOT NULL,
  build_enabled BOOLEAN NOT NULL,
  image_prefix VARCHAR(255) NOT NULL DEFAULT '',
  registry_server VARCHAR(253) NOT NULL DEFAULT '',
  registry_username VARCHAR(190) NOT NULL DEFAULT '',
  registry_password_sealed VARBINARY(4096) NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT ck_source_settings_singleton CHECK (id = 1),
  CONSTRAINT ck_source_settings_build_requires_enabled CHECK (build_enabled = FALSE OR enabled = TRUE)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE source_private_hosts (
  host VARCHAR(253) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (host),
  UNIQUE KEY uq_source_private_hosts_position (position)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
