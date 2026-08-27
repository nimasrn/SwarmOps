#!/usr/bin/env bash
set -euo pipefail
umask 077

# Bootstrap one Docker-free SwarmOps controller host. The controller's API and
# embedded GUI run locally on this machine; it reaches cluster machines only
# through the pinned machine API selected by an authenticated operator.
config_dir="/etc/swarmops"
runtime_dir="/usr/local/lib/swarmops"
release_dir="$runtime_dir/releases"
state_dir="/var/lib/swarmops"
service_name="swarmops-control-plane.service"
service_user="swarmops"
warden_service_name="swarmops-core-warden.service"
warden_timer_name="swarmops-core-warden.timer"
github_repository="nimasrn/SwarmOps"
release_version="latest"
install_dependencies=false
listen_ip=""
operator_cidrs=""
listen_address=""
all_cidrs=""
admin_password=""
admin_password_confirm=""
generate_admin_password=false
generated_admin_password=""
bootstrap_phase="initializing"
automatic_setup=false

usage() {
  printf '%s\n' \
    'Usage:' \
    '  curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash' \
    '' \
    'The zero-argument installer detects safe defaults, confirms the controller' \
    'IP and operator CIDR through the terminal, installs required Debian/Ubuntu' \
    'packages, and generates the initial operator password.' \
    '' \
    'Automation:' \
    "  set -o pipefail; curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \\" \
    '    https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash -s -- \' \
    '    --listen-ip <server-ip> --allow-cidr <operator-device-cidr> --generate-admin-password [--install-dependencies]' \
    '' \
    'Downloads a checksum-verified SwarmOps Core + Warden release bundle for a' \
    'Docker-free, server-local controller. It generates an IP-SAN TLS' \
    'certificate, a random high TCP port, a separate AES-256-GCM data key, and' \
    'a restricted systemd service. It does not install Docker, create a Swarm,' \
    'or contact any cluster.' \
    '' \
    '--listen-ip <server-ip>     A literal IP configured on this host.' \
    '--allow-cidr <CIDR>         An operator device or trusted network; repeatable.' \
    '--release <tag|latest>      GitHub release tag, or latest (default: latest).' \
    '--github-repository <owner/name>  Release repository (default: nimasrn/SwarmOps).' \
    '--generate-admin-password   Generate a 256-bit password for the operator account and print it once after a successful install.' \
    '--install-dependencies      Install curl, OpenSSL, and iproute2 on Debian/Ubuntu.' \
    '-h, --help                  Show this help.'
}

info() {
  printf 'SwarmOps controller bootstrap: %s\n' "$*" >&2
}

fail() {
  printf 'SwarmOps controller bootstrap: %s\n' "$*" >&2
  exit 1
}

unexpected_failure() {
  local status="$?"
  trap - ERR
  info "failed during $bootstrap_phase (exit $status); no URL or credentials were printed."
  exit "$status"
}

cleanup() {
  admin_password=""
  admin_password_confirm=""
  generated_admin_password=""
}
trap cleanup EXIT
trap unexpected_failure ERR

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

require_root() {
  [[ "$(id -u)" == "0" ]] || fail 'run this command with sudo on the controller host'
}

install_host_dependencies() {
  [[ -f /etc/debian_version ]] || fail '--install-dependencies supports Debian and Ubuntu only'
  export DEBIAN_FRONTEND=noninteractive
  apt-get update </dev/null
  apt-get install --yes --no-install-recommends ca-certificates curl iproute2 openssl </dev/null
}

prompt_value() {
  local label="$1"
  local default_value="$2"
  local answer=""
  [[ -r /dev/tty && -w /dev/tty ]] || fail 'the zero-argument installer needs an interactive terminal; use --listen-ip and --allow-cidr for unattended installation'
  if [[ -n "$default_value" ]]; then
    printf '%s [%s]: ' "$label" "$default_value" >/dev/tty
  else
    printf '%s: ' "$label" >/dev/tty
  fi
  IFS= read -r answer </dev/tty || fail "could not read $label from the terminal"
  printf '%s\n' "${answer:-$default_value}"
}

