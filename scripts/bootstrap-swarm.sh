#!/usr/bin/env bash
set -euo pipefail
umask 077

# Form a Docker Swarm out of machines SwarmOps manages.
#
# This script replaced an Ansible playbook, and the difference is the point: it
# opens no SSH connection, holds no key for any host, and runs no command it
# invented. It talks to ONE endpoint — the SwarmOps controller — and every host
# change it causes is a typed operation that appears in the run ledger with an
# actor, an audit record, and a retry policy. The playbook it replaced had root
# on every machine in the inventory and left no trace anyone could read
# afterwards.
#
# The one thing it cannot do is put an agent on a machine for you. That is
# deliberate: an agent is installed by running one command ON the host, so this
# script mints the enrolment code, prints that command, and waits. Nothing here
# needs to reach a host over the network before the host has reached the
# controller first.

core_url=''
manager_count=1
name_prefix='node'
join_role='manager'
apply=false
poll_seconds=5
wait_seconds=900

# The agent installer is a release asset, not something the controller serves.
# It is named here rather than built from --core so this script cannot be
# talked into fetching an installer from whatever host it was pointed at.
installer_url='https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh'

usage() {
  printf '%s\n' \
    'Usage: bash scripts/bootstrap-swarm.sh --core <https url> [options]' \
    '' \
    'Enrols machines through the SwarmOps controller and forms a Swarm from' \
    'them. Prints the one-line installer for each machine, waits for the agent' \
    'to connect, then queues Docker installation and Swarm formation as typed' \
    'operations. It never connects to a machine itself.' \
    '' \
    'Options:' \
    '  --core <url>          HTTPS origin of the SwarmOps controller (required).' \
    '  --managers <n>        Machines to enrol and make managers. Default 1.' \
    '  --name-prefix <name>  Name given to each machine. Default "node".' \
    '  --workers             Join additional machines as workers instead of managers.' \
    '  --apply               Actually queue the operations. Without it, this' \
    '                        reports what it would do and changes nothing.' \
    '  --wait <seconds>      How long to wait for each agent and run. Default 900.' \
    '' \
    'The controller password is prompted for and never taken as an argument,' \
    'because arguments end up in shell history and process listings.' \
    '' \
    'Three managers is the smallest cluster that survives losing one machine.' \
    'One manager is a valid cluster and is not a highly available one.'
}

fail() {
  printf 'SwarmOps bootstrap: %s\n' "$*" >&2
  exit 1
}

note() { printf '%s\n' "$*" >&2; }

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --core) core_url="${2:-}"; shift 2 ;;
    --managers) manager_count="${2:-}"; shift 2 ;;
    --name-prefix) name_prefix="${2:-}"; shift 2 ;;
    --workers) join_role='worker'; shift ;;
    --apply) apply=true; shift ;;
    --wait) wait_seconds="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; fail "unknown argument: $1" ;;
  esac
done

require_command curl
require_command python3

