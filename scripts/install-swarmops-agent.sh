#!/usr/bin/env bash
set -euo pipefail
umask 077

# Install a native SwarmOps machine agent from a published GitHub Release. The
# host never clones or compiles source. Its two native executables are the
# fixed-operation agent and SwarmOps Warden, the local rollback-safe updater.

github_repository='nimasrn/SwarmOps'
release_version='latest'
listen_addr='0.0.0.0:9180'
tls_cert_file=''
tls_key_file=''
managed_tls_material=false
api_key_file=''
docker_socket=''
install_dependencies=false
os_name="$(uname -s)"

usage() {
  printf '%s\n' \
    'Usage:' \
    '  Linux:' \
    '    curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash' \
    '  macOS:' \
    '    curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | bash' \
    '' \
    'The zero-argument installer selects the host platform, installs required' \
    'Ubuntu/Debian packages, generates the local TLS identity and API key, and' \
    'starts the native service. Existing installations are upgraded in place.' \
    '' \
    'Advanced use: download the script and pass any options below.' \
    '' \
    'Downloads a checksum-verified GitHub Release bundle containing the native' \
    'SwarmOps agent and SwarmOps Warden updater. Warden checks for published' \
    'updates every 12 hours, validates localhost health, rolls back failures,' \
    'and keeps the current plus two prior known-good releases.' \
    '' \
    '--listen-addr <host:port>          Listener (default: 0.0.0.0:9180).' \
    '--tls-cert-file <path>             Optional non-symlink PEM certificate; pair with --tls-key-file.' \
    '--tls-key-file <path>              Optional owner-only PEM key; pair with --tls-cert-file.' \
    '--api-key-file <path>              Copy this protected key file; otherwise generate one.' \
    '--docker-socket <path>             Docker Unix socket; defaults by platform and may be unavailable at install time.' \
    '--release <tag|latest>             GitHub release tag, or latest (default: latest).' \
    '--github-repository <owner/name>   Release repository (default: nimasrn/SwarmOps).' \
    '--install-dependencies             Install curl, CA certificates, and OpenSSL where supported.' \
    '                                   The listener must include loopback or all interfaces so Warden can health-check it locally.' \
    '-h, --help                         Show this help.'
}

info() {
  printf 'SwarmOps machine-agent install: %s\n' "$*" >&2
}

fail() {
  printf 'SwarmOps machine-agent install: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 is required"
}

value_is_safe() {
  local value="$1" character
  while [[ -n "$value" ]]; do
    character="${value:0:1}"
    case "$character" in
      [[:alnum:]_./:]|'['|']'|-) ;;
      *) return 1 ;;
    esac
    value="${value:1}"
  done
  return 0
}

require_safe_value() {
  local label="$1" value="$2"
  [[ -n "$value" ]] || fail "$label is required"
  value_is_safe "$value" || fail "$label may contain only letters, numbers, _, ., /, :, [, ], and -"
}

