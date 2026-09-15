-- Traefik routing control plane, one set of rows per cluster. Every change to a
-- cluster locks its routing_clusters row, so the whole-cluster validation the
-- controller runs always sees a consistent cluster.

-- The Traefik static settings and the cutover plans are value objects: they
-- are always read and written whole, and nothing queries inside them. They are
-- kept as validated JSON documents rather than decomposed into tables no query
-- would ever join.
CREATE TABLE routing_clusters (
  cluster_id VARCHAR(64) NOT NULL,
  settings_json JSON NOT NULL,
  cutover_json JSON NULL,
  cutover_rollback_json JSON NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (cluster_id),
  CONSTRAINT ck_routing_clusters_settings CHECK (JSON_VALID(settings_json))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE routes (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  service_key VARCHAR(128) NOT NULL,
  protocol VARCHAR(8) NOT NULL,
  scope VARCHAR(16) NOT NULL,
  tls_mode VARCHAR(16) NOT NULL,
  listen_port SMALLINT UNSIGNED NULL,
  target_port SMALLINT UNSIGNED NOT NULL,
  path_prefix VARCHAR(256) NULL,
  health_kind VARCHAR(32) NOT NULL DEFAULT '',
  health_path VARCHAR(256) NULL,
  health_timeout_seconds SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  dns_reference VARCHAR(64) NULL,
  resolver VARCHAR(64) NULL,
  enabled BOOLEAN NOT NULL,
  managed BOOLEAN NOT NULL,
  metrics BOOLEAN NOT NULL,
  access_logs BOOLEAN NOT NULL,
  public_allow BOOLEAN NOT NULL,
  is_sensitive BOOLEAN NOT NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, route_key),
  KEY ix_routes_service (cluster_id, service_key),
  CONSTRAINT ck_routes_protocol CHECK (protocol IN ('http', 'tcp', 'udp')),
  CONSTRAINT fk_routes_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Host and SNI matchers, in order. kind separates the two lists.
CREATE TABLE route_hosts (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  kind VARCHAR(4) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  hostname VARCHAR(253) NOT NULL,
  PRIMARY KEY (cluster_id, route_key, kind, position),
  KEY ix_route_hosts_hostname (cluster_id, hostname),
  CONSTRAINT ck_route_hosts_kind CHECK (kind IN ('host', 'sni')),
  CONSTRAINT fk_route_hosts_route FOREIGN KEY (cluster_id, route_key) REFERENCES routes (cluster_id, route_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- target_route is not a foreign key: the two platform metrics targets are
-- synthetic and never exist as stored routes.
CREATE TABLE dependency_bindings (
  cluster_id VARCHAR(64) NOT NULL,
  caller_service VARCHAR(128) NOT NULL,
  target_route VARCHAR(64) NOT NULL,
  name VARCHAR(64) NOT NULL DEFAULT '',
  delivery VARCHAR(32) NOT NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, caller_service, target_route, name),
  CONSTRAINT fk_dependency_bindings_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE service_route_declarations (
  cluster_id VARCHAR(64) NOT NULL,
  service_key VARCHAR(128) NOT NULL,
  role VARCHAR(32) NOT NULL,
  reason VARCHAR(512) NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, service_key),
  CONSTRAINT fk_service_route_declarations_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- created_at is nullable: zones adopted from records that predate the domain
-- registry have no known acceptance time, and the schema does not invent one.
CREATE TABLE routing_domains (
  cluster_id VARCHAR(64) NOT NULL,
  zone VARCHAR(253) NOT NULL,
  note VARCHAR(512) NULL,
  created_at DATETIME(6) NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, zone),
  CONSTRAINT fk_routing_domains_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every version of a DNS provider credential is kept for audit; the token of a
-- version is sealed and bound to (cluster, credential, version), and removed
-- from a version that is withdrawn.
CREATE TABLE dns_credential_versions (
  cluster_id VARCHAR(64) NOT NULL,
  credential_id VARCHAR(64) NOT NULL,
  version INT UNSIGNED NOT NULL,
  name VARCHAR(96) NOT NULL,
  provider VARCHAR(32) NOT NULL,
  account_id VARCHAR(128) NULL,
  email VARCHAR(254) NULL,
  secret_name VARCHAR(128) NOT NULL,
  state VARCHAR(16) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  validated_at DATETIME(6) NULL,
  secret_sealed VARBINARY(8192) NULL,
  PRIMARY KEY (cluster_id, credential_id, version),
  UNIQUE KEY uq_dns_credential_versions_secret (cluster_id, secret_name),
  CONSTRAINT ck_dns_credential_versions_state CHECK (state IN ('sealed', 'validated', 'removed')),
  CONSTRAINT ck_dns_credential_versions_secret CHECK (state = 'removed' OR secret_sealed IS NOT NULL),
  CONSTRAINT fk_dns_credential_versions_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE dns_records (
  cluster_id VARCHAR(64) NOT NULL,
  id VARCHAR(64) NOT NULL,
  zone VARCHAR(253) NOT NULL,
  name VARCHAR(253) NOT NULL,
  type VARCHAR(8) NOT NULL,
  content VARCHAR(512) NOT NULL,
  ttl INT UNSIGNED NOT NULL,
  proxied BOOLEAN NOT NULL,
  managed BOOLEAN NOT NULL,
  adopted BOOLEAN NOT NULL,
  credential_id VARCHAR(64) NOT NULL,
  provider_record_id VARCHAR(128) NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, id),
  UNIQUE KEY uq_dns_records_name_type (cluster_id, name, type),
  KEY ix_dns_records_zone (cluster_id, zone),
  CONSTRAINT fk_dns_records_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE route_certificates (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  state VARCHAR(32) NOT NULL,
  issuer VARCHAR(256) NULL,
  fingerprint VARCHAR(128) NULL,
  resolver VARCHAR(64) NOT NULL DEFAULT '',
  handshake_valid BOOLEAN NOT NULL,
  failure_summary TEXT NULL,
  last_attempt DATETIME(6) NULL,
  not_before DATETIME(6) NULL,
  not_after DATETIME(6) NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, route_key),
  KEY ix_route_certificates_expiry (not_after),
  CONSTRAINT fk_route_certificates_route FOREIGN KEY (cluster_id, route_key) REFERENCES routes (cluster_id, route_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE route_certificate_domains (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  domain VARCHAR(253) NOT NULL,
  PRIMARY KEY (cluster_id, route_key, position),
  CONSTRAINT fk_route_certificate_domains_certificate FOREIGN KEY (cluster_id, route_key) REFERENCES route_certificates (cluster_id, route_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Observed Traefik state. Not a foreign key to routes: the controller records
-- what Traefik reports, which can briefly include a route it has just removed.
CREATE TABLE route_runtime (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  protocol VARCHAR(8) NOT NULL,
  router VARCHAR(256) NOT NULL DEFAULT '',
  service VARCHAR(256) NOT NULL DEFAULT '',
  state VARCHAR(32) NOT NULL DEFAULT '',
  observed_at DATETIME(6) NOT NULL,
  version INT NOT NULL,
  PRIMARY KEY (cluster_id, route_key),
  CONSTRAINT fk_route_runtime_cluster FOREIGN KEY (cluster_id) REFERENCES routing_clusters (cluster_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE route_runtime_entry_points (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  entry_point VARCHAR(64) NOT NULL,
  PRIMARY KEY (cluster_id, route_key, position),
  CONSTRAINT fk_route_runtime_entry_points_runtime FOREIGN KEY (cluster_id, route_key) REFERENCES route_runtime (cluster_id, route_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE route_runtime_errors (
  cluster_id VARCHAR(64) NOT NULL,
  route_key VARCHAR(64) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  message VARCHAR(256) NOT NULL,
  PRIMARY KEY (cluster_id, route_key, position),
  CONSTRAINT fk_route_runtime_errors_runtime FOREIGN KEY (cluster_id, route_key) REFERENCES route_runtime (cluster_id, route_key) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
