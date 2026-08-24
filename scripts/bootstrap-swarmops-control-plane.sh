#!/usr/bin/env bash
set -euo pipefail
umask 077

# Bootstrap one Docker-free SwarmOps controller host. The controller's API and
# embedded GUI run locally on this machine; it reaches cluster machines only
# through the pinned machine API selected by an authenticated operator.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
app_dir="$repo_root"
config_dir="/etc/swarmops"
runtime_dir="/usr/local/lib/swarmops"
state_dir="/var/lib/swarmops"
service_name="swarmops-control-plane.service"
service_user="swarmops"
install_dependencies=false
listen_ip=""
operator_cidrs=""
listen_address=""
all_cidrs=""
admin_password=""
admin_password_confirm=""

usage() {
  printf '%s\n' \
    'Usage:' \
    '  sudo bash scripts/bootstrap-swarmops-control-plane.sh \' \
    '    --listen-ip <server-ip> --allow-cidr <operator-device-cidr> [--install-dependencies]' \
    '' \
    'Builds a Docker-free, server-local SwarmOps control plane with its embedded' \
    'GUI. It generates an IP-SAN TLS certificate, a random high TCP port, a' \
    'separate AES-256-GCM data key, and a restricted systemd service. It does' \
    'not install Docker, create a Swarm, or contact any cluster.' \
    '' \
    '--listen-ip <server-ip>     A literal IP configured on this host.' \
    '--allow-cidr <CIDR>         An operator device or trusted network; repeatable.' \
    '--install-dependencies      Install Go, npm, OpenSSL, and iproute2 on Debian/Ubuntu.' \
    '-h, --help                  Show this help.'
}

fail() {
  printf 'SwarmOps controller bootstrap: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  admin_password=""
  admin_password_confirm=""
}
trap cleanup EXIT

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_root() {
  [[ "$(id -u)" == "0" ]] || fail 'run this command with sudo on the controller host'
}

install_host_dependencies() {
  [[ -f /etc/debian_version ]] || fail '--install-dependencies supports Debian and Ubuntu only'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install --yes --no-install-recommends ca-certificates golang-go iproute2 npm openssl
}

assert_repository() {
  [[ -f "$app_dir/go.mod" ]] || fail 'the checked-out SwarmOps Go module is missing'
  [[ -f "$app_dir/web/package-lock.json" ]] || fail 'the SwarmOps web lockfile is missing'
  [[ -f "$repo_root/web/vendor/nim-ui/package.json" ]] || fail 'the vendored nim-ui package is missing'
  [[ -f "$repo_root/web/vendor/nim-ui/dist/nim.js" ]] || fail 'the vendored nim-ui build is missing'
  [[ -f "$repo_root/scripts/run-swarmops-api.sh" ]] || fail 'the native API runner is missing'
}

assert_fresh_controller() {
  local path
  for path in \
    "$config_dir/control-plane.env" \
    "$config_dir/admin-password-hash" \
    "$config_dir/session-key" \
    "$config_dir/data-encryption-key" \
    "$config_dir/tls.key" \
    "$config_dir/tls.crt" \
    "$state_dir/servers.sealed" \
    "$state_dir/audit.sealed" \
    "$state_dir/servers.json" \
    "$state_dir/audit.ndjson" \
    "$runtime_dir/bin/swarmops-api" \
    "/etc/systemd/system/$service_name"; do
    [[ ! -e "$path" ]] || fail "existing controller state found at $path; this bootstrap refuses to overwrite it"
  done
}

assert_local_ip() {
  local address="$1"
  [[ -n "$address" && "$address" != *$'\n'* && "$address" != *$'\r'* ]] || fail '--listen-ip must be one literal local IP address'
  ip -o addr show | awk '{sub(/\/.*/, "", $4); print $4}' | grep -Fqx -- "$address" || fail '--listen-ip must be configured on this host'
}