require_regular_file() {
  local label="$1" target_path="$2"
  [[ "$target_path" == /* && "$target_path" != / ]] || fail "$label must be an absolute, non-root path"
  [[ -f "$target_path" && ! -L "$target_path" && -s "$target_path" && -r "$target_path" ]] || fail "$label must be a readable, non-empty regular file"
}

mode_of() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || return 1
}

require_protected_file() {
  local label="$1" target_path="$2" mode
  require_regular_file "$label" "$target_path"
  mode="$(mode_of "$target_path")" || fail "cannot read permissions for $label"
  case "$mode" in
    400|600) ;;
    *) fail "$label must use mode 0400 or 0600" ;;
  esac
}

require_api_key_file() {
  local target_path="$1" length
  require_protected_file '--api-key-file' "$target_path"
  length="$(LC_ALL=C tr -d '[:space:]' <"$target_path" | wc -c | tr -d '[:space:]')"
  [[ "$length" =~ ^[0-9]+$ ]] && ((length >= 16)) || fail '--api-key-file must contain at least 16 non-whitespace bytes'
}

validate_listener() {
  local value="$1" port host
  require_safe_value '--listen-addr' "$value"
  [[ "$value" == *:* ]] || fail '--listen-addr must be a host:port address'
  port="${value##*:}"
  [[ "$port" =~ ^[0-9]{1,5}$ ]] || fail '--listen-addr must end with a TCP port'
  ((10#$port > 0 && 10#$port < 65536)) || fail '--listen-addr port must be between 1 and 65535'
  host="${value%:*}"
  case "$host" in
    ''|0.0.0.0|localhost|127.*|'[::]'|'[::1]') ;;
    *) fail '--listen-addr must bind all interfaces or loopback so Warden can use a localhost health check' ;;
  esac
}

validate_repository() {
  [[ "$github_repository" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || fail '--github-repository must be owner/name'
}

validate_release() {
  [[ "$release_version" == latest || "$release_version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail '--release must be latest or a safe release tag'
}

default_docker_socket() {
  case "$os_name" in
    Linux) printf '%s\n' '/var/run/docker.sock' ;;
    Darwin) printf '%s\n' "$HOME/.docker/run/docker.sock" ;;
    *) fail "unsupported operating system: $os_name" ;;
  esac
}

install_host_dependencies() {
  case "$os_name" in
    Linux)
      [[ -f /etc/debian_version ]] || fail '--install-dependencies supports Debian and Ubuntu Linux only'
      export DEBIAN_FRONTEND=noninteractive
      apt-get update </dev/null
      apt-get install --yes --no-install-recommends ca-certificates curl openssl </dev/null
      ;;
    Darwin)
      require_command brew
      brew install curl openssl
      ;;
    *) fail "unsupported operating system: $os_name" ;;
  esac
}

set_paths() {
  case "$os_name" in
    Linux)
      config_dir='/etc/swarmops-agent'
      runtime_dir='/usr/local/lib/swarmops-agent'
      service_file='/etc/systemd/system/swarmops-agent.service'
      warden_service_file='/etc/systemd/system/swarmops-agent-warden.service'
      warden_timer_file='/etc/systemd/system/swarmops-agent-warden.timer'
      ;;
    Darwin)
      config_dir="$HOME/.config/swarmops-agent"
      runtime_dir="$HOME/.local/lib/swarmops-agent"
      service_file="$HOME/Library/LaunchAgents/com.nimasrn.swarmops-agent.plist"
      warden_service_file="$HOME/Library/LaunchAgents/com.nimasrn.swarmops-warden.plist"
      warden_timer_file=''
      ;;
    *) fail "unsupported operating system: $os_name" ;;
  esac
  release_dir="$runtime_dir/releases"
  agent_path='/opt/homebrew/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:/snap/bin'
  tls_dir="$config_dir/tls"
  api_key_destination="$config_dir/api-key"
  environment_file="$config_dir/agent.env"
  warden_environment_file="$config_dir/warden.env"
  launcher_file="$runtime_dir/run-agent.sh"
  warden_launcher_file="$runtime_dir/run-warden.sh"
}

select_tls_material() {
  if [[ -z "$tls_cert_file" && -z "$tls_key_file" ]]; then
    tls_cert_file="$tls_dir/agent.crt"
    tls_key_file="$tls_dir/agent.key"
    managed_tls_material=true
  else
    [[ -n "$tls_cert_file" && -n "$tls_key_file" ]] || fail '--tls-cert-file and --tls-key-file must be supplied together'
  fi

  require_safe_value '--tls-cert-file' "$tls_cert_file"
  require_safe_value '--tls-key-file' "$tls_key_file"
  if [[ "$os_name" == Linux ]]; then
    for tls_path in "$tls_cert_file" "$tls_key_file"; do
      case "$tls_path" in
        /home/*|/root/*|/run/user/*) fail 'Linux TLS files must stay outside /home, /root, and /run/user because the systemd service protects home directories' ;;
      esac
    done
  fi
  if [[ "$managed_tls_material" == false ]]; then
    require_regular_file '--tls-cert-file' "$tls_cert_file"
    require_protected_file '--tls-key-file' "$tls_key_file"
  fi
}

install_managed_tls_material() {
  local temporary_key temporary_certificate temporary_config
  [[ "$managed_tls_material" == true ]] || return

  install -d -m 0700 "$tls_dir"
  if [[ -L "$tls_cert_file" || -L "$tls_key_file" ]]; then
    fail 'SwarmOps-managed TLS files must not be symlinks'
  fi
  if [[ -e "$tls_cert_file" || -e "$tls_key_file" ]]; then
    if [[ -f "$tls_cert_file" && -f "$tls_key_file" ]]; then
      require_regular_file 'SwarmOps-managed TLS certificate' "$tls_cert_file"
      require_protected_file 'SwarmOps-managed TLS private key' "$tls_key_file"
      openssl x509 -in "$tls_cert_file" -noout -checkend 0 >/dev/null || fail 'existing SwarmOps-managed TLS certificate is invalid or expired'
      return
    fi
    fail 'SwarmOps-managed TLS material is incomplete; remove both files only after disconnecting this machine from SwarmOps'
  fi

  temporary_key="$(mktemp "$tls_dir/.agent-key.XXXXXX")"
  temporary_certificate="$(mktemp "$tls_dir/.agent-cert.XXXXXX")"
  temporary_config="$(mktemp "$tls_dir/.agent-openssl.XXXXXX")"
  {
    printf '%s\n' \
      '[req]' \
      'distinguished_name = subject' \
      'x509_extensions = server_extensions' \
      'prompt = no' \
      '[subject]' \
      'CN = swarmops-agent' \
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
    rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
    fail 'generate SwarmOps TLS private key'
  fi
  if ! openssl req -new -x509 -sha256 -days 397 -key "$temporary_key" -out "$temporary_certificate" \
    -config "$temporary_config" -extensions server_extensions; then
    rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
    fail 'generate SwarmOps TLS certificate'
  fi
  if ! openssl x509 -in "$temporary_certificate" -noout -checkend 0 >/dev/null; then
    rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
    fail 'validate generated SwarmOps TLS certificate'
  fi
  if ! install -m 0600 "$temporary_key" "$tls_key_file"; then
    rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
    fail 'install SwarmOps TLS private key'
  fi
  if ! install -m 0644 "$temporary_certificate" "$tls_cert_file"; then
    rm -f -- "$tls_key_file" "$temporary_key" "$temporary_certificate" "$temporary_config"
    fail 'install SwarmOps TLS certificate'
  fi
  rm -f -- "$temporary_key" "$temporary_certificate" "$temporary_config"
}

release_platform() {
  case "$os_name" in
    Linux) release_os='linux' ;;
    Darwin) release_os='darwin' ;;
  esac
  case "$(uname -m)" in
    x86_64|amd64) release_arch='amd64' ;;
    arm64|aarch64) release_arch='arm64' ;;
    *) fail "unsupported CPU architecture: $(uname -m)" ;;
  esac
}

resolve_release_version() {
  [[ "$release_version" == latest ]] || return
  local resolved_url
  resolved_url="$(curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output /dev/null --write-out '%{url_effective}' "https://github.com/$github_repository/releases/latest")" || fail 'resolve latest GitHub release'
  case "$resolved_url" in
    "https://github.com/$github_repository/releases/tag/"*) release_version="${resolved_url##*/}" ;;
    *) fail 'latest GitHub release did not resolve to the requested repository' ;;
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

verify_bundle_layout() {
  local archive_path="$1" entry agent_count=0 warden_count=0
  while IFS= read -r entry; do
    case "$entry" in
      swarmops-agent) agent_count=$((agent_count + 1)) ;;
      swarmops-warden) warden_count=$((warden_count + 1)) ;;
      *) fail "release archive contains unsupported entry: $entry" ;;
    esac
  done < <(tar -tzf "$archive_path")
  ((agent_count == 1 && warden_count == 1)) || fail 'release archive must contain one agent and one Warden binary'
}