[[ -n "$core_url" ]] || { usage >&2; exit 1; }
[[ "$core_url" =~ ^https://[A-Za-z0-9._:-]+(/)?$ ]] || fail '--core must be an HTTPS origin with no path'
core_url="${core_url%/}"
[[ "$manager_count" =~ ^[0-9]+$ ]] && (( manager_count >= 1 && manager_count <= 9 )) || fail '--managers must be between 1 and 9'
[[ "$name_prefix" =~ ^[a-z0-9][a-z0-9-]{0,30}$ ]] || fail '--name-prefix must be a short lowercase name'
[[ "$wait_seconds" =~ ^[0-9]+$ ]] && (( wait_seconds >= 30 )) || fail '--wait must be at least 30 seconds'

cookie_jar="$(mktemp)"
csrf_token=''
cleanup() { rm -f -- "$cookie_jar"; }
trap cleanup EXIT

# json extracts one value from a JSON document on stdin. Using python rather
# than grep means a name containing a brace cannot be read as structure.
json() {
  python3 -c '
import json, sys
document = json.load(sys.stdin)
for key in sys.argv[1:]:
    if isinstance(document, list):
        document = document[int(key)]
    else:
        document = document.get(key)
    if document is None:
        sys.exit(3)
print(document if not isinstance(document, bool) else ("true" if document else "false"))
' "$@"
}

api() {
  local method="$1" path="$2" body="${3:-}"
  local -a arguments=(
    --fail-with-body --silent --show-error --location
    --cookie "$cookie_jar" --cookie-jar "$cookie_jar"
    --request "$method" "$core_url$path"
  )
  if [[ -n "$csrf_token" && "$method" != 'GET' ]]; then
    arguments+=(--header "X-CSRF-Token: $csrf_token")
    # Every mutation the controller accepts carries one. A repeated key is the
    # same command, which is exactly what a retried bootstrap should be.
    arguments+=(--header "Idempotency-Key: $(idempotency_key "$method$path$body")")
  fi
  if [[ -n "$body" ]]; then
    arguments+=(--header 'Content-Type: application/json' --data "$body")
  fi
  curl "${arguments[@]}"
}

idempotency_key() {
  printf '%s' "$1" | shasum -a 256 2>/dev/null | cut -c1-32 ||
    printf '%s' "$1" | sha256sum | cut -c1-32
}

sign_in() {
  local username password
  read -r -p 'SwarmOps administrator username [admin]: ' username </dev/tty
  username="${username:-admin}"
  read -r -s -p 'SwarmOps administrator password: ' password </dev/tty
  printf '\n' >&2
  local payload
  payload="$(python3 -c 'import json,sys; print(json.dumps({"username": sys.argv[1], "password": sys.argv[2]}))' "$username" "$password")"
  local response
  response="$(api POST /api/v1/auth/login "$payload")" || fail 'sign-in was refused'
  csrf_token="$(printf '%s' "$response" | json csrfToken)" || fail 'controller returned no session'
  password=''
  note "Signed in to $core_url as $username."
}

# enrol prints the command for ONE machine and waits for that machine to
# connect. It returns the controller's id for it.
enrol() {
  local name="$1" response code fingerprint deadline
  response="$(api POST /api/v1/agents/enrollment-tokens "{\"name\":\"$name\"}")" || fail "could not create an enrolment code for $name"
  code="$(printf '%s' "$response" | json code)"
  fingerprint="$(printf '%s' "$response" | json coreFingerprint || true)"

  printf '\n' >&2
  note "── $name ─────────────────────────────────────────────"
  note 'Run this on the machine, then leave this script waiting:'
  printf '\n' >&2
  printf '  curl --fail --show-error --location \\\n' >&2
  printf '    %s \\\n' "$installer_url" >&2
  printf '    | sudo bash -s -- \\\n' >&2
  printf '    --core %s \\\n' "$core_url" >&2
  if [[ -n "$fingerprint" ]]; then
    printf '    --core-fingerprint %s \\\n' "$fingerprint" >&2
  fi
  printf '    --enrollment-code %s\n\n' "$code" >&2

  deadline=$(( $(date +%s) + wait_seconds ))
  while :; do
    local id
    id="$(api GET /api/v1/servers | python3 -c '
import json, sys
name = sys.argv[1]
for server in json.load(sys.stdin):
    if server.get("name") == name and server.get("connectionState") == "connected":
        print(server["id"]); break
' "$name")"
    if [[ -n "$id" ]]; then
      note "$name connected as $id."
      printf '%s' "$id"
      return 0
    fi
    (( $(date +%s) < deadline )) || fail "$name did not connect within ${wait_seconds}s"
    sleep "$poll_seconds"
  done
}

# queue submits one readiness plan and follows its run to a terminal state.
# Queue acceptance is not success, and this script says so by waiting.
queue() {
  local server_id="$1" description="$2" payload="$3" response command_id state deadline
  if ! $apply; then
    note "would queue: $description on $server_id"
    return 0
  fi
  note "queueing: $description"
  response="$(api POST "/api/v1/servers/$server_id/readiness" "$payload")" || fail "could not queue $description"
  command_id="$(printf '%s' "$response" | json id)" || fail 'controller returned no run id'

  deadline=$(( $(date +%s) + wait_seconds ))
  while :; do
    state="$(api GET "/api/v1/commands/$command_id" | json state)"
    case "$state" in
      succeeded) note "  done: $description"; return 0 ;;
      needs_attention|failed)
        note "  stopped: $description"
        note "  open Activity → Runs and look at run $command_id; it records why."
        exit 1 ;;
    esac
    (( $(date +%s) < deadline )) || fail "$description did not finish within ${wait_seconds}s (run $command_id)"
    sleep "$poll_seconds"
  done
}

plan() {
  python3 -c '
import json, sys
request = {"confirmation": "PREPARE_SERVER"}
for flag in sys.argv[1:]:
    key, _, value = flag.partition("=")
    request[key] = value if value else True
print(json.dumps(request))
' "$@"
}

sign_in

if ! $apply; then
  note ''
  note 'Reporting only. Nothing will be queued until you add --apply.'
fi

declare -a machine_ids=()
for index in $(seq 1 "$manager_count"); do
  machine_ids+=("$(enrol "$(printf '%s-%02d' "$name_prefix" "$index")")")
done

printf '\n' >&2
note "All $manager_count machines are connected. Preparing them."

for id in "${machine_ids[@]}"; do
  queue "$id" "install Docker on $id" "$(plan installDocker)"
done

primary="${machine_ids[0]}"
queue "$primary" "start the Swarm on $primary" "$(plan initializeSwarm)"

for id in "${machine_ids[@]:1}"; do
  # The controller reads the join token from the primary when this run
  # executes. It is never in this request, in the ledger, or in this terminal.
  queue "$id" "join $id to the Swarm as a $join_role" \
    "$(plan joinSwarm "joinFromServerId=$primary" "joinRole=$join_role")"
done

printf '\n' >&2
if $apply; then
  note 'The Swarm is formed. Open Machines in the console to see it.'
  if (( manager_count < 3 )) && [[ "$join_role" == 'manager' ]]; then
    note ''
    note "This cluster has $manager_count manager(s). Losing one loses the cluster;"
    note 'three is the smallest number that survives a single failure.'
  fi
else
  note 'Nothing was changed. Re-run with --apply to queue the operations above.'
fi