ssh_connection_field() {
  local field="$1"
  local client_ip="" client_port="" server_ip="" server_port="" remainder=""
  [[ -n "${SSH_CONNECTION:-}" ]] || return 0
  read -r client_ip client_port server_ip server_port remainder <<<"$SSH_CONNECTION"
  [[ -z "$remainder" ]] || return 0
  case "$field" in
    client) printf '%s\n' "$client_ip" ;;
    server) printf '%s\n' "$server_ip" ;;
  esac
}

detected_controller_ip() {
  local candidate=""
  candidate="$(ssh_connection_field server)"
  if [[ -n "$candidate" ]] && ip -o addr show | awk '{sub(/\/.*/, "", $4); print $4}' | grep -Fqx -- "$candidate"; then
    printf '%s\n' "$candidate"
    return 0
  fi
  candidate="$(ip -o -4 addr show scope global | awk 'NR == 1 {sub(/\/.*/, "", $4); print $4}')"
  if [[ -z "$candidate" ]]; then
    candidate="$(ip -o -6 addr show scope global | awk 'NR == 1 {sub(/\/.*/, "", $4); print $4}')"
  fi
  printf '%s\n' "$candidate"
}

detected_operator_cidr() {
  local candidate=""
  candidate="$(ssh_connection_field client)"
  [[ -n "$candidate" ]] || return 0
  if [[ "$candidate" == *:* ]]; then
    printf '%s/128\n' "$candidate"
  else
    printf '%s/32\n' "$candidate"
  fi
}

configure_automatic_network() {
  local detected_listen_ip detected_cidr selected_cidr
  [[ -r /dev/tty && -w /dev/tty ]] || fail 'the zero-argument installer needs an interactive terminal; use --listen-ip and --allow-cidr for unattended installation'
  detected_listen_ip="$(detected_controller_ip)"
  detected_cidr="$(detected_operator_cidr)"
  printf '\n%s\n' 'SwarmOps needs one controller IP for its TLS identity and one trusted operator network.' >/dev/tty
  printf '%s\n' 'Press Enter to accept a detected value, or type the correct value.' >/dev/tty
  listen_ip="$(prompt_value 'Controller IP' "$detected_listen_ip")"
  selected_cidr="$(prompt_value 'Allowed operator CIDR' "$detected_cidr")"
  append_allowed_cidr "$selected_cidr"
}

validate_repository() {
  [[ "$github_repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail '--github-repository must be owner/name'
}

validate_release() {
  [[ "$release_version" == latest || "$release_version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail '--release must be latest or a safe release tag'
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
    "$release_dir/current" \
    "$runtime_dir/bin/swarmops-api" \
    "/etc/systemd/system/$service_name" \
    "/etc/systemd/system/$warden_service_name" \
    "/etc/systemd/system/$warden_timer_name"; do
    [[ ! -e "$path" ]] || fail "existing controller state found at $path; this bootstrap refuses to overwrite it"
  done
}

release_platform() {
  os_name="$(uname -s)"
  [[ "$os_name" == Linux ]] || fail "unsupported operating system: $os_name"
  case "$(uname -m)" in
    x86_64|amd64)
      release_arch='amd64'
      ;;
    aarch64|arm64)
      release_arch='arm64'
      ;;
    *)
      fail "unsupported CPU architecture: $(uname -m)"
      ;;
  esac
}

resolve_release_version() {
  [[ "$release_version" == latest ]] || return
  local resolved_url
  resolved_url="$(curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output /dev/null --write-out '%{url_effective}' "https://github.com/$github_repository/releases/latest")" || fail 'resolve latest GitHub release'
  case "$resolved_url" in
    "https://github.com/$github_repository/releases/tag/"*)
      release_version="${resolved_url##*/}"
      ;;
    *)
      fail 'latest GitHub release did not resolve to the requested repository'
      ;;
  esac
  validate_release
  [[ "$release_version" != latest ]] || fail 'latest GitHub release did not include a tag'
}

checksum_for_file() {
  local target_path="$1"
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$target_path" | awk '{print $1}'
  else
    shasum -a 256 "$target_path" | awk '{print $1}'
  fi
}