validate_installed_release() {
  local release_path="$1" executable
  for executable in swarmops-agent swarmops-warden; do
    [[ -f "$release_path/$executable" && ! -L "$release_path/$executable" && -x "$release_path/$executable" ]] || fail "release is missing a regular executable: $executable"
  done
}

download_release_bundle() {
  local asset_name checksums_url bundle_url expected_checksum actual_checksum
  asset_name="swarmops-agent_${release_version}_${release_os}_${release_arch}.tar.gz"
  checksums_url="https://github.com/$github_repository/releases/download/$release_version/checksums.txt"
  bundle_url="https://github.com/$github_repository/releases/download/$release_version/$asset_name"
  download_dir="$(mktemp -d "$release_dir/.download.XXXXXX")"
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output "$download_dir/checksums.txt" "$checksums_url" || fail 'download release checksums'
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --output "$download_dir/$asset_name" "$bundle_url" || fail 'download release bundle'
  expected_checksum="$(awk -v asset="$asset_name" '$2 == asset || $2 == "*" asset {print $1; exit}' "$download_dir/checksums.txt")"
  [[ "$expected_checksum" =~ ^[A-Fa-f0-9]{64}$ ]] || fail 'release checksums do not contain this bundle'
  actual_checksum="$(checksum_for_file "$download_dir/$asset_name")" || fail 'calculate release checksum'
  [[ "$actual_checksum" == "$expected_checksum" ]] || fail 'release bundle checksum does not match checksums.txt'
  verify_bundle_layout "$download_dir/$asset_name"
  temporary_release="$(mktemp -d "$release_dir/.stage-${release_version}.XXXXXX")"
  tar -xzf "$download_dir/$asset_name" -C "$temporary_release" || fail 'extract release bundle'
  chmod 0755 "$temporary_release/swarmops-agent" "$temporary_release/swarmops-warden"
  validate_installed_release "$temporary_release"
  rm -rf "$download_dir"
  download_dir=''
}