append_allowed_cidr() {
  local cidr="$1"
  [[ -n "$cidr" && "$cidr" != *$'\n'* && "$cidr" != *$'\r'* && "$cidr" != *,* ]] || fail '--allow-cidr must be one CIDR without commas or line breaks'
  if [[ -n "$operator_cidrs" ]]; then
    operator_cidrs="$operator_cidrs,$cidr"
  else
    operator_cidrs="$cidr"
  fi
}

random_port() {
  local attempt random_value candidate
  for attempt in $(seq 1 128); do
    random_value="$(od -An -N2 -tu2 /dev/urandom | tr -d '[:space:]')"
    candidate=$((20000 + random_value % 40000))
    if ! ss -H -ltn "sport = :$candidate" | grep -q .; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done
  return 1
}

write_random_secret() {
  local destination="$1"
  local bytes="$2"
  local temporary
  temporary="$(mktemp "$config_dir/.secret.XXXXXX")"
  if ! openssl rand -base64 "$bytes" >"$temporary"; then
    rm -f -- "$temporary"
    fail "generate $destination"
  fi
  if ! install -o "$service_user" -g "$service_user" -m 0600 "$temporary" "$destination"; then
    rm -f -- "$temporary"
    fail "install $destination"
  fi
  rm -f -- "$temporary"
}