verify_core_bundle_layout() {
  local archive_path="$1" entry
  local core_count=0 warden_count=0 alertmanager_count=0 agent_count=0 fluentd_aggregator_count=0 fluentd_forwarder_count=0 jaeger_count=0 logs_count=0 mongo_count=0 observability_count=0 postgres_count=0 prometheus_alerts_count=0 prometheus_count=0 redis_count=0 traefik_dynamic_count=0 traefik_count=0
  while IFS= read -r entry; do
    case "$entry" in
      swarmops-core) core_count=$((core_count + 1)) ;;
      swarmops-warden) warden_count=$((warden_count + 1)) ;;
      assets/alertmanager.yml) alertmanager_count=$((alertmanager_count + 1)) ;;
      assets/agent.yml) agent_count=$((agent_count + 1)) ;;
      assets/fluentd-aggregator.conf) fluentd_aggregator_count=$((fluentd_aggregator_count + 1)) ;;
      assets/fluentd-forwarder.conf) fluentd_forwarder_count=$((fluentd_forwarder_count + 1)) ;;
      assets/jaeger.yml) jaeger_count=$((jaeger_count + 1)) ;;
      assets/logs.yml) logs_count=$((logs_count + 1)) ;;
      assets/mongo.yml) mongo_count=$((mongo_count + 1)) ;;
      assets/observability.yml) observability_count=$((observability_count + 1)) ;;
      assets/postgres.yml) postgres_count=$((postgres_count + 1)) ;;
      assets/prometheus-alerts.yml) prometheus_alerts_count=$((prometheus_alerts_count + 1)) ;;
      assets/prometheus.yml) prometheus_count=$((prometheus_count + 1)) ;;
      assets/redis.yml) redis_count=$((redis_count + 1)) ;;
      assets/traefik-dynamic.yml) traefik_dynamic_count=$((traefik_dynamic_count + 1)) ;;
      assets/traefik.yml) traefik_count=$((traefik_count + 1)) ;;
      *) fail "release archive contains unsupported entry: $entry" ;;
    esac
  done < <(tar -tzf "$archive_path")
  ((core_count == 1 && warden_count == 1 && alertmanager_count == 1 && agent_count == 1 && fluentd_aggregator_count == 1 && fluentd_forwarder_count == 1 && jaeger_count == 1 && logs_count == 1 && mongo_count == 1 && observability_count == 1 && postgres_count == 1 && prometheus_alerts_count == 1 && prometheus_count == 1 && redis_count == 1 && traefik_dynamic_count == 1 && traefik_count == 1)) || fail 'release archive must contain one core, one Warden, and all reviewed stack and collector assets'
}

validate_core_release() {
  local release_path="$1" target_path
  for target_path in \
    "$release_path/swarmops-core" \
    "$release_path/swarmops-warden" \
    "$release_path/assets/alertmanager.yml" \
    "$release_path/assets/agent.yml" \
    "$release_path/assets/fluentd-aggregator.conf" \
    "$release_path/assets/fluentd-forwarder.conf" \
    "$release_path/assets/jaeger.yml" \
    "$release_path/assets/logs.yml" \
    "$release_path/assets/mongo.yml" \
    "$release_path/assets/observability.yml" \
    "$release_path/assets/postgres.yml" \
    "$release_path/assets/prometheus-alerts.yml" \
    "$release_path/assets/prometheus.yml" \
    "$release_path/assets/redis.yml" \
    "$release_path/assets/traefik-dynamic.yml" \
    "$release_path/assets/traefik.yml"; do
    [[ -f "$target_path" && ! -L "$target_path" ]] || fail "release is missing a regular file: $target_path"
  done
  [[ -x "$release_path/swarmops-core" && -x "$release_path/swarmops-warden" ]] || fail 'release binaries are not executable'
}

