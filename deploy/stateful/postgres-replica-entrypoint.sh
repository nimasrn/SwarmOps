#!/usr/bin/env bash
set -Eeuo pipefail

: "${PGDATA:=/var/lib/postgresql/data}"
: "${REPLICATION_PASSWORD_FILE:?REPLICATION_PASSWORD_FILE is required}"

mkdir -p "$PGDATA"
chown -R postgres:postgres "$PGDATA"

if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  pgpass=/tmp/pgpass
  umask 077
  printf 'postgres-primary:5432:*:replicator:%s\n' "$(tr -d '\r\n' < "$REPLICATION_PASSWORD_FILE")" > "$pgpass"
  chown postgres:postgres "$pgpass"
  until gosu postgres env PGPASSFILE="$pgpass" pg_basebackup \
    --host=postgres-primary --port=5432 --username=replicator \
    --pgdata="$PGDATA" --format=plain --wal-method=stream --progress --write-recovery-conf; do
    rm -rf "${PGDATA:?}"/*
    sleep 5
  done
  rm -f "$pgpass"
fi

exec gosu postgres postgres -D "$PGDATA" -c hot_standby=on
