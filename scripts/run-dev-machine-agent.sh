#!/usr/bin/env bash
set -euo pipefail
umask 077

# Run the source-built machine API for local development. This is deliberately
# separate from the production installer: it binds only loopback, makes no
# service-manager changes, and shares a local-only identity with `make dev-api`
# so Core can attach without browser-entered credentials. It is a host process:
# Docker may come online after the agent starts.

prepare_only=false
dev_root="${SWARMOPS_DEV_DIR:-${TMPDIR:-/tmp}/swarmops-dev}"
machine_name="${SWARMOPS_DEV_MACHINE_API_NAME:-Local machine}"
machine_port="${SWARMOPS_DEV_MACHINE_API_PORT:-9180}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repository_dir="$(cd -- "$script_dir/.." && pwd)"
machine_dir="$dev_root/machine-agent"
api_key_file="$machine_dir/api-key"
core_session_key_file="$dev_root/core-session-key"
tls_certificate_file="$machine_dir/tls.crt"
tls_key_file="$machine_dir/tls.key"
temporary_key=''
temporary_certificate=''
temporary_config=''
temporary_binary=''

usage() {
  printf '%s\n' \
    'Usage: bash scripts/run-dev-machine-agent.sh [--prepare]' \
    '' \
    'Runs the local source-built SwarmOps machine API on https://127.0.0.1:9180.' \
    'The local Core development server automatically connects through its pinned' \
    'loopback certificate and private development API key.' \
    '' \
    '--prepare  Create or validate the shared local TLS/key material without starting the agent.'
}

fail() {
  printf 'SwarmOps development machine agent: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  for path in "$temporary_key" "$temporary_certificate" "$temporary_config" "$temporary_binary"; do
    if [[ -n "$path" ]]; then
      rm -f -- "$path"
    fi
  done
}
trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

mode_of() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || return 1
}

require_regular_file() {
  local label="$1" path="$2"
  [[ -f "$path" && ! -L "$path" && -s "$path" ]] || fail "$label must be a non-empty regular file"
}

require_protected_file() {
  local label="$1" path="$2" mode
  require_regular_file "$label" "$path"
  mode="$(mode_of "$path")" || fail "cannot read permissions for $label"
  case "$mode" in
    400|600) ;;
    *) fail "$label must use mode 0400 or 0600" ;;
  esac
}

require_private_directory() {
  local label="$1" path="$2"
  [[ -d "$path" && ! -L "$path" ]] || fail "$label must be a non-symlink directory"
  chmod 0700 "$path"
}