download_core_release() {
  local asset_name checksums_url bundle_url expected_checksum actual_checksum
  asset_name="swarmops-core_${release_version}_linux_${release_arch}.tar.gz"
  checksums_url="https://github.com/$github_repository/releases/download/$release_version/checksums.txt"
  bundle_url="https://github.com/$github_repository/releases/download/$release_version/$asset_name"
  download_dir="$(mktemp -d "$release_dir/.download.XXXXXX")"
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output "$download_dir/checksums.txt" "$checksums_url" || fail 'download release checksums'
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output "$download_dir/$asset_name" "$bundle_url" || fail 'download release bundle'
  expected_checksum="$(awk -v asset="$asset_name" '$2 == asset || $2 == "*" asset {print $1; exit}' "$download_dir/checksums.txt")"
  [[ "$expected_checksum" =~ ^[A-Fa-f0-9]{64}$ ]] || fail 'release checksums do not contain this bundle'
  actual_checksum="$(checksum_for_file "$download_dir/$asset_name")" || fail 'calculate release checksum'
  [[ "$actual_checksum" == "$expected_checksum" ]] || fail 'release bundle checksum does not match checksums.txt'
  verify_core_bundle_layout "$download_dir/$asset_name"
  temporary_release="$(mktemp -d "$release_dir/.stage-${release_version}.XXXXXX")"
  tar -xzf "$download_dir/$asset_name" -C "$temporary_release" || fail 'extract release bundle'
  chmod 0755 "$temporary_release" "$temporary_release/assets" "$temporary_release/swarmops-core" "$temporary_release/swarmops-warden"
  chmod 0444 "$temporary_release/assets/alertmanager.yml" "$temporary_release/assets/agent.yml" "$temporary_release/assets/fluentd-aggregator.conf" "$temporary_release/assets/fluentd-forwarder.conf" "$temporary_release/assets/jaeger.yml" "$temporary_release/assets/logs.yml" "$temporary_release/assets/mongo.yml" "$temporary_release/assets/observability.yml" "$temporary_release/assets/postgres.yml" "$temporary_release/assets/prometheus-alerts.yml" "$temporary_release/assets/prometheus.yml" "$temporary_release/assets/redis.yml" "$temporary_release/assets/traefik-dynamic.yml" "$temporary_release/assets/traefik.yml"
  validate_core_release "$temporary_release"
  rm -rf "$download_dir"
  download_dir=''
}

install_core_release() {
  local destination="$release_dir/$release_version"
  if [[ -e "$destination" ]]; then
    validate_core_release "$destination"
    return
  fi
  download_core_release
  if ! mv "$temporary_release" "$destination"; then
    rm -rf "$temporary_release"
    fail 'place downloaded release'
  fi
  temporary_release=''
}

set_current_release() {
  local temporary_link="$release_dir/.current-next"
  rm -f "$temporary_link"
  ln -s "$release_version" "$temporary_link"
  case "$os_name" in
    Linux) mv -Tf "$temporary_link" "$release_dir/current" ;;
    Darwin) mv -fh "$temporary_link" "$release_dir/current" ;;
    *) fail "unsupported operating system: $os_name" ;;
  esac
}