install_release() {
  local destination
  destination="$release_dir/$release_version"
  if [[ -e "$destination" ]]; then
    validate_installed_release "$destination"
    return
  fi
  download_release_bundle
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

install_api_key() {
  local temporary_key
  install -d -m 0700 "$config_dir"
  if [[ -n "$api_key_file" ]]; then
    require_api_key_file "$api_key_file"
    install -m 0600 "$api_key_file" "$api_key_destination"
    return
  fi
  temporary_key="$(mktemp "$config_dir/.api-key.XXXXXX")"
  if ! openssl rand -base64 32 >"$temporary_key"; then
    rm -f "$temporary_key"
    fail 'generate machine API key'
  fi
  install -m 0600 "$temporary_key" "$api_key_destination"
  rm -f "$temporary_key"
}

install_command_shim() {
  local command_directory command_path
  case "$os_name" in
    Linux)
      command_directory='/usr/local/bin'
      ;;
    Darwin)
      if [[ -d /opt/homebrew/bin && -w /opt/homebrew/bin ]]; then
        command_directory='/opt/homebrew/bin'
      elif [[ -d /usr/local/bin && -w /usr/local/bin ]]; then
        command_directory='/usr/local/bin'
      else
        command_directory="$HOME/.local/bin"
      fi
      ;;
  esac
  install -d -m 0755 "$command_directory"
  command_path="$command_directory/swarmops-agent"
  ln -sfn "$release_dir/current/swarmops-agent" "$command_path"
  if [[ "$os_name" == Darwin && ":$PATH:" != *":$command_directory:"* ]]; then
    printf 'SwarmOps machine-agent install: add %s to PATH to use swarmops-agent directly.\n' "$command_directory" >&2
  fi
}

local_health_url() {
  local port="${listen_addr##*:}" host="${listen_addr%:*}"
  case "$host" in
    localhost|127.*) printf 'https://%s:%s/healthz\n' "$host" "$port" ;;
    '[::]'|'[::1]') printf 'https://[::1]:%s/healthz\n' "$port" ;;
    *) printf 'https://127.0.0.1:%s/healthz\n' "$port" ;;
  esac
}