write_admin_password_hash() {
  local destination="$config_dir/admin-password-hash"
  local password_hash temporary
  [[ -t 0 && -t 1 ]] || fail 'a terminal is required to set the initial administrator password'
  while true; do
    IFS= read -r -s -p 'Set SwarmOps administrator password (at least 16 characters): ' admin_password
    printf '\n'
    [[ ${#admin_password} -ge 16 ]] || {
      printf '%s\n' 'Password must be at least 16 characters.' >&2
      admin_password=""
      continue
    }
    IFS= read -r -s -p 'Confirm administrator password: ' admin_password_confirm
    printf '\n'
    [[ "$admin_password" == "$admin_password_confirm" ]] || {
      printf '%s\n' 'Passwords did not match.' >&2
      admin_password=""
      admin_password_confirm=""
      continue
    }
    break
  done
  password_hash="$(printf '%s' "$admin_password" | (cd "$app_dir" && go run ./cmd/swarmopsctl password-hash --stdin))" || fail 'hash administrator password'
  admin_password=""
  admin_password_confirm=""
  [[ -n "$password_hash" ]] || fail 'administrator password hash is empty'
  temporary="$(mktemp "$config_dir/.admin-password-hash.XXXXXX")"
  printf '%s\n' "$password_hash" >"$temporary"
  if ! install -o "$service_user" -g "$service_user" -m 0600 "$temporary" "$destination"; then
    rm -f -- "$temporary"
    fail "install $destination"
  fi
  rm -f -- "$temporary"
  password_hash=""
}

write_tls_material() {
  local key_file="$config_dir/tls.key"
  local certificate_file="$config_dir/tls.crt"
  local temporary_key temporary_certificate
  temporary_key="$(mktemp "$config_dir/.tls-key.XXXXXX")"
  temporary_certificate="$(mktemp "$config_dir/.tls-cert.XXXXXX")"
  if ! openssl ecparam -name prime256v1 -genkey -noout -out "$temporary_key"; then
    rm -f -- "$temporary_key" "$temporary_certificate"
    fail 'generate TLS private key'
  fi
  if ! openssl req -new -x509 -sha256 -days 397 -key "$temporary_key" -out "$temporary_certificate" \
    -subj "/CN=$listen_ip" \
    -addext "subjectAltName=IP:$listen_ip" \
    -addext 'basicConstraints=critical,CA:FALSE' \
    -addext 'keyUsage=critical,digitalSignature' \
    -addext 'extendedKeyUsage=serverAuth'; then
    rm -f -- "$temporary_key" "$temporary_certificate"
    fail 'generate TLS certificate'
  fi
  openssl x509 -in "$temporary_certificate" -noout -checkend 0 >/dev/null || {
    rm -f -- "$temporary_key" "$temporary_certificate"
    fail 'validate TLS certificate'
  }
  if ! install -o "$service_user" -g "$service_user" -m 0600 "$temporary_key" "$key_file"; then
    rm -f -- "$temporary_key" "$temporary_certificate"
    fail 'install TLS private key'
  fi
  if ! install -o "$service_user" -g "$service_user" -m 0644 "$temporary_certificate" "$certificate_file"; then
    rm -f -- "$temporary_key" "$temporary_certificate"
    fail 'install TLS certificate'
  fi
  rm -f -- "$temporary_key" "$temporary_certificate"
}

write_environment_file() {
  local port="$1"
  local local_cidrs temporary
  if [[ "$listen_ip" == *:* ]]; then
    listen_address="[$listen_ip]:$port"
    local_cidrs="$listen_ip/128,::1/128"
  else
    listen_address="$listen_ip:$port"
    local_cidrs="$listen_ip/32,127.0.0.1/32"
  fi
  all_cidrs="$operator_cidrs,$local_cidrs"
  install -d -o root -g "$service_user" -m 0750 "$config_dir"
  temporary="$(mktemp "$config_dir/.control-plane.env.XXXXXX")"
  {
    printf '%s\n' \
      'SWARMOPS_ADMIN_USERNAME=operator' \
      "SWARMOPS_ADMIN_PASSWORD_HASH_FILE=$config_dir/admin-password-hash" \
      "SWARMOPS_SESSION_KEY_FILE=$config_dir/session-key" \
      "SWARMOPS_DATA_ENCRYPTION_KEY_FILE=$config_dir/data-encryption-key" \
      "SWARMOPS_TLS_CERT_FILE=$config_dir/tls.crt" \
      "SWARMOPS_TLS_KEY_FILE=$config_dir/tls.key" \
      "SWARMOPS_LISTEN_ADDR=$listen_address" \
      "SWARMOPS_ALLOWED_CLIENT_CIDRS=$all_cidrs" \
      "SWARMOPS_DATA_DIR=$state_dir" \
      "SWARMOPS_ASSET_DIR=$runtime_dir/assets" \
      'SWARMOPS_MUTATIONS_ENABLED=false' \
      'SWARMOPS_BUILD_ENABLED=false' \
      'SWARMOPS_INSECURE_DEV_AUTH=false' \
      'SWARMOPS_SECURE_COOKIES=true' \
      'SWARMOPS_SESSION_TTL=4h'
  } >"$temporary"
  if ! install -o root -g "$service_user" -m 0640 "$temporary" "$config_dir/control-plane.env"; then
    rm -f -- "$temporary"
    fail 'install control-plane environment file'
  fi
  rm -f -- "$temporary"
}

prepare_runtime() {
  SWARMOPS_ADMIN_PASSWORD_HASH_FILE="$config_dir/admin-password-hash" \
  SWARMOPS_SESSION_KEY_FILE="$config_dir/session-key" \
  SWARMOPS_DATA_ENCRYPTION_KEY_FILE="$config_dir/data-encryption-key" \
  SWARMOPS_TLS_CERT_FILE="$config_dir/tls.crt" \
  SWARMOPS_TLS_KEY_FILE="$config_dir/tls.key" \
  SWARMOPS_LISTEN_ADDR="$listen_address" \
  SWARMOPS_ALLOWED_CLIENT_CIDRS="$all_cidrs" \
  SWARMOPS_DATA_DIR="$state_dir" \
  SWARMOPS_ASSET_DIR="$runtime_dir/assets" \
  SWARMOPS_NATIVE_BIN_DIR="$runtime_dir/bin" \
  SWARMOPS_SECURE_COOKIES=true \
  SWARMOPS_INSECURE_DEV_AUTH=false \
  bash "$repo_root/scripts/run-swarmops-api.sh" --prepare

  chown -R root:"$service_user" "$runtime_dir"
  find "$runtime_dir" -type d -exec chmod 0750 {} +
  find "$runtime_dir" -type f -exec chmod 0640 {} +
  chmod 0750 "$runtime_dir/bin/swarmops-api"
}

write_systemd_service() {
  install -d -o root -g root -m 0755 /etc/systemd/system
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps secure Docker-free control plane' \
      'Wants=network-online.target' \
      'After=network-online.target' \
      '' \
      '[Service]' \
      'Type=simple' \
      "User=$service_user" \
      "Group=$service_user" \
      "EnvironmentFile=$config_dir/control-plane.env" \
      "WorkingDirectory=$state_dir" \
      "ExecStart=$runtime_dir/bin/swarmops-api" \
      'Restart=on-failure' \
      'RestartSec=5s' \
      'NoNewPrivileges=yes' \
      'PrivateTmp=yes' \
      'PrivateDevices=yes' \
      'ProtectSystem=strict' \
      'ProtectHome=yes' \
      'ProtectKernelTunables=yes' \
      'ProtectKernelModules=yes' \
      'ProtectKernelLogs=yes' \
      'ProtectControlGroups=yes' \
      'ProtectClock=yes' \
      'ProtectHostname=yes' \
      'LockPersonality=yes' \
      'RestrictNamespaces=yes' \
      'RestrictRealtime=yes' \
      'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' \
      'SystemCallArchitectures=native' \
      'CapabilityBoundingSet=' \
      'AmbientCapabilities=' \
      'ReadWritePaths=/var/lib/swarmops' \
      'ReadOnlyPaths=/etc/swarmops /usr/local/lib/swarmops' \
      'UMask=0077' \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target'
  } | install -o root -g root -m 0644 /dev/stdin "/etc/systemd/system/$service_name"
}

wait_for_service() {
  local attempt
  for attempt in $(seq 1 15); do
    if systemctl is-active --quiet "$service_name"; then
      return 0
    fi
    sleep 1
  done
  systemctl status --no-pager "$service_name" >&2 || true
  fail 'the control-plane service did not become active'
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --listen-ip)
      [[ "$#" -ge 2 ]] || fail '--listen-ip requires a value'
      listen_ip="$2"
      shift 2
      ;;
    --allow-cidr)
      [[ "$#" -ge 2 ]] || fail '--allow-cidr requires a value'
      append_allowed_cidr "$2"
      shift 2
      ;;
    --install-dependencies)
      install_dependencies=true
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
done

