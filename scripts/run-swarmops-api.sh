#!/usr/bin/env bash
set -euo pipefail
umask 077

# Native, non-Docker SwarmOps API runner. It deliberately builds the React
# console into the Go binary, stages only reviewed stack assets on the control
# host, and never starts or accesses a local Docker daemon/socket.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_dir="$repo_root"
prepare_only=false
temporary_files=()

usage() {
  printf '%s\n' \
    'Usage: make swarmops-native-api' \
    '       bash scripts/run-swarmops-api.sh [--prepare]' \
    '' \
    'Builds and runs the SwarmOps API on a host without Docker.' \
    'It requires protected files through SWARMOPS_ADMIN_PASSWORD_HASH_FILE,' \
    'SWARMOPS_SESSION_KEY_FILE, and SWARMOPS_DATA_ENCRYPTION_KEY_FILE; it' \
    'writes sealed controller state to SWARMOPS_DATA_DIR (default:' \
    '/var/lib/swarmops) and listens on 127.0.0.1:8084 by default.' \
    '' \
    '--prepare  build the binary and stage trusted stack assets, then exit.'
}

fail() {
  printf 'native SwarmOps API runner: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  local file
  for file in "${temporary_files[@]:-}"; do
    if [[ -n "$file" ]]; then
      rm -f -- "$file" || true
    fi
  done
  return 0
}
trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_secret_file() {
  local label="$1"
  local path="$2"
  local mode
  [[ -n "$path" ]] || fail "$label is required"
  [[ -f "$path" && -s "$path" && -r "$path" ]] || fail "$label must name a readable, non-empty protected file"
  mode="$(stat -c '%a' "$path" 2>/dev/null || stat -f '%Lp' "$path" 2>/dev/null)" || fail "cannot read permissions for $label"
  case "$mode" in
    [0-7][0-7][0-7]|[0-7][0-7][0-7][0-7])
      ;;
    *)
      fail "$label has an unsupported permission mode"
      ;;
  esac
  case "$mode" in
    400|600)
      ;;
    *)
      fail "$label must be readable only by its owner (mode 0400 or 0600)"
      ;;
  esac
}

require_regular_file() {
  local label="$1"
  local path="$2"
  [[ -n "$path" ]] || fail "$label is required"
  [[ -f "$path" && -s "$path" && -r "$path" ]] || fail "$label must name a readable, non-empty file"
}