write_environment_file() {
  local temporary_environment
  temporary_environment="$(mktemp "$config_dir/.agent.env.XXXXXX")"
  {
    printf '%s\n' \
      "SWARMOPS_AGENT_TOKEN_FILE=$api_key_destination" \
      "SWARMOPS_AGENT_TLS_CERT_FILE=$tls_cert_file" \
      "SWARMOPS_AGENT_TLS_KEY_FILE=$tls_key_file" \
      "SWARMOPS_AGENT_LISTEN_ADDR=$listen_addr" \
      "SWARMOPS_DOCKER_SOCKET=$docker_socket" \
      "PATH=$agent_path" \
      'SWARMOPS_HOST_ROOT=/' \
      'SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED=true' \
      'SWARMOPS_AGENT_BUILD_ENABLED=false'
    if [[ "$os_name" == Linux ]]; then
      printf '%s\n' 'SWARMOPS_HOST_OS=/etc/os-release' 'SWARMOPS_HOST_PROC=/proc'
    fi
  } >"$temporary_environment"
  install -m 0600 "$temporary_environment" "$environment_file"
  rm -f "$temporary_environment"
}

write_warden_environment_file() {
  local temporary_environment health_url warden_service
  health_url="$(local_health_url)"
  case "$os_name" in
    Linux) warden_service='swarmops-agent.service' ;;
    Darwin) warden_service='com.nimasrn.swarmops-agent' ;;
  esac
  temporary_environment="$(mktemp "$config_dir/.warden.env.XXXXXX")"
  {
    printf '%s\n' \
      "SWARMOPS_WARDEN_REPOSITORY=$github_repository" \
      'SWARMOPS_WARDEN_COMPONENT=agent' \
      "SWARMOPS_WARDEN_RELEASE_DIR=$release_dir" \
      "SWARMOPS_WARDEN_HEALTH_URL=$health_url" \
      "SWARMOPS_WARDEN_SERVICE=$warden_service" \
      'SWARMOPS_WARDEN_HEALTH_TIMEOUT=45s' \
      'SWARMOPS_WARDEN_HEALTH_INTERVAL=1s'
    if [[ "$os_name" == Darwin ]]; then
      printf '%s\n' "SWARMOPS_WARDEN_SERVICE_PLIST=$service_file"
    fi
  } >"$temporary_environment"
  install -m 0600 "$temporary_environment" "$warden_environment_file"
  rm -f "$temporary_environment"
}

unit_has_namespace_error() {
  local unit status_code
  unit="$1"
  status_code="$(systemctl show "$unit" --property=ExecMainStatus --value 2>/dev/null | tr -d '[:space:]')"
  [[ "$status_code" == '226' ]]
}

write_namespace_compatibility_override() {
  local unit dropin_directory override_file
  unit="$1"
  dropin_directory="/etc/systemd/system/${unit}.d"
  override_file="$dropin_directory/99-swarmops-namespace-compat.conf"
  install -d -m 0755 "$dropin_directory"
  {
    printf '%s\n' '[Service]' 'RestrictNamespaces=no'
  } | install -m 0644 /dev/stdin "$override_file"
}

start_systemd_service_with_fallback() {
  local unit failure_message
  unit="$1"
  failure_message="$2"
  systemctl restart "$unit" >/dev/null 2>&1 || true
  if systemctl is-active --quiet "$unit"; then
    return
  fi
  if unit_has_namespace_error "$unit"; then
    write_namespace_compatibility_override "$unit"
    systemctl daemon-reload
    systemctl restart "$unit" >/dev/null 2>&1 || true
    if systemctl is-active --quiet "$unit"; then
      printf 'SwarmOps machine-agent install: %s does not support strict namespace restrictions; installed a narrow compatibility override.\n' "$unit" >&2
      return
    fi
  fi
  systemctl status --no-pager "$unit" >&2 || true
  fail "$failure_message"
}

restart_existing_native_install() {
  case "$os_name" in
    Linux)
      systemctl daemon-reload
      start_systemd_service_with_fallback "$(basename "$service_file")" 'machine agent service did not become active'
      systemctl start "$(basename "$warden_service_file")"
      ;;
    Darwin)
      local uid
      uid="$(id -u)"
      launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-agent"
      launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-warden"
      ;;
  esac
}

