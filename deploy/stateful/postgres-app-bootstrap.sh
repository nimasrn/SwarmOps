#!/bin/sh
# Per-application PostgreSQL provisioning. This is a reviewed, checked-in
# asset: SwarmOps runs it unchanged inside a one-shot job on the managed
# database's own image and supplies only parameters — the application role
# name, its database name, and two mounted secrets. Nothing an operator types
# reaches this file, and no statement here is assembled from a request.
#
# It is idempotent by construction. Every deployment of an application may run
# it again; an existing role has its password reset to the one SwarmOps already
# sealed, which is also how a half-finished earlier run repairs itself.
set -eu

: "${SWARMOPS_APP_USER:?application role name is required}"
: "${SWARMOPS_APP_DB:?application database name is required}"
: "${PGHOST:?managed database host is required}"

PGPASSWORD="$(cat /run/secrets/admin_password)"
export PGPASSWORD
SWARMOPS_APP_PASSWORD="$(cat /run/secrets/app_password)"

# The Swarm task is already gated on the database's healthcheck, but a
# stop-first update can still leave a moment where the socket refuses. Waiting
# here is the difference between an application that starts and one that
# crash-loops on its first connection.
attempt=0
until pg_isready -q; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "managed PostgreSQL did not accept connections within two minutes" >&2
    exit 1
  fi
  sleep 2
done

# format(%I, %L) does the quoting, so the role and database names are
# identifiers to PostgreSQL rather than text pasted into a statement.
psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 \
  -v app_user="$SWARMOPS_APP_USER" \
  -v app_db="$SWARMOPS_APP_DB" \
  -v app_password="$SWARMOPS_APP_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L', :'app_user', :'app_password')
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'app_db', :'app_user')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'app_db')
\gexec

SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', :'app_db')
\gexec

SELECT format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', :'app_db', :'app_user')
\gexec
SQL

# Owning the public schema is what lets an application run its own migrations
# without any further privilege, and PostgreSQL 15 and later no longer grant it
# by default.
psql --no-psqlrc --quiet -v ON_ERROR_STOP=1 --dbname "$SWARMOPS_APP_DB" \
  -v app_user="$SWARMOPS_APP_USER" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'app_user')
\gexec

SELECT format('GRANT ALL ON SCHEMA public TO %I', :'app_user')
\gexec
SQL

echo "provisioned PostgreSQL role and database for $SWARMOPS_APP_USER"