install_command_shim() {
  install -d -o root -g root -m 0755 /usr/local/bin
  ln -sfn "$release_dir/current/swarmops-core" /usr/local/bin/swarmops-core
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

validate_allowed_cidr() {
  local cidr="$1" address prefix maximum
  [[ "$cidr" == */* ]] || fail '--allow-cidr must include an IPv4 or IPv6 prefix length'
  address="${cidr%/*}"
  prefix="${cidr##*/}"
  [[ "$prefix" =~ ^[0-9]+$ ]] || fail '--allow-cidr prefix length must be numeric'
  if [[ "$address" == *:* ]]; then
    maximum=128
  else
    maximum=32
  fi
  ((prefix >= 0 && prefix <= maximum)) || fail '--allow-cidr prefix length is outside the valid range'
  if [[ "$address" == 0.0.0.0 && "$prefix" != 0 ]]; then
    fail '0.0.0.0/32 permits only the unspecified address; use 0.0.0.0/0 for every IPv4 client'
  fi
  if [[ "$address" == :: && "$prefix" != 0 ]]; then
    fail '::/128 permits only the unspecified address; use ::/0 for every IPv6 client'
  fi
  ip route get "$address" >/dev/null 2>&1 || fail '--allow-cidr must contain a valid IPv4 or IPv6 address'
}

validate_allowed_cidrs() {
  local cidr
  local cidrs=()
  IFS=',' read -r -a cidrs <<<"$operator_cidrs"
  for cidr in "${cidrs[@]}"; do
    validate_allowed_cidr "$cidr"
  done
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
  if [[ "$generate_admin_password" == true ]]; then
    generated_admin_password="$(openssl rand -hex 32)" || fail 'generate initial administrator password'
    [[ "$generated_admin_password" =~ ^[[:xdigit:]]{64}$ ]] || fail 'generated administrator password is invalid'
    admin_password="$generated_admin_password"
  else
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
  fi
  password_hash="$(printf '%s' "$admin_password" | "$release_dir/current/swarmops-core" password-hash)" || fail 'hash administrator password'
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
    listen_address="[::]:$port"
    local_cidrs="$listen_ip/128,::1/128"
  else
    listen_address="0.0.0.0:$port"
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
      "SWARMOPS_ASSET_DIR=$release_dir/current/assets" \
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
      "ExecStart=$release_dir/current/swarmops-core" \
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

local_health_url() {
  local port="$1"
  if [[ "$listen_ip" == *:* ]]; then
    printf 'https://[::1]:%s/readyz\n' "$port"
  else
    printf 'https://127.0.0.1:%s/readyz\n' "$port"
  fi
}

write_warden_service() {
  local port="$1" health_url temporary
  health_url="$(local_health_url "$port")"
  temporary="$(mktemp "$config_dir/.warden.env.XXXXXX")"
  {
    printf '%s\n' \
      "SWARMOPS_WARDEN_REPOSITORY=$github_repository" \
      'SWARMOPS_WARDEN_COMPONENT=core' \
      "SWARMOPS_WARDEN_RELEASE_DIR=$release_dir" \
      "SWARMOPS_WARDEN_HEALTH_URL=$health_url" \
      "SWARMOPS_WARDEN_SERVICE=$service_name" \
      'SWARMOPS_WARDEN_HEALTH_TIMEOUT=45s' \
      'SWARMOPS_WARDEN_HEALTH_INTERVAL=1s'
  } >"$temporary"
  install -o root -g root -m 0600 "$temporary" "$config_dir/warden.env"
  rm -f -- "$temporary"

  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps Warden core release updater' \
      'Wants=network-online.target' \
      'After=network-online.target' \
      '' \
      '[Service]' \
      'Type=oneshot' \
      "EnvironmentFile=$config_dir/warden.env" \
      "ExecStart=$release_dir/current/swarmops-warden update" \
      'NoNewPrivileges=yes' \
      'PrivateTmp=yes' \
      'ProtectHome=yes' \
      'ProtectSystem=full' \
      "ReadWritePaths=$release_dir" \
      'UMask=0077'
  } | install -o root -g root -m 0644 /dev/stdin "/etc/systemd/system/$warden_service_name"

  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Check for a SwarmOps Core release every 12 hours' \
      '' \
      '[Timer]' \
      'OnBootSec=15m' \
      'OnUnitActiveSec=12h' \
      'Persistent=true' \
      "Unit=$warden_service_name" \
      '' \
      '[Install]' \
      'WantedBy=timers.target'
  } | install -o root -g root -m 0644 /dev/stdin "/etc/systemd/system/$warden_timer_name"
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

wait_for_health() {
  local port="$1" health_url attempt
  health_url="$(local_health_url "$port")"
  for attempt in $(seq 1 15); do
    if curl --fail --silent --show-error --insecure --connect-timeout 2 --max-time 4 "$health_url" >/dev/null; then
      return 0
    fi
    sleep 1
  done
  fail 'the control-plane service did not pass its localhost readiness check'
}

if [[ "$#" -eq 0 ]]; then
  automatic_setup=true
  install_dependencies=true
  generate_admin_password=true
fi

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
    --release)
      [[ "$#" -ge 2 ]] || fail '--release requires a value'
      release_version="$2"
      shift 2
      ;;
    --github-repository)
      [[ "$#" -ge 2 ]] || fail '--github-repository requires a value'
      github_repository="$2"
      shift 2
      ;;
    --generate-admin-password)
      generate_admin_password=true
      shift
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

