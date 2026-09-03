#!/bin/sh
# Per-application Redis provisioning. Reviewed, checked-in asset run unchanged
# by a one-shot job on the managed database's own image; the application user
# name and its two secrets are the only parameters.
#
# Redis has no per-database isolation to grant, so the separation this creates
# is credential and privilege, not namespace: each application gets its own ACL
# user, and that user is denied the administrative and destructive command
# categories. Restricting it to a key prefix instead would break every
# application that does not already prefix its keys, which is the failure this
# whole path exists to prevent.
#
# The managed Redis runs with an ACL file on its data volume, so ACL SAVE makes
# these users survive a restart. Without that, an application would lose its
# credential the first time the database moved.
set -eu

: "${SWARMOPS_APP_USER:?application user name is required}"
: "${SWARMOPS_REDIS_HOST:?managed database host is required}"
: "${SWARMOPS_REDIS_PORT:?managed database port is required}"

# redis-cli reads the password from the environment rather than argv, so it
# never appears in the process list of the node running this job.
REDISCLI_AUTH="$(cat /run/secrets/admin_password)"
export REDISCLI_AUTH
SWARMOPS_APP_PASSWORD="$(cat /run/secrets/app_password)"

attempt=0
until [ "$(redis-cli -h "$SWARMOPS_REDIS_HOST" -p "$SWARMOPS_REDIS_PORT" ping 2>/dev/null)" = "PONG" ]; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 60 ]; then
    echo "managed Redis did not accept connections within two minutes" >&2
    exit 1
  fi
  sleep 2
done

redis-cli -h "$SWARMOPS_REDIS_HOST" -p "$SWARMOPS_REDIS_PORT" --no-raw ACL SETUSER \
  "$SWARMOPS_APP_USER" reset on ">$SWARMOPS_APP_PASSWORD" "~*" "&*" +@all -@admin -@dangerous

redis-cli -h "$SWARMOPS_REDIS_HOST" -p "$SWARMOPS_REDIS_PORT" ACL SAVE

echo "provisioned Redis ACL user $SWARMOPS_APP_USER"