require_root
[[ -n "$listen_ip" ]] || fail '--listen-ip is required'
[[ -n "$operator_cidrs" ]] || fail 'at least one --allow-cidr is required'
if [[ "$install_dependencies" == true ]]; then
  install_host_dependencies
fi
require_command find
require_command go
require_command ip
require_command npm
require_command od
require_command openssl
require_command ss
require_command systemctl
assert_repository
assert_local_ip "$listen_ip"
assert_fresh_controller

if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$service_user"
fi
id -nG "$service_user" | tr ' ' '\n' | grep -Fqx docker && fail 'the SwarmOps service account must not belong to the docker group'

port="$(random_port)" || fail 'could not choose a free random TCP port'
install -d -o "$service_user" -g "$service_user" -m 0700 "$state_dir"
install -d -o root -g "$service_user" -m 0750 "$runtime_dir"
install -d -o root -g "$service_user" -m 0750 "$config_dir"
write_admin_password_hash
write_random_secret "$config_dir/session-key" 48
write_random_secret "$config_dir/data-encryption-key" 32
write_tls_material
write_environment_file "$port"
prepare_runtime
write_systemd_service
systemctl daemon-reload
systemctl enable --now "$service_name"
wait_for_service

certificate_fingerprint="$(openssl x509 -in "$config_dir/tls.crt" -noout -fingerprint -sha256 | sed 's/^sha256 Fingerprint=//')"
printf '\n%s\n' 'SwarmOps control plane is ready.'
printf 'URL: https://%s:%s\n' "$listen_ip" "$port"
printf 'TLS SHA-256 fingerprint: %s\n' "$certificate_fingerprint"
printf 'Allowed client networks: %s\n' "$operator_cidrs"
printf '%s\n' 'Verify this fingerprint over your server console before trusting the self-signed certificate in a browser.'
printf '%s\n' 'The controller has no Docker socket access; mutations and builds remain disabled until you explicitly enable them.'