validate_paths() {
  [[ "$dev_root" == /* && "$dev_root" != / ]] || fail 'SWARMOPS_DEV_DIR must be an absolute, non-root path'
  [[ "$machine_port" =~ ^[0-9]{1,5}$ ]] || fail 'SWARMOPS_DEV_MACHINE_API_PORT must be between 1 and 65535'
  ((10#$machine_port > 0 && 10#$machine_port < 65536)) || fail 'SWARMOPS_DEV_MACHINE_API_PORT must be between 1 and 65535'
  [[ -n "$machine_name" && ${#machine_name} -le 96 && "$machine_name" != *$'\n'* && "$machine_name" != *$'\r'* ]] || fail 'SWARMOPS_DEV_MACHINE_API_NAME must be between 1 and 96 characters'
}

prepare_api_key() {
  if [[ -e "$api_key_file" || -L "$api_key_file" ]]; then
    require_protected_file 'local development machine API key' "$api_key_file"
    local value_length
    value_length="$(LC_ALL=C tr -d '[:space:]' <"$api_key_file" | wc -c | tr -d '[:space:]')"
    [[ "$value_length" =~ ^[0-9]+$ ]] && ((value_length >= 16)) || fail 'local development machine API key must contain at least 16 non-whitespace bytes'
    return
  fi
  local temporary_key_file
  temporary_key_file="$(mktemp "$machine_dir/.api-key.XXXXXX")"
  if ! openssl rand -hex 32 >"$temporary_key_file"; then
    rm -f -- "$temporary_key_file"
    fail 'generate local development machine API key'
  fi
  install -m 0600 "$temporary_key_file" "$api_key_file"
  rm -f -- "$temporary_key_file"
}

prepare_core_session_key() {
  if [[ -e "$core_session_key_file" || -L "$core_session_key_file" ]]; then
    require_protected_file 'local development Core session key' "$core_session_key_file"
    local value_length
    value_length="$(LC_ALL=C tr -d '[:space:]' <"$core_session_key_file" | wc -c | tr -d '[:space:]')"
    [[ "$value_length" =~ ^[0-9]+$ ]] && ((value_length >= 32)) || fail 'local development Core session key must contain at least 32 non-whitespace bytes'
    return
  fi
  local temporary_session_key
  temporary_session_key="$(mktemp "$dev_root/.core-session-key.XXXXXX")"
  if ! openssl rand -hex 32 >"$temporary_session_key"; then
    rm -f -- "$temporary_session_key"
    fail 'generate local development Core session key'
  fi
  install -m 0600 "$temporary_session_key" "$core_session_key_file"
  rm -f -- "$temporary_session_key"
}

prepare_tls_identity() {
  if [[ -e "$tls_certificate_file" || -L "$tls_certificate_file" || -e "$tls_key_file" || -L "$tls_key_file" ]]; then
    require_regular_file 'local development machine API certificate' "$tls_certificate_file"
    require_protected_file 'local development machine API private key' "$tls_key_file"
    openssl x509 -in "$tls_certificate_file" -noout -checkend 0 >/dev/null || fail 'local development machine API certificate is invalid or expired'
    return
  fi

  temporary_key="$(mktemp "$machine_dir/.tls-key.XXXXXX")"
  temporary_certificate="$(mktemp "$machine_dir/.tls-certificate.XXXXXX")"
  temporary_config="$(mktemp "$machine_dir/.openssl.XXXXXX")"
  {
    printf '%s\n' \
      '[req]' \
      'distinguished_name = subject' \
      'x509_extensions = server_extensions' \
      'prompt = no' \
      '[subject]' \
      'CN = swarmops-local-machine-agent' \
      '[server_extensions]' \
      'basicConstraints = critical,CA:FALSE' \
      'keyUsage = critical,digitalSignature' \
      'extendedKeyUsage = serverAuth' \
      'subjectAltName = @subject_alternative_names' \
      '[subject_alternative_names]' \
      'DNS.1 = localhost' \
      'IP.1 = 127.0.0.1' \
      'IP.2 = ::1'
  } >"$temporary_config"
  if ! openssl ecparam -name prime256v1 -genkey -noout -out "$temporary_key"; then
    fail 'generate local development machine API private key'
  fi
  if ! openssl req -new -x509 -sha256 -days 30 -key "$temporary_key" -out "$temporary_certificate" -config "$temporary_config" -extensions server_extensions; then
    fail 'generate local development machine API certificate'
  fi
  openssl x509 -in "$temporary_certificate" -noout -checkend 0 >/dev/null || fail 'validate local development machine API certificate'
  install -m 0600 "$temporary_key" "$tls_key_file"
  install -m 0644 "$temporary_certificate" "$tls_certificate_file"
  rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
  temporary_key=''
  temporary_certificate=''
  temporary_config=''
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --prepare) prepare_only=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done

validate_paths
require_command openssl
if [[ -e "$dev_root" || -L "$dev_root" ]]; then
  require_private_directory 'SWARMOPS_DEV_DIR' "$dev_root"
else
  install -d -m 0700 "$dev_root"
fi
if [[ -e "$machine_dir" || -L "$machine_dir" ]]; then
  require_private_directory 'local development machine-agent directory' "$machine_dir"
else
  install -d -m 0700 "$machine_dir"
fi
prepare_api_key
prepare_core_session_key
prepare_tls_identity

if [[ "$prepare_only" == true ]]; then
  exit 0
fi

require_command go
docker_socket="${SWARMOPS_DOCKER_SOCKET:-}"
if [[ -z "$docker_socket" ]]; then
  case "$(uname -s)" in
    Linux) docker_socket='/var/run/docker.sock' ;;
    Darwin)
      if [[ -S "$HOME/.docker/run/docker.sock" ]]; then
        docker_socket="$HOME/.docker/run/docker.sock"
      elif [[ -S "$HOME/.orbstack/run/docker.sock" ]]; then
        docker_socket="$HOME/.orbstack/run/docker.sock"
      else
        docker_socket="$HOME/.docker/run/docker.sock"
      fi
      ;;
    *) fail "unsupported operating system: $(uname -s)" ;;
  esac
fi
if [[ ! -S "$docker_socket" ]]; then
  printf '%s\n' "SwarmOps development machine API: Docker is not available at $docker_socket; the host agent will start, but Docker and Swarm operations remain unavailable until it starts." >&2
fi

agent_binary="$machine_dir/swarmops-agent"
temporary_binary="$(mktemp "$machine_dir/.swarmops-agent.XXXXXX")"
if ! (cd "$repository_dir" && go build -o "$temporary_binary" ./cmd/agent); then
  fail 'build source development machine agent'
fi
chmod 0700 "$temporary_binary"
mv -f "$temporary_binary" "$agent_binary"
temporary_binary=''

printf 'SwarmOps development machine API: https://127.0.0.1:%s\n' "$machine_port"
printf '%s\n' 'The local Core development server will connect automatically.'
exec env \
  NODE_NAME="$machine_name" \
  SWARMOPS_AGENT_BUILD_ENABLED=false \
  SWARMOPS_AGENT_LISTEN_ADDR="127.0.0.1:$machine_port" \
  SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED=true \
  SWARMOPS_AGENT_TLS_CERT_FILE="$tls_certificate_file" \
  SWARMOPS_AGENT_TLS_KEY_FILE="$tls_key_file" \
  SWARMOPS_AGENT_TOKEN_FILE="$api_key_file" \
  SWARMOPS_DOCKER_SOCKET="$docker_socket" \
  SWARMOPS_HOST_OS=/etc/os-release \
  SWARMOPS_HOST_PROC=/proc \
  SWARMOPS_HOST_ROOT=/ \
  "$agent_binary"