write_linux_services() {
  local temporary_agent temporary_warden temporary_timer
  temporary_agent="$(mktemp '/etc/systemd/system/.swarmops-agent.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' 'Description=SwarmOps pinned machine API agent' 'Wants=network-online.target' 'After=network-online.target' '' \
      '[Service]' 'Type=simple' "EnvironmentFile=$environment_file" "ExecStart=$release_dir/current/swarmops-agent" \
      'Restart=on-failure' 'RestartSec=5s' 'NoNewPrivileges=yes' 'PrivateTmp=yes' 'PrivateDevices=yes' \
      'ProtectSystem=full' 'ProtectHome=yes' 'ProtectKernelTunables=yes' 'ProtectKernelModules=yes' 'ProtectKernelLogs=yes' \
      'ProtectControlGroups=yes' 'ProtectClock=yes' 'ProtectHostname=yes' 'LockPersonality=yes' 'RestrictNamespaces=yes' \
      'RestrictRealtime=yes' 'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' 'SystemCallArchitectures=native' \
      'CapabilityBoundingSet=' 'AmbientCapabilities=' 'UMask=0077' '' '[Install]' 'WantedBy=multi-user.target'
  } >"$temporary_agent"
  install -m 0644 "$temporary_agent" "$service_file"
  rm -f "$temporary_agent"

  temporary_warden="$(mktemp '/etc/systemd/system/.swarmops-warden.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' 'Description=SwarmOps Warden native release updater' 'Wants=network-online.target' 'After=network-online.target' '' \
      '[Service]' 'Type=oneshot' "EnvironmentFile=$warden_environment_file" "ExecStart=$release_dir/current/swarmops-warden update" \
      'NoNewPrivileges=yes' 'PrivateTmp=yes' 'ProtectHome=yes' 'ProtectSystem=full' "ReadWritePaths=$release_dir" 'UMask=0077'
  } >"$temporary_warden"
  install -m 0644 "$temporary_warden" "$warden_service_file"
  rm -f "$temporary_warden"

  temporary_timer="$(mktemp '/etc/systemd/system/.swarmops-warden-timer.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' 'Description=Check for a SwarmOps native release every 12 hours' '' \
      '[Timer]' 'OnBootSec=15m' 'OnUnitActiveSec=12h' 'Persistent=true' 'Unit=swarmops-agent-warden.service' '' \
      '[Install]' 'WantedBy=timers.target'
  } >"$temporary_timer"
  install -m 0644 "$temporary_timer" "$warden_timer_file"
  rm -f "$temporary_timer"

  systemctl daemon-reload
  systemctl enable "$(basename "$service_file")"
  systemctl enable --now "$(basename "$warden_timer_file")"
  start_systemd_service_with_fallback "$(basename "$service_file")" 'machine agent service did not become active'
}

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

