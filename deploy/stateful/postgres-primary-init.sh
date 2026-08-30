#!/usr/bin/env bash
set -Eeuo pipefail

# The official image runs this only for a new primary data directory. psql's
# backtick expansion reads the Swarm secret inside the process; it does not put
# a password in a command argument, environment variable, stack, or log.
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"
: "${PGDATA:?PGDATA is required}"
: "${REPLICATION_PASSWORD_FILE:?REPLICATION_PASSWORD_FILE is required}"

psql --set=ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\set replication_password `cat "$REPLICATION_PASSWORD_FILE"`
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replication_password';
SQL

printf '%s\n' 'host replication replicator all scram-sha-256' >> "$PGDATA/pg_hba.conf"