bootstrap_phase='validating controller settings'
info 'Starting the SwarmOps Core installation; validating controller settings.'
require_root
validate_repository
validate_release
if [[ "$install_dependencies" == true ]]; then
  bootstrap_phase='installing required controller dependencies'
  info 'Installing required controller dependencies.'
  install_host_dependencies
fi
bootstrap_phase='checking the controller host'
require_command curl
require_command ip
require_command od
require_command openssl
require_command ss
require_command systemctl
require_command tar
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || fail 'sha256sum or shasum is required'
if [[ "$automatic_setup" == true ]]; then
  bootstrap_phase='confirming controller network access'
  info 'Confirming the controller IP and trusted operator network.'
  configure_automatic_network
fi
[[ -n "$listen_ip" ]] || fail '--listen-ip is required'
[[ -n "$operator_cidrs" ]] || fail 'at least one --allow-cidr is required'
assert_local_ip "$listen_ip"
validate_allowed_cidrs
assert_fresh_controller

bootstrap_phase='preparing protected controller directories'
info 'Preparing protected controller directories.'
if ! id -u "$service_user" >/dev/null 2>&1; then
  useradd --system --user-group --home-dir /nonexistent --shell /usr/sbin/nologin "$service_user"
fi
id -nG "$service_user" | tr ' ' '\n' | grep -Fqx docker && fail 'the SwarmOps service account must not belong to the docker group'

port="$(random_port)" || fail 'could not choose a free random TCP port'
install -d -o "$service_user" -g "$service_user" -m 0700 "$state_dir"
install -d -o root -g "$service_user" -m 0750 "$runtime_dir"
install -d -o root -g root -m 0755 "$release_dir"
install -d -o root -g "$service_user" -m 0750 "$config_dir"
release_platform
resolve_release_version
bootstrap_phase='downloading the verified Core release'
info "Downloading checksum-verified Core release $release_version for Linux/$release_arch."
install_core_release
set_current_release
install_command_shim
bootstrap_phase='configuring Core and its local updater'
info 'Configuring the restricted Core service and local release updater.'
write_admin_password_hash
write_random_secret "$config_dir/session-key" 48
write_random_secret "$config_dir/data-encryption-key" 32
write_tls_material
write_environment_file "$port"
write_systemd_service
write_warden_service "$port"
systemctl daemon-reload
systemctl enable --now "$service_name"
systemctl enable --now "$warden_timer_name"
bootstrap_phase='waiting for Core readiness'
info 'Waiting for the local Core readiness check.'
wait_for_service
wait_for_health "$port"

certificate_fingerprint="$(openssl x509 -in "$config_dir/tls.crt" -noout -fingerprint -sha256 | sed 's/^sha256 Fingerprint=//')"
printf '\n%s\n' 'SwarmOps control plane is ready.'
printf 'URL: https://%s:%s\n' "$listen_ip" "$port"
printf 'TLS SHA-256 fingerprint: %s\n' "$certificate_fingerprint"
printf 'Allowed client networks: %s\n' "$operator_cidrs"
printf '%s\n' 'Verify this fingerprint over your server console before trusting the self-signed certificate in a browser.'
printf '%s\n' 'The controller has no Docker socket access; mutations and builds remain disabled until you explicitly enable them.'
printf '%s\n' 'SwarmOps Warden checks published GitHub releases every 12 hours, health-checks locally, rolls back failures, and retains three known-good releases.'
printf '%s\n' 'Change operator access later with: sudo swarmops-core access set-cidrs <CIDR> [CIDR...]'
if [[ "$generate_admin_password" == true ]]; then
  printf '\n%s\n' 'Initial administrator credentials (shown once):'
  printf '%s\n' 'Username: operator'
  printf 'Password: %s\n' "$generated_admin_password"
  printf '%s\n' 'Store this password in a password manager now. Only its bcrypt hash is retained on the host.'
  generated_admin_password=""
fi
