#!/usr/bin/env bash
set -euo pipefail

action="${1:?usage: swarm.sh <action>}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

trim() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"
  printf '%s' "$value"
}

load_env_file() {
  local file="$1"
  [[ -f "$file" ]] || { echo "missing environment file: $file" >&2; exit 1; }

  while IFS= read -r raw_line || [[ -n "$raw_line" ]]; do
    local line key value
    line="$(trim "${raw_line%$'\r'}")"
    [[ -z "$line" || "$line" == \#* ]] && continue
    [[ "$line" == *=* ]] || { echo "invalid line in $file" >&2; exit 1; }
    key="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
      echo "invalid variable name in $file: $key" >&2; exit 1; }
    export "$key=$value"
  done < "$file"
}

load_host() {
  local host="${HOST:?HOST is required}"
  load_env_file "$repo_root/deploy/hosts/$host.env"
  : "${DOCKER_CONTEXT:?DOCKER_CONTEXT is required in deploy/hosts/$host.env}"
}

stack_file() {
  local stack="${STACK:?STACK is required}"
  local file="$repo_root/deploy/stacks/$stack.yml"
  [[ -f "$file" ]] || { echo "unknown stack: $stack" >&2; exit 1; }
  printf '%s' "$file"
}

render_stack() {
  local file
  file="$(stack_file)"
  export REGISTRY="${REGISTRY:-ghcr.io}"
  export REGISTRY_NS="${REGISTRY_NS:-nimasrn}"
  export TAG="${TAG:-$(git -C "$repo_root" rev-parse --short HEAD)}"
  # A harmless fallback lets stack validation run without an operator host file.
  export TRAEFIK_ACME_EMAIL="${TRAEFIK_ACME_EMAIL:-ops@example.invalid}"
  cd "$repo_root"
  docker stack config -c "$file"
}

service_name() {
  : "${STACK:?STACK is required}"
  : "${SERVICE:?SERVICE is required}"
  printf '%s_%s' "$STACK" "$SERVICE"
}

case "$action" in
  context)
    load_host
    : "${SSH_TARGET:?SSH_TARGET is required in the host file}"
    docker context create "$DOCKER_CONTEXT" --docker "host=ssh://$SSH_TARGET" 2>/dev/null \
      || docker context update "$DOCKER_CONTEXT" --docker "host=ssh://$SSH_TARGET"
    ;;
  init)
    load_host
    : "${ADVERTISE_ADDR:?ADVERTISE_ADDR is required}"
    state="$(docker --context "$DOCKER_CONTEXT" info --format '{{.Swarm.LocalNodeState}}')"
    if [[ "$state" == "active" ]]; then
      echo "swarm is already active on $HOST"
    else
      docker --context "$DOCKER_CONTEXT" swarm init --advertise-addr "$ADVERTISE_ADDR"
    fi
    ;;
  network)
    load_host
    if ! docker --context "$DOCKER_CONTEXT" network inspect traefik >/dev/null 2>&1; then
      docker --context "$DOCKER_CONTEXT" network create --driver overlay --attachable --opt encrypted traefik
    fi
    ;;
  label)
    load_host
    : "${NODE:?NODE is required}"
    : "${LABEL:?LABEL is required}"
    : "${VALUE:?VALUE is required}"
    docker --context "$DOCKER_CONTEXT" node update --label-add "$LABEL=$VALUE" "$NODE"
    ;;
  secret-create)
    load_host
    : "${SECRET:?SECRET is required}"
    : "${FILE:?FILE is required}"
    [[ -s "$FILE" ]] || { echo "secret file must exist and be non-empty" >&2; exit 1; }
    if docker --context "$DOCKER_CONTEXT" secret inspect "$SECRET" >/dev/null 2>&1; then
      echo "secret already exists and is immutable: $SECRET" >&2
      echo "create a new versioned name instead of overwriting it" >&2
      exit 1
    fi
    docker --context "$DOCKER_CONTEXT" secret create "$SECRET" "$FILE" >/dev/null
    echo "created secret metadata for $SECRET"
    ;;
  secret-list)
    load_host
    docker --context "$DOCKER_CONTEXT" secret ls
    ;;
  stack-config)
    render_stack
    ;;
  deploy)
    load_host
    [[ -z "$(git -C "$repo_root" status --porcelain)" ]] || {
      echo "refusing to deploy from a dirty worktree" >&2; exit 1; }
    render_stack >/dev/null
    file="$(stack_file)"
    flags=(--detach=false --with-registry-auth)
    if [[ "${PRUNE:-}" == "1" ]]; then
      flags+=(--prune)
    fi
    cd "$repo_root"
    docker --context "$DOCKER_CONTEXT" stack deploy "${flags[@]}" -c "$file" "$STACK"
    ;;
  ps)
    load_host
    : "${STACK:?STACK is required}"
    docker --context "$DOCKER_CONTEXT" stack services "$STACK"
    ;;
  service-ps)
    load_host
    docker --context "$DOCKER_CONTEXT" service ps "$(service_name)"
    ;;
  logs)
    load_host
    tail="${TAIL:-200}"
    docker --context "$DOCKER_CONTEXT" service logs -f --tail "$tail" "$(service_name)"
    ;;
  scale)
    load_host
    : "${REPLICAS:?REPLICAS is required}"
    [[ "$REPLICAS" =~ ^[0-9]+$ ]] || { echo "REPLICAS must be a non-negative integer" >&2; exit 1; }
    docker --context "$DOCKER_CONTEXT" service scale "$(service_name)=$REPLICAS"
    ;;
  rollback)
    load_host
    docker --context "$DOCKER_CONTEXT" service rollback "$(service_name)"
    ;;
  *)
    echo "unsupported swarm action: $action" >&2
    exit 2
    ;;
esac