write_macos_services() {
  local temporary_launcher temporary_warden_launcher temporary_agent temporary_warden uid
  install -d -m 0700 "$HOME/Library/LaunchAgents"
  temporary_launcher="$(mktemp "$runtime_dir/.run-agent.XXXXXX")"
  {
    printf '%s\n' '#!/bin/sh' 'set -eu' 'set -a'
    printf '. %s\n' "'$(printf '%s' "$environment_file" | sed "s/'/'\\''/g")'"
    printf '%s\n' 'set +a'
    printf 'exec %s\n' "'$(printf '%s' "$release_dir/current/swarmops-agent" | sed "s/'/'\\''/g")'"
  } >"$temporary_launcher"
  install -m 0700 "$temporary_launcher" "$launcher_file"
  rm -f "$temporary_launcher"

  temporary_warden_launcher="$(mktemp "$runtime_dir/.run-warden.XXXXXX")"
  {
    printf '%s\n' '#!/bin/sh' 'set -eu' 'set -a'
    printf '. %s\n' "'$(printf '%s' "$warden_environment_file" | sed "s/'/'\\''/g")'"
    printf '%s\n' 'set +a'
    printf 'exec %s update\n' "'$(printf '%s' "$release_dir/current/swarmops-warden" | sed "s/'/'\\''/g")'"
  } >"$temporary_warden_launcher"
  install -m 0700 "$temporary_warden_launcher" "$warden_launcher_file"
  rm -f "$temporary_warden_launcher"

  temporary_agent="$(mktemp "$HOME/Library/LaunchAgents/.swarmops-agent.XXXXXX")"
  {
    printf '%s\n' \
      '<?xml version="1.0" encoding="UTF-8"?>' \
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
      '<plist version="1.0">' '<dict>' \
      '  <key>Label</key>' '  <string>com.nimasrn.swarmops-agent</string>' \
      '  <key>ProgramArguments</key>' '  <array>' "    <string>$(xml_escape "$launcher_file")</string>" '  </array>' \
      '  <key>RunAtLoad</key>' '  <true/>' '  <key>KeepAlive</key>' '  <true/>' \
      '  <key>ProcessType</key>' '  <string>Background</string>' '</dict>' '</plist>'
  } >"$temporary_agent"
  install -m 0600 "$temporary_agent" "$service_file"
  rm -f "$temporary_agent"

  temporary_warden="$(mktemp "$HOME/Library/LaunchAgents/.swarmops-warden.XXXXXX")"
  {
    printf '%s\n' \
      '<?xml version="1.0" encoding="UTF-8"?>' \
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
      '<plist version="1.0">' '<dict>' \
      '  <key>Label</key>' '  <string>com.nimasrn.swarmops-warden</string>' \
      '  <key>ProgramArguments</key>' '  <array>' "    <string>$(xml_escape "$warden_launcher_file")</string>" '  </array>' \
      '  <key>StartInterval</key>' '  <integer>43200</integer>' \
      '  <key>ProcessType</key>' '  <string>Background</string>' '</dict>' '</plist>'
  } >"$temporary_warden"
  install -m 0600 "$temporary_warden" "$warden_service_file"
  rm -f "$temporary_warden"

  uid="$(id -u)"
  launchctl bootout "gui/$uid/com.nimasrn.swarmops-agent" >/dev/null 2>&1 || true
  launchctl bootout "gui/$uid/com.nimasrn.swarmops-warden" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$uid" "$service_file"
  launchctl bootstrap "gui/$uid" "$warden_service_file"
  launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-agent"
}

check_local_health() {
  local health_url attempts=0
  health_url="$(local_health_url)"
  while ((attempts < 15)); do
    if curl --fail --silent --show-error --insecure --connect-timeout 2 --max-time 4 "$health_url" >/dev/null; then
      return
    fi
    attempts=$((attempts + 1))
    sleep 1
  done
  fail 'machine agent did not pass its localhost health check'
}

certificate_fingerprint() {
  local digest
  digest="$(openssl x509 -in "$tls_cert_file" -outform DER | openssl dgst -sha256 -hex | awk '{print $NF}')" || fail 'compute TLS certificate fingerprint'
  [[ "$digest" =~ ^[A-Fa-f0-9]{64}$ ]] || fail 'compute TLS certificate fingerprint'
  printf 'SHA256:%s\n' "$(printf '%s' "$digest" | tr '[:lower:]' '[:upper:]')"
}

if [[ "$#" -eq 0 ]]; then
  if [[ "$os_name" == Linux ]]; then
    install_dependencies=true
  fi
fi

