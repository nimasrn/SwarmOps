-- An application may also use another application's managed database
-- accounts (database_owner), so an API, its worker and its migration job share
-- one database. Applications may now be workers or run-once jobs, which have no port, and
-- may carry secret environment variables. A secret variable is sealed exactly
-- like a plain one; the flag is what keeps its value out of every response and
-- delivers it as a Swarm secret file instead of an environment value.

ALTER TABLE applications
  ADD COLUMN kind VARCHAR(16) NOT NULL DEFAULT 'web' AFTER image,
  ADD COLUMN database_owner VARCHAR(41) NULL AFTER database_delivery,
  ADD COLUMN protocol VARCHAR(8) NULL AFTER port,
  DROP CONSTRAINT ck_applications_resources,
  ADD CONSTRAINT ck_applications_resources CHECK (cpus > 0 AND memory_mib > 0 AND (port > 0 OR kind IN ('worker', 'job'))),
  ADD CONSTRAINT ck_applications_kind CHECK (kind IN ('web', 'worker', 'job')),
  ADD CONSTRAINT ck_applications_protocol CHECK (protocol IS NULL OR protocol IN ('http', 'tcp'));

ALTER TABLE application_env
  ADD COLUMN is_secret BOOLEAN NOT NULL DEFAULT FALSE AFTER env_key;

-- Applications this one calls, and the extra variable names each address is
-- delivered under. Like backend, a dependency is a name rather than a foreign
-- key: it is resolved against the live route when the caller deploys.
CREATE TABLE application_dependencies (
  application_name VARCHAR(41) NOT NULL,
  dependency VARCHAR(41) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (application_name, dependency),
  CONSTRAINT fk_application_dependencies_application FOREIGN KEY (application_name)
    REFERENCES applications (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE application_dependency_env (
  application_name VARCHAR(41) NOT NULL,
  dependency VARCHAR(41) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  env_name VARCHAR(64) NOT NULL,
  PRIMARY KEY (application_name, dependency, position),
  CONSTRAINT fk_application_dependency_env_dependency FOREIGN KEY (application_name, dependency)
    REFERENCES application_dependencies (application_name, dependency) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