ensure_directory() {
  local path="$1"
  [[ "$path" == /* && "$path" != "/" ]] || fail "$path must be an absolute, non-root directory"
  if [[ ! -e "$path" ]]; then
    mkdir -p -m 700 "$path"
  fi
  [[ -d "$path" ]] || fail "$path must be a directory"
  [[ -w "$path" ]] || fail "$path must be writable by the API service user"
}

stage_asset() {
  local source="$1"
  local destination="$2"
  local temporary
  [[ -f "$source" ]] || fail "trusted asset is missing: $source"
  temporary="$(mktemp "${destination}.tmp.XXXXXX")"
  temporary_files+=("$temporary")
  cp "$source" "$temporary"
  chmod 0444 "$temporary"
  mv -f "$temporary" "$destination"
}

ensure_dependencies() {
  local directory="$1"
  [[ -f "$directory/package-lock.json" ]] || fail "package lock is missing: $directory/package-lock.json"
  if [[ ! -d "$directory/node_modules" ]]; then
    npm --prefix "$directory" ci
  fi
}

case "${1:-}" in
  "")
    ;;
  --prepare)
    prepare_only=true
    shift
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    fail "unknown option: $1"
    ;;
esac
[[ "$#" -eq 0 ]] || fail 'unexpected arguments'

case "${SWARMOPS_INSECURE_DEV_AUTH:-}" in
  ""|false|0)
    ;;
  *)
    fail 'SWARMOPS_INSECURE_DEV_AUTH is not allowed by the native production runner'
    ;;
esac
if [[ -n "${SWARMOPS_SECURE_COOKIES:-}" && "${SWARMOPS_SECURE_COOKIES}" != "true" ]]; then
  fail 'SWARMOPS_SECURE_COOKIES must remain true for reverse-proxy or direct TLS operation'
fi

require_command go
require_command npm
require_secret_file 'SWARMOPS_ADMIN_PASSWORD_HASH_FILE' "${SWARMOPS_ADMIN_PASSWORD_HASH_FILE:-}"
require_secret_file 'SWARMOPS_SESSION_KEY_FILE' "${SWARMOPS_SESSION_KEY_FILE:-}"
require_secret_file 'SWARMOPS_DATA_ENCRYPTION_KEY_FILE' "${SWARMOPS_DATA_ENCRYPTION_KEY_FILE:-}"
if [[ -n "${SWARMOPS_AGENT_TOKEN_FILE:-}" ]]; then
  require_secret_file 'SWARMOPS_AGENT_TOKEN_FILE' "$SWARMOPS_AGENT_TOKEN_FILE"
fi
if [[ -n "${SWARMOPS_REGISTRY_CONFIG_FILE:-}" ]]; then
  require_secret_file 'SWARMOPS_REGISTRY_CONFIG_FILE' "$SWARMOPS_REGISTRY_CONFIG_FILE"
fi

listen_addr="${SWARMOPS_LISTEN_ADDR:-127.0.0.1:8084}"
tls_cert_file="${SWARMOPS_TLS_CERT_FILE:-}"
tls_key_file="${SWARMOPS_TLS_KEY_FILE:-}"
if [[ -n "$tls_cert_file" || -n "$tls_key_file" ]]; then
  require_regular_file 'SWARMOPS_TLS_CERT_FILE' "$tls_cert_file"
  require_secret_file 'SWARMOPS_TLS_KEY_FILE' "$tls_key_file"
else
  case "$listen_addr" in
    127.0.0.1:*|localhost:*|'[::1]:'*)
      ;;
    *)
      fail 'SWARMOPS_LISTEN_ADDR must stay on loopback unless direct TLS certificate and key files are configured'
      ;;
  esac
fi

data_dir="${SWARMOPS_DATA_DIR:-/var/lib/swarmops}"
asset_dir="${SWARMOPS_ASSET_DIR:-$data_dir/assets}"
binary_dir="${SWARMOPS_NATIVE_BIN_DIR:-$data_dir/bin}"
api_binary="$binary_dir/swarmops-api"
ensure_directory "$data_dir"
ensure_directory "$asset_dir"
ensure_directory "$binary_dir"

stage_asset "$repo_root/deploy/stacks/swarmops-agent.yml" "$asset_dir/agent.yml"
stage_asset "$repo_root/deploy/stacks/swarmops-logs.yml" "$asset_dir/logs.yml"
stage_asset "$repo_root/deploy/stacks/swarmops-mongo.yml" "$asset_dir/mongo.yml"
stage_asset "$repo_root/deploy/stacks/swarmops-observability.yml" "$asset_dir/observability.yml"
stage_asset "$repo_root/deploy/stacks/swarmops-postgres.yml" "$asset_dir/postgres.yml"
stage_asset "$repo_root/deploy/stacks/swarmops-redis.yml" "$asset_dir/redis.yml"
stage_asset "$repo_root/deploy/stacks/traefik.yml" "$asset_dir/traefik.yml"

ensure_dependencies "$app_dir/web"
npm --prefix "$app_dir/web" run build

temporary_binary="$(mktemp "$binary_dir/.swarmops-api.XXXXXX")"
temporary_files+=("$temporary_binary")
(
  cd "$app_dir"
  CGO_ENABLED=0 go build -trimpath -o "$temporary_binary" ./cmd/api
)
chmod 0755 "$temporary_binary"
mv -f "$temporary_binary" "$api_binary"

export SWARMOPS_ASSET_DIR="$asset_dir"
export SWARMOPS_DATA_DIR="$data_dir"
export SWARMOPS_INSECURE_DEV_AUTH=false
export SWARMOPS_LISTEN_ADDR="$listen_addr"
export SWARMOPS_SECURE_COOKIES=true

printf 'Prepared native SwarmOps API at %s\n' "$api_binary"
printf 'State and reviewed assets are on this host under %s\n' "$data_dir"
if [[ -n "$tls_cert_file" ]]; then
  printf 'Listening address: https://%s (direct TLS)\n' "$SWARMOPS_LISTEN_ADDR"
else
  printf 'Listening address: %s (place an HTTPS reverse proxy in front of it)\n' "$SWARMOPS_LISTEN_ADDR"
fi

if [[ "$prepare_only" == true ]]; then
  exit 0
fi

exec "$api_binary"