while [[ "$#" -gt 0 ]]; do
  case "$1" in
    --listen-addr) [[ "$#" -ge 2 ]] || fail '--listen-addr requires a value'; listen_addr="$2"; shift 2 ;;
    --tls-cert-file) [[ "$#" -ge 2 ]] || fail '--tls-cert-file requires a value'; tls_cert_file="$2"; shift 2 ;;
    --tls-key-file) [[ "$#" -ge 2 ]] || fail '--tls-key-file requires a value'; tls_key_file="$2"; shift 2 ;;
    --api-key-file) [[ "$#" -ge 2 ]] || fail '--api-key-file requires a value'; api_key_file="$2"; shift 2 ;;
    --docker-socket) [[ "$#" -ge 2 ]] || fail '--docker-socket requires a value'; docker_socket="$2"; shift 2 ;;
    --release) [[ "$#" -ge 2 ]] || fail '--release requires a value'; release_version="$2"; shift 2 ;;
    --github-repository) [[ "$#" -ge 2 ]] || fail '--github-repository requires a value'; github_repository="$2"; shift 2 ;;
    --install-dependencies) install_dependencies=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) fail "unknown option: $1" ;;
  esac
done

info 'Starting the native SwarmOps Agent installation and checking this host.'
case "$os_name" in
  Linux) [[ "$(id -u)" == 0 ]] || fail 'run this command with sudo on Linux' ;;
  Darwin) [[ "$(id -u)" != 0 ]] || fail 'run this command as the logged-in macOS user, without sudo' ;;
  *) fail "unsupported operating system: $os_name" ;;
esac

set_paths
existing_native_install=false
if [[ -L "$release_dir/current" || -e "$release_dir/current" ]]; then
  existing_native_install=true
fi
validate_repository
validate_release
if [[ "$existing_native_install" == false ]]; then
  validate_listener "$listen_addr"
  select_tls_material
  if [[ -n "$api_key_file" ]]; then
    require_safe_value '--api-key-file' "$api_key_file"
  fi
  if [[ -z "$docker_socket" ]]; then
    docker_socket="$(default_docker_socket)"
  fi
  require_safe_value '--docker-socket' "$docker_socket"
  [[ "$docker_socket" == /* && "$docker_socket" != / ]] || fail '--docker-socket must be an absolute, non-root path'
fi

if [[ "$install_dependencies" == true ]]; then
  info 'Installing required host dependencies.'
  install_host_dependencies
fi
require_command curl
require_command openssl
require_command tar
command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1 || fail 'sha256sum or shasum is required'
if [[ "$os_name" == Linux ]]; then
  require_command systemctl
else
  require_command launchctl
fi

for install_path in "$config_dir" "$tls_dir" "$runtime_dir" "$release_dir" "$service_file" "$warden_service_file"; do
  require_safe_value 'installation path' "$install_path"
done
install -d -m 0755 "$runtime_dir" "$release_dir"
release_platform
resolve_release_version
info "Downloading checksum-verified Agent release $release_version for $release_os/$release_arch."
install_release
set_current_release
install_command_shim
if [[ "$existing_native_install" == true ]]; then
  info 'Restarting the existing Agent with its preserved identity and configuration.'
  restart_existing_native_install
  printf '%s\n' \
    'Upgraded the existing SwarmOps machine agent and preserved its API key, TLS identity, listener, and service configuration.' \
    "Release: $release_version" \
    'Future updates: sudo swarmops-agent upgrade' \
    'Key rotation: sudo swarmops-agent gen key'
  exit 0
fi
info 'Generating the protected Agent identity and service configuration.'
install_api_key
install_managed_tls_material
write_environment_file
write_warden_environment_file
case "$os_name" in
  Linux) write_linux_services ;;
  Darwin) write_macos_services ;;
esac
info 'Waiting for the local Agent health check.'
check_local_health

fingerprint="$(certificate_fingerprint)"
port="${listen_addr##*:}"
printf '%s\n' \
  'Installed the SwarmOps machine agent and SwarmOps Warden.' \
  "Release: $release_version" \
  "Machine API port: $port" \
  "TLS certificate file: $tls_cert_file" \
  "Protected TLS private key file: $tls_key_file" \
  "TLS certificate fingerprint: $fingerprint" \
  "Protected API key file: $api_key_destination" \
  'Warden checks GitHub Releases every 12 hours and rolls back unhealthy updates.' \
  'In SwarmOps, add this machine with its HTTPS URL (without a port), the port above,' \
  'the certificate fingerprint above, and the API key read through your approved secure channel.' \
  'The installer never prints the API key.'
