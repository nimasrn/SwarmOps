#!/usr/bin/env bash
set -euo pipefail
umask 077

# Install a native SwarmOps machine agent from Git. The agent gives an
# authenticated controller a small fixed Docker-operation API; it never opens
# the Docker socket or an arbitrary shell over the network.

repo_url="https://github.com/nimasrn/SwarmOps.git"
branch="main"
listen_addr="0.0.0.0:9180"
tls_cert_file=""
tls_key_file=""
api_key_file=""
docker_socket=""
advertise_host=""
install_dependencies=true
install_docker=false
init_swarm=false
defer_docker=false
automatic_updates=true
os_name="$(uname -s)"
generated_tls=false
trusted_update_repo="https://github.com/nimasrn/SwarmOps.git"
core_url=""
core_fingerprint=""
enrollment_code=""

usage() {
  printf '%s\n' \
	'Usage:' \
	'  Linux:' \
	'    sudo bash install-swarmops-agent.sh --core <https-url> [--enrollment-code <one-time-code>] [options]' \
    '  macOS:' \
    '    bash install-swarmops-agent.sh --listen-addr <host:port> \' \
    '      --tls-cert-file <absolute-path> --tls-key-file <absolute-path> [options]' \
    '' \
    'Clones or fast-forwards the selected Git branch, builds the native machine' \
    'agent, writes a protected API-key file, and installs systemd (Linux) or a' \
    'per-user LaunchAgent (macOS). --install-docker and --init-swarm prepare a' \
    'fresh Debian/Ubuntu host; --defer-docker leaves that plan to the console.' \
    'It never exposes the Docker socket. Linux installs also add a' \
    'private local helper for the console’s fixed server-readiness operations.' \
    '' \
	'--core <https-url>             Core origin for outbound-only HTTPS polling.' \
	'--core-fingerprint <SHA256:…>  Exact Core leaf pin; required for self-signed Core TLS.' \
	'--enrollment-code <code>      Dashboard-generated grant; omit to print a standalone claim code.' \
	'--listen-addr <host:port>      Legacy direct-listener mode only.' \
    '--tls-cert-file <path>         Required non-symlink PEM certificate.' \
    '--tls-key-file <path>          Required owner-only non-symlink PEM key.' \
    '--api-key-file <path>          Copy this protected key file; otherwise generate one.' \
    '--docker-socket <path>         Docker Unix socket; defaults by platform.' \
    '--repo <Git URL>               Standalone repository to clone (default: nimasrn/SwarmOps).' \
    '--branch <name>                Git branch to install (default: main).' \
    '--install-dependencies         Install Git, Go, and OpenSSL where supported.' \
    '--install-docker              Install Docker before enrolling (Debian/Ubuntu only).' \
    '--init-swarm                  Initialize a one-node Docker Swarm after Docker is ready.' \
    '--defer-docker                 Install the agent before Docker; finish Docker/Swarm in Server readiness.' \
    '--no-auto-update               Disable the default trusted-Git agent update timer.' \
    '-h, --help                     Show this help.'
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
}

require_safe_value() {
  local label="$1"
  local value="$2"
  [[ -n "$value" ]] || fail "$label is required"
  value_is_safe "$value" || fail "$label may contain only letters, numbers, _, ., /, :, [, ], and -"
}

require_regular_file() {
  local label="$1"
  local path="$2"
  [[ "$path" == /* && "$path" != "/" ]] || fail "$label must be an absolute, non-root path"
  [[ -f "$path" && ! -L "$path" && -s "$path" && -r "$path" ]] || fail "$label must be a readable, non-empty regular file"
}

mode_of() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null || return 1
}

require_protected_file() {
  local label="$1"
  local path="$2"
  local mode
  require_regular_file "$label" "$path"
  mode="$(mode_of "$path")" || fail "cannot read permissions for $label"
  case "$mode" in
    400|600)
      ;;
    *)
      fail "$label must use mode 0400 or 0600"
      ;;
  esac
}

require_api_key_file() {
  local path="$1"
  local length
  require_protected_file '--api-key-file' "$path"
  length="$(LC_ALL=C tr -d '[:space:]' <"$path" | wc -c | tr -d '[:space:]')"
  [[ "$length" =~ ^[0-9]+$ ]] && ((length >= 16)) || fail '--api-key-file must contain at least 16 non-whitespace bytes'
}

validate_listener() {
  local value="$1"
  local port
  require_safe_value '--listen-addr' "$value"
  [[ "$value" == *:* ]] || fail '--listen-addr must be a host:port address'
  port="${value##*:}"
  [[ "$port" =~ ^[0-9]{1,5}$ ]] || fail '--listen-addr must end with a TCP port'
  ((10#$port > 0 && 10#$port < 65536)) || fail '--listen-addr port must be between 1 and 65535'
}

default_docker_socket() {
  case "$os_name" in
    Linux)
      printf '%s\n' '/var/run/docker.sock'
      ;;
    Darwin)
      printf '%s\n' "$HOME/.docker/run/docker.sock"
      ;;
    *)
      fail "unsupported operating system: $os_name"
      ;;
  esac
}

# install_host_dependencies installs only the build prerequisites that are
# actually missing. It runs by default so a first install is one command, and
# it stays best-effort: on a platform it does not manage it says so and lets
# the explicit require_command checks report what the operator must install.
install_host_dependencies() {
  local missing=()
  command -v git >/dev/null 2>&1 || missing+=('git')
  command -v go >/dev/null 2>&1 || missing+=('go')
  command -v openssl >/dev/null 2>&1 || missing+=('openssl')
  if [[ "${#missing[@]}" -eq 0 ]]; then
    return
  fi
  case "$os_name" in
    Linux)
      if [[ ! -f /etc/debian_version ]] || ! command -v apt-get >/dev/null 2>&1; then
        printf 'SwarmOps machine-agent install: cannot install %s automatically on this distribution\n' "${missing[*]}" >&2
        return
      fi
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install --yes --no-install-recommends ca-certificates git golang-go openssl
      ;;
    Darwin)
      if ! command -v brew >/dev/null 2>&1; then
        printf 'SwarmOps machine-agent install: cannot install %s automatically without Homebrew\n' "${missing[*]}" >&2
        return
      fi
      brew install "${missing[@]}"
      ;;
    *)
      fail "unsupported operating system: $os_name"
      ;;
  esac
}

set_paths() {
  case "$os_name" in
    Linux)
      source_dir='/opt/swarmops-agent/source'
      config_dir='/etc/swarmops-agent'
      runtime_dir='/usr/local/lib/swarmops-agent'
      service_file='/etc/systemd/system/swarmops-agent.service'
      provision_service_file='/etc/systemd/system/swarmops-agent-provisioner.service'
      provision_socket='/run/swarmops-agent/provisioner.sock'
      update_service_file='/etc/systemd/system/swarmops-agent-update.service'
      update_timer_file='/etc/systemd/system/swarmops-agent-update.timer'
      update_path_file='/etc/systemd/system/swarmops-agent-update.path'
      update_busy_file='/run/swarmops-agent/update.busy'
      update_request_file='/run/swarmops-agent/update.request'
      update_status_dir='/var/lib/swarmops-agent'
      ;;
    Darwin)
      source_dir="$HOME/.local/share/swarmops-agent/source"
      config_dir="$HOME/.config/swarmops-agent"
      runtime_dir="$HOME/.local/lib/swarmops-agent"
      service_file="$HOME/Library/LaunchAgents/com.nimasrn.swarmops-agent.plist"
      provision_service_file=''
      provision_socket=''
      update_service_file="$HOME/Library/LaunchAgents/com.nimasrn.swarmops-agent-update.plist"
      update_timer_file=''
      update_path_file=''
      update_busy_file="$runtime_dir/update.busy"
      update_request_file="$runtime_dir/update.request"
      update_status_dir="$config_dir"
      ;;
    *)
      fail "unsupported operating system: $os_name"
      ;;
  esac
  binary_dir="$runtime_dir/bin"
  api_key_destination="$config_dir/api-key"
  enrollment_destination="$config_dir/enrollment-secret"
  environment_file="$config_dir/agent.env"
  launcher_file="$runtime_dir/run-agent.sh"
  update_config_file="$config_dir/update.env"
  update_status_file="$update_status_dir/update-status.json"
  update_script="$runtime_dir/update-agent.sh"
  update_launcher_file="$runtime_dir/run-update.sh"
}

ensure_checkout() {
  if [[ -e "$source_dir" && ! -d "$source_dir/.git" ]]; then
    fail "source path exists but is not this installer's Git checkout: $source_dir"
  fi
  if [[ -d "$source_dir/.git" ]]; then
    [[ -z "$(git -C "$source_dir" status --porcelain)" ]] || fail "source checkout has local changes: $source_dir"
    local existing_remote
    existing_remote="$(git -C "$source_dir" remote get-url origin)" || fail "read Git remote for $source_dir"
    [[ "$existing_remote" == "$repo_url" ]] || fail "source checkout remote does not match --repo: $source_dir"
    git -C "$source_dir" fetch --depth 1 origin "$branch"
    git -C "$source_dir" checkout "$branch"
    git -C "$source_dir" pull --ff-only origin "$branch"
    return
  fi
  install -d -m 0755 "$(dirname "$source_dir")"
  git clone --depth 1 --branch "$branch" --single-branch "$repo_url" "$source_dir"
}

build_agent() {
  local temporary_binary
  [[ -f "$source_dir/go.mod" ]] || fail 'the cloned repository is not the standalone SwarmOps source'
  install -d -m 0755 "$binary_dir"
  temporary_binary="$(mktemp "$binary_dir/.swarmops-agent.XXXXXX")"
  if ! (
    cd "$source_dir"
    CGO_ENABLED=0 go build -trimpath -o "$temporary_binary" ./cmd/agent
  ); then
    rm -f "$temporary_binary"
    fail 'build SwarmOps machine agent'
  fi
  chmod 0755 "$temporary_binary"
  mv -f "$temporary_binary" "$binary_dir/swarmops-agent"
}

install_api_key() {
  local temporary_key
  install -d -m 0700 "$config_dir"
  if [[ -n "$api_key_file" ]]; then
    require_api_key_file "$api_key_file"
    install -m 0600 "$api_key_file" "$api_key_destination"
    return
  fi
  if [[ -f "$api_key_destination" ]]; then
    require_api_key_file "$api_key_destination"
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

write_environment_file() {
  local temporary_environment
  temporary_environment="$(mktemp "$config_dir/.agent.env.XXXXXX")"
  {
    printf '%s\n' \
      "SWARMOPS_AGENT_TOKEN_FILE=$api_key_destination" \
      "SWARMOPS_AGENT_ENROLLMENT_FILE=$enrollment_destination" \
      "SWARMOPS_AGENT_TLS_CERT_FILE=$tls_cert_file" \
      "SWARMOPS_AGENT_TLS_KEY_FILE=$tls_key_file" \
      "SWARMOPS_AGENT_LISTEN_ADDR=$listen_addr" \
      "SWARMOPS_AGENT_PROVISION_SOCKET=$provision_socket" \
      "SWARMOPS_DOCKER_SOCKET=$docker_socket" \
      "SWARMOPS_AGENT_AUTO_UPDATE_ENABLED=$automatic_updates" \
      "SWARMOPS_AGENT_UPDATE_BUSY_FILE=$update_busy_file" \
      "SWARMOPS_AGENT_UPDATE_REQUEST_FILE=$update_request_file" \
	  "SWARMOPS_AGENT_UPDATE_STATUS_FILE=$update_status_file" \
	  "SWARMOPS_CORE_URL=$core_url" \
	  "SWARMOPS_AGENT_STATE_DIR=$update_status_dir" \
      "PATH=$docker_bin_dir:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" \
      'SWARMOPS_HOST_ROOT=/' \
      'SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED=true' \
      'SWARMOPS_AGENT_BUILD_ENABLED=false'
    if [[ "$os_name" == Linux ]]; then
      printf '%s\n' \
        'SWARMOPS_HOST_OS=/etc/os-release' \
        'SWARMOPS_HOST_PROC=/proc'
    fi
  } >"$temporary_environment"
  install -m 0600 "$temporary_environment" "$environment_file"
  rm -f "$temporary_environment"
}

# The updater is intentionally local and fixed: Core can only create an
# update-request marker through the authenticated agent. This script owns the
# trusted upstream, branch, build, replacement, and service restart, so no
# controller or browser value can become an executable update instruction.
write_update_script() {
  local temporary_update
  install -d -m 0700 "$update_status_dir"
  temporary_update="$(mktemp "$runtime_dir/.update-agent.XXXXXX")"
  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail' 'umask 077'
    printf 'source_dir=%q\n' "$source_dir"
    printf 'binary_dir=%q\n' "$binary_dir"
    printf 'status_dir=%q\n' "$update_status_dir"
    printf 'status_file=%q\n' "$update_status_file"
    printf 'busy_file=%q\n' "$update_busy_file"
    printf 'request_file=%q\n' "$update_request_file"
    printf 'repo_url=%q\n' "$trusted_update_repo"
    printf 'branch=%q\n' 'main'
    if [[ "$os_name" == Linux ]]; then
      printf 'agent_service=%q\n' "$(basename "$service_file")"
      printf 'provision_service=%q\n' "$(basename "$provision_service_file")"
    fi
    printf '%s\n' \
      '' \
      'write_status() {' \
      '  local state="$1" revision="$2" updated_at="${3:-}" checked_at temporary_status' \
      '  checked_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"' \
      '  temporary_status="$(mktemp "$status_dir/.update-status.XXXXXX")"' \
      '  if [[ -n "$updated_at" ]]; then' \
      '    printf "{\\"automatic\\":true,\\"state\\":\\"%s\\",\\"checkedAt\\":\\"%s\\",\\"lastUpdatedAt\\":\\"%s\\",\\"revision\\":\\"%s\\"}\\n" "$state" "$checked_at" "$updated_at" "$revision" >"$temporary_status"' \
      '  else' \
      '    printf "{\\"automatic\\":true,\\"state\\":\\"%s\\",\\"checkedAt\\":\\"%s\\",\\"revision\\":\\"%s\\"}\\n" "$state" "$checked_at" "$revision" >"$temporary_status"' \
      '  fi' \
      '  install -m 0600 "$temporary_status" "$status_file"' \
      '  rm -f "$temporary_status"' \
      '}' \
      '' \
      'install -d -m 0700 "$status_dir"' \
      'export GOCACHE="$status_dir/go-build"' \
      'export GOMODCACHE="$status_dir/go-mod"' \
      'install -d -m 0700 "$GOCACHE" "$GOMODCACHE"' \
      'if ! mkdir "$status_dir/update.lock" 2>/dev/null; then' \
      '  exit 0' \
      'fi' \
      'trap "rmdir \"$status_dir/update.lock\"" EXIT' \
      'rm -f "$request_file"' \
      'current="$(git -C "$source_dir" rev-parse --short=12 HEAD 2>/dev/null || true)"' \
      'if [[ -e "$busy_file" ]]; then' \
      '  write_status deferred "$current"' \
      '  exit 0' \
      'fi' \
      'remote="$(git -C "$source_dir" remote get-url origin 2>/dev/null || true)"' \
      'if [[ "$remote" != "$repo_url" ]]; then' \
      '  write_status failed "$current"' \
      '  exit 0' \
      'fi' \
      'if [[ "$(git -C "$source_dir" rev-parse --is-shallow-repository 2>/dev/null || true)" == "true" ]]; then' \
      '  fetch_args=(--unshallow)' \
      'else' \
      '  fetch_args=()' \
      'fi' \
      'if ! git -C "$source_dir" fetch "${fetch_args[@]}" origin "$branch"; then' \
      '  write_status failed "$current"' \
      '  exit 0' \
      'fi' \
      'target="$(git -C "$source_dir" rev-parse --short=12 FETCH_HEAD 2>/dev/null || true)"' \
      'if [[ -z "$target" ]]; then' \
      '  write_status failed "$current"' \
      '  exit 0' \
      'fi' \
      'if [[ "$current" == "$target" ]]; then' \
      '  write_status up_to_date "$current"' \
      '  exit 0' \
      'fi' \
      'if ! git -C "$source_dir" merge --ff-only FETCH_HEAD; then' \
      '  write_status failed "$current"' \
      '  exit 0' \
      'fi' \
      'temporary_binary="$(mktemp "$binary_dir/.swarmops-agent.XXXXXX")"' \
      'if ! (cd "$source_dir" && CGO_ENABLED=0 go build -trimpath -o "$temporary_binary" ./cmd/agent); then' \
      '  rm -f "$temporary_binary"' \
      '  write_status failed "$target"' \
      '  exit 0' \
      'fi' \
      'chmod 0755 "$temporary_binary"' \
      'mv -f "$temporary_binary" "$binary_dir/swarmops-agent"' \
      'updated_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"' \
      'write_status updated "$target" "$updated_at"'
    if [[ "$os_name" == Linux ]]; then
      printf '%s\n' \
        'systemctl try-restart "$provision_service"' \
        'systemctl try-restart "$agent_service"'
    else
      printf '%s\n' \
        'uid="$(id -u)"' \
        'launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-agent"'
    fi
  } >"$temporary_update"
  install -m 0700 "$temporary_update" "$update_script"
  rm -f "$temporary_update"
}

write_linux_update_services() {
  local temporary_service temporary_timer temporary_path
  temporary_service="$(mktemp '/etc/systemd/system/.swarmops-agent-update.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps trusted native-agent update check' \
      'Wants=network-online.target' \
      'After=network-online.target' \
      '' \
      '[Service]' \
      'Type=oneshot' \
      "ExecStart=$update_script" \
      'NoNewPrivileges=yes' \
      'PrivateTmp=yes' \
      'ProtectSystem=full' \
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
      "ReadWritePaths=$source_dir $runtime_dir $update_status_dir /run/swarmops-agent"
  } >"$temporary_service"
  install -m 0644 "$temporary_service" "$update_service_file"
  rm -f "$temporary_service"

  temporary_timer="$(mktemp '/etc/systemd/system/.swarmops-agent-update-timer.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Run the SwarmOps native-agent update check every six hours' \
      '' \
      '[Timer]' \
      'OnBootSec=10m' \
      'OnUnitActiveSec=6h' \
      'RandomizedDelaySec=20m' \
      'Persistent=true' \
      '' \
      '[Install]' \
      'WantedBy=timers.target'
  } >"$temporary_timer"
  install -m 0644 "$temporary_timer" "$update_timer_file"
  rm -f "$temporary_timer"

  temporary_path="$(mktemp '/etc/systemd/system/.swarmops-agent-update-path.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=Run the SwarmOps native-agent update check requested by Core' \
      '' \
      '[Path]' \
      "PathExists=$update_request_file" \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target'
  } >"$temporary_path"
  install -m 0644 "$temporary_path" "$update_path_file"
  rm -f "$temporary_path"
  systemctl daemon-reload
  systemctl enable --now "$(basename "$update_timer_file")" "$(basename "$update_path_file")"
}

unit_has_namespace_error() {
  local unit="$1"
  local status_code
  status_code="$(systemctl show "$unit" --property=ExecMainStatus --value 2>/dev/null | tr -d '[:space:]')"
  [[ "$status_code" == "226" ]]
}

write_namespace_compatibility_override() {
  local unit="$1"
  local dropin_dir="/etc/systemd/system/${unit}.d"
  local override_file="$dropin_dir/99-swarmops-namespace-compatibility.conf"
  mkdir -p "$dropin_dir"
  cat >"$override_file" <<'EOF'
[Service]
RestrictNamespaces=no
EOF
}

start_systemd_service_with_fallback() {
  local unit="$1"
  local fail_message="$2"

  systemctl enable --now "$unit" >/dev/null
  if systemctl is-active --quiet "$unit"; then
    return 0
  fi

  if unit_has_namespace_error "$unit"; then
    write_namespace_compatibility_override "$unit"
    systemctl daemon-reload
    systemctl restart "$unit" >/dev/null
    if systemctl is-active --quiet "$unit"; then
      printf 'SwarmOps machine-agent install: %s does not support strict namespace restrictions; namespace hardening was disabled automatically.\n' "$unit" >&2
      return 0
    fi
  fi

  systemctl status --no-pager "$unit" >&2 || true
  fail "$fail_message"
}

disable_linux_update_services() {
  systemctl disable --now "$(basename "$update_timer_file")" "$(basename "$update_path_file")" >/dev/null 2>&1 || true
  rm -f -- "$update_service_file" "$update_timer_file" "$update_path_file"
  systemctl daemon-reload
}

write_linux_service() {
  local temporary_service
  temporary_service="$(mktemp '/etc/systemd/system/.swarmops-agent.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps pinned machine API agent' \
      'Wants=network-online.target' \
      'Requires=swarmops-agent-provisioner.service' \
      'After=network-online.target docker.service swarmops-agent-provisioner.service' \
      '' \
      '[Service]' \
      'Type=simple' \
      "EnvironmentFile=$environment_file" \
      "ExecStart=$binary_dir/swarmops-agent" \
      'Restart=on-failure' \
      'RestartSec=5s' \
      'NoNewPrivileges=yes' \
      'PrivateTmp=yes' \
      'PrivateDevices=yes' \
      'ProtectSystem=full' \
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
      'UMask=0077' \
      'RuntimeDirectory=swarmops-agent' \
      'RuntimeDirectoryMode=0755' \
	  "ReadWritePaths=/run/swarmops-agent $update_status_dir" \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target'
  } >"$temporary_service"
  install -m 0644 "$temporary_service" "$service_file"
  rm -f "$temporary_service"
  systemctl enable --now "$(basename "$provision_service_file")"
  start_systemd_service_with_fallback "$(basename "$provision_service_file")" 'machine provisioning helper did not become active'
  start_systemd_service_with_fallback "$(basename "$service_file")" 'machine agent service did not become active'
}

# The normal agent remains heavily sandboxed. This private Unix-socket helper
# is its only path to a handful of reviewed host operations, so the browser
# never gains a shell, arbitrary package manager, systemctl, or UFW interface.
write_linux_provision_service() {
  local temporary_service
  temporary_service="$(mktemp '/etc/systemd/system/.swarmops-agent-provisioner.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps fixed machine provisioning helper' \
      'Wants=network-online.target' \
      'After=network-online.target' \
      '' \
      '[Service]' \
      'Type=simple' \
      "ExecStart=$binary_dir/swarmops-agent provisioner --socket $provision_socket --agent-port $port" \
      'Restart=on-failure' \
      'RestartSec=5s' \
      'PrivateTmp=yes' \
      'ProtectHome=yes' \
      'ProtectKernelTunables=yes' \
      'ProtectKernelModules=yes' \
      'ProtectKernelLogs=yes' \
      'ProtectControlGroups=yes' \
      'ProtectClock=yes' \
      'LockPersonality=yes' \
      'RestrictNamespaces=yes' \
      'RestrictRealtime=yes' \
      'RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6' \
      'SystemCallArchitectures=native' \
      'RuntimeDirectory=swarmops-agent' \
      'RuntimeDirectoryMode=0755' \
      'UMask=0077' \
      '' \
      '[Install]' \
      'WantedBy=multi-user.target'
  } >"$temporary_service"
  install -m 0644 "$temporary_service" "$provision_service_file"
  rm -f "$temporary_service"
  systemctl daemon-reload
}

xml_escape() {
  local value="$1"
  value="${value//&/&amp;}"
  value="${value//</&lt;}"
  value="${value//>/&gt;}"
  printf '%s' "$value"
}

write_macos_service() {
  local temporary_launcher temporary_service uid
  install -d -m 0700 "$HOME/Library/LaunchAgents"
  temporary_launcher="$(mktemp "$runtime_dir/.run-agent.XXXXXX")"
  {
    printf '%s\n' '#!/bin/sh' 'set -eu' 'set -a'
    printf '. %s\n' "'$(printf '%s' "$environment_file" | sed "s/'/'\\''/g")'"
    printf '%s\n' 'set +a'
    printf 'exec %s\n' "'$(printf '%s' "$binary_dir/swarmops-agent" | sed "s/'/'\\''/g")'"
  } >"$temporary_launcher"
  install -m 0700 "$temporary_launcher" "$launcher_file"
  rm -f "$temporary_launcher"

  temporary_service="$(mktemp "$HOME/Library/LaunchAgents/.swarmops-agent.XXXXXX")"
  {
    printf '%s\n' \
      '<?xml version="1.0" encoding="UTF-8"?>' \
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
      '<plist version="1.0">' \
      '<dict>' \
      '  <key>Label</key>' \
      '  <string>com.nimasrn.swarmops-agent</string>' \
      '  <key>ProgramArguments</key>' \
      '  <array>' \
      "    <string>$(xml_escape "$launcher_file")</string>" \
      '  </array>' \
      '  <key>RunAtLoad</key>' \
      '  <true/>' \
      '  <key>KeepAlive</key>' \
      '  <true/>' \
      '  <key>ProcessType</key>' \
      '  <string>Background</string>' \
      '</dict>' \
      '</plist>'
  } >"$temporary_service"
  install -m 0600 "$temporary_service" "$service_file"
  rm -f "$temporary_service"
  uid="$(id -u)"
  launchctl bootout "gui/$uid/com.nimasrn.swarmops-agent" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$uid" "$service_file"
  launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-agent"
}

write_macos_update_service() {
  local temporary_launcher temporary_service uid
  install -d -m 0700 "$HOME/Library/LaunchAgents"
  temporary_launcher="$(mktemp "$runtime_dir/.run-update.XXXXXX")"
  {
    printf '%s\n' '#!/bin/sh' 'set -eu'
    printf 'exec %s\n' "'$(printf '%s' "$update_script" | sed "s/'/'\\''/g")'"
  } >"$temporary_launcher"
  install -m 0700 "$temporary_launcher" "$update_launcher_file"
  rm -f "$temporary_launcher"

  temporary_service="$(mktemp "$HOME/Library/LaunchAgents/.swarmops-agent-update.XXXXXX")"
  {
    printf '%s\n' \
      '<?xml version="1.0" encoding="UTF-8"?>' \
      '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
      '<plist version="1.0">' \
      '<dict>' \
      '  <key>Label</key>' \
      '  <string>com.nimasrn.swarmops-agent-update</string>' \
      '  <key>ProgramArguments</key>' \
      '  <array>' \
      "    <string>$(xml_escape "$update_launcher_file")</string>" \
      '  </array>' \
      '  <key>RunAtLoad</key>' \
      '  <true/>' \
      '  <key>StartInterval</key>' \
      '  <integer>21600</integer>' \
      '  <key>ThrottleInterval</key>' \
      '  <integer>60</integer>' \
      '  <key>WatchPaths</key>' \
      '  <array>' \
      "    <string>$(xml_escape "$update_request_file")</string>" \
      '  </array>' \
      '  <key>ProcessType</key>' \
      '  <string>Background</string>' \
      '</dict>' \
      '</plist>'
  } >"$temporary_service"
  install -m 0600 "$temporary_service" "$update_service_file"
  rm -f "$temporary_service"
  uid="$(id -u)"
  launchctl bootout "gui/$uid/com.nimasrn.swarmops-agent-update" >/dev/null 2>&1 || true
  launchctl bootstrap "gui/$uid" "$update_service_file"
  launchctl kickstart -k "gui/$uid/com.nimasrn.swarmops-agent-update"
}

disable_macos_update_service() {
  local uid
  uid="$(id -u)"
  launchctl bootout "gui/$uid/com.nimasrn.swarmops-agent-update" >/dev/null 2>&1 || true
  rm -f -- "$update_service_file" "$update_launcher_file" "$update_script"
}

# detect_advertise_host picks the address an off-host controller can dial. It
# prefers an explicit --advertise-host, then the primary routable interface,
# and never contacts an external service to discover it.
detect_advertise_host() {
  local candidate=''
  case "$os_name" in
    Linux)
      candidate="$(ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i=1;i<NF;i++) if ($i=="src") {print $(i+1); exit}}')"
      [[ -n "$candidate" ]] || candidate="$(hostname -I 2>/dev/null | awk '{print $1}')"
      ;;
    Darwin)
      candidate="$(route -n get default 2>/dev/null | awk '/interface:/ {print $2; exit}')"
      [[ -n "$candidate" ]] && candidate="$(ipconfig getifaddr "$candidate" 2>/dev/null || true)"
      ;;
  esac
  [[ -n "$candidate" ]] || candidate="$(hostname 2>/dev/null || true)"
  [[ -n "$candidate" ]] || fail 'cannot detect this host address; pass --advertise-host'
  printf '%s\n' "$candidate"
}

# generate_tls_material writes an owner-only P-256 key and a self-signed leaf
# certificate for the advertised host. The controller pins that exact leaf, so
# a private CA is unnecessary and a public one would add no trust here.
generate_tls_material() {
  local temporary_dir subject_alt
  # macOS ships LibreSSL as /usr/bin/openssl, which rejects the -noenc and
  # -pkeyopt flags below. Fail with a clear instruction rather than a raw
  # LibreSSL usage error.
  openssl version | grep -q '^OpenSSL' || fail 'generating the agent certificate needs OpenSSL (not LibreSSL); install it, for example with brew install openssl, and put it first on PATH'
  install -d -m 0700 "$config_dir/tls"
  temporary_dir="$(mktemp -d "$config_dir/tls/.material.XXXXXX")"
  if [[ "$advertise_host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || "$advertise_host" == *:*:* ]]; then
    subject_alt="IP:$advertise_host"
  else
    subject_alt="DNS:$advertise_host"
  fi
  if ! openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -sha256 -days 3650 -noenc \
    -subj "/CN=$advertise_host" -addext "subjectAltName=$subject_alt" -addext 'extendedKeyUsage=serverAuth' \
    -keyout "$temporary_dir/agent.key" -out "$temporary_dir/agent.crt" >/dev/null 2>&1; then
    rm -rf "$temporary_dir"
    fail 'generate the agent TLS certificate'
  fi
  install -m 0600 "$temporary_dir/agent.key" "$config_dir/tls/agent.key"
  install -m 0644 "$temporary_dir/agent.crt" "$config_dir/tls/agent.crt"
  rm -rf "$temporary_dir"
  tls_cert_file="$config_dir/tls/agent.crt"
  tls_key_file="$config_dir/tls/agent.key"
  generated_tls=true
}

# install_docker_engine installs Docker Engine from Docker's own signed apt
# repository. Convenience scripts piped from the network are deliberately not
# used: the repository key is verified and pinned here.
install_docker_engine() {
  if command -v docker >/dev/null 2>&1; then
    return
  fi
  [[ "$os_name" == Linux ]] || fail '--install-docker supports Debian and Ubuntu Linux only; install Docker Desktop manually on macOS'
  [[ -f /etc/os-release ]] || fail '--install-docker requires /etc/os-release'
  # shellcheck disable=SC1091
  . /etc/os-release
  case "$ID" in
    debian|ubuntu) ;;
    *) fail '--install-docker supports Debian and Ubuntu Linux only' ;;
  esac
  export DEBIAN_FRONTEND=noninteractive
  apt-get update
  apt-get install --yes --no-install-recommends ca-certificates curl gnupg
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/$ID/gpg" -o /etc/apt/keyrings/docker.asc || fail 'download the Docker repository key'
  chmod 0644 /etc/apt/keyrings/docker.asc
  printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/%s %s stable\n' \
    "$(dpkg --print-architecture)" "$ID" "$VERSION_CODENAME" >/etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install --yes --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  command -v docker >/dev/null 2>&1 || fail 'Docker Engine installation did not produce a docker command'
}

# initialize_swarm forms a single-node Swarm only when this host is not already
# in one. Joining an existing cluster stays an explicit operator action.
initialize_swarm() {
  local state
  state="$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || true)"
  if [[ "$state" == 'active' ]]; then
    return
  fi
  [[ "$state" == 'inactive' ]] || fail "this host is in Swarm state '$state'; resolve it before --init-swarm"
  docker swarm init --advertise-addr "$advertise_host" >/dev/null || fail 'docker swarm init failed'
}

# install_enrollment_secret writes the one-time secret the agent trades for the
# machine API key. The agent deletes this file the first time it is used.
install_enrollment_secret() {
  local temporary_secret
  temporary_secret="$(mktemp "$config_dir/.enrollment.XXXXXX")"
  if ! openssl rand -base64 32 | tr '+/' '-_' | tr -d '=\n' >"$temporary_secret"; then
    rm -f "$temporary_secret"
    fail 'generate the enrollment secret'
  fi
  enrollment_secret="$(cat "$temporary_secret")"
  [[ "$enrollment_secret" =~ ^[A-Za-z0-9_-]{22,128}$ ]] || { rm -f "$temporary_secret"; fail 'generate the enrollment secret'; }
  install -m 0600 "$temporary_secret" "$enrollment_destination"
  rm -f "$temporary_secret"
}

# enrollment_token renders the single string an operator pastes into SwarmOps.
# It carries the origin, the pinned fingerprint, and the one-time secret, and
# never the long-lived machine API key.
enrollment_token() {
  local payload
  payload="$(printf '{"f":"%s","h":"%s","p":%s,"s":"%s"}' "$fingerprint" "$advertise_host" "$port" "$enrollment_secret")"
  printf 'swarmops1.%s\n' "$(printf '%s' "$payload" | openssl base64 -A | tr '+/' '-_' | tr -d '=')"
}

certificate_fingerprint() {
  local digest
  digest="$(openssl x509 -in "$tls_cert_file" -outform DER | openssl dgst -sha256 -hex | awk '{print $NF}')" || fail 'compute TLS certificate fingerprint'
  [[ "$digest" =~ ^[A-Fa-f0-9]{64}$ ]] || fail 'compute TLS certificate fingerprint'
  printf 'SHA256:%s\n' "$(printf '%s' "$digest" | tr '[:lower:]' '[:upper:]')"
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
	--core)
	  [[ "$#" -ge 2 ]] || fail '--core requires a value'
	  core_url="${2%/}"
	  shift 2
	  ;;
	--core-fingerprint)
	  [[ "$#" -ge 2 ]] || fail '--core-fingerprint requires a value'
	  core_fingerprint="$2"
	  shift 2
	  ;;
	--enrollment-code)
	  [[ "$#" -ge 2 ]] || fail '--enrollment-code requires a value'
	  enrollment_code="$2"
	  shift 2
	  ;;
	--listen-addr)
      [[ "$#" -ge 2 ]] || fail '--listen-addr requires a value'
      listen_addr="$2"
      shift 2
      ;;
    --tls-cert-file)
      [[ "$#" -ge 2 ]] || fail '--tls-cert-file requires a value'
      tls_cert_file="$2"
      shift 2
      ;;
    --tls-key-file)
      [[ "$#" -ge 2 ]] || fail '--tls-key-file requires a value'
      tls_key_file="$2"
      shift 2
      ;;
    --api-key-file)
      [[ "$#" -ge 2 ]] || fail '--api-key-file requires a value'
      api_key_file="$2"
      shift 2
      ;;
    --docker-socket)
      [[ "$#" -ge 2 ]] || fail '--docker-socket requires a value'
      docker_socket="$2"
      shift 2
      ;;
    --repo)
      [[ "$#" -ge 2 ]] || fail '--repo requires a value'
      repo_url="$2"
      shift 2
      ;;
    --branch)
      [[ "$#" -ge 2 ]] || fail '--branch requires a value'
      branch="$2"
      shift 2
      ;;
    --advertise-host)
      [[ "$#" -ge 2 ]] || fail '--advertise-host requires a value'
      advertise_host="$2"
      shift 2
      ;;
    --install-docker)
      install_docker=true
      shift
      ;;
    --init-swarm)
      init_swarm=true
      shift
      ;;
    --defer-docker)
      defer_docker=true
      shift
      ;;
    --no-auto-update)
      automatic_updates=false
      shift
      ;;
    --install-dependencies)
      install_dependencies=true
      shift
      ;;
    --no-install-dependencies)
      install_dependencies=false
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

case "$os_name" in
  Linux)
    [[ "$(id -u)" == '0' ]] || fail 'run this command with sudo on Linux'
    ;;
  Darwin)
    [[ "$(id -u)" != '0' ]] || fail 'run this command as the logged-in Docker Desktop user on macOS, without sudo'
    ;;
  *)
    fail "unsupported operating system: $os_name"
    ;;
esac

if [[ -n "$core_url" || -n "$enrollment_code" ]]; then
	[[ -n "$core_url" ]] || fail '--enrollment-code requires --core'
	[[ "$core_url" == https://* && "$core_url" != *[[:space:]]* ]] || fail '--core must be one HTTPS origin without whitespace'
	if [[ -n "$core_fingerprint" ]]; then
		[[ "$core_fingerprint" =~ ^SHA256:[A-Fa-f0-9]{64}$ ]] || fail '--core-fingerprint must use SHA256:<64-hex>'
	fi
	if [[ -n "$enrollment_code" ]]; then
		[[ "$enrollment_code" =~ ^[A-Fa-f0-9]{48}$ ]] || fail '--enrollment-code is invalid'
	fi
else
	validate_listener "$listen_addr"
fi
port="${listen_addr##*:}"

if [[ "$defer_docker" == true && ( "$install_docker" == true || "$init_swarm" == true ) ]]; then
  fail '--defer-docker cannot be combined with --install-docker or --init-swarm'
fi

# A custom repository or branch is a deliberate local-development choice, not
# a source the installed updater may execute unattended. The standard trusted
# upstream/main install keeps automatic checks on by default.
if [[ "$automatic_updates" == true && ( "$repo_url" != "$trusted_update_repo" || "$branch" != main ) ]]; then
  printf '%s\n' 'SwarmOps machine-agent install: automatic updates are disabled for a custom Git source or branch.' >&2
  automatic_updates=false
fi

if [[ -z "$core_url" && -z "$advertise_host" ]]; then
  advertise_host="$(detect_advertise_host)"
fi
if [[ -z "$core_url" ]]; then
	require_safe_value '--advertise-host' "$advertise_host"
	[[ "$advertise_host" != *[/:]* || "$advertise_host" == *:*:* ]] || fail '--advertise-host must be a hostname or IP address without a port'
fi

if [[ "$install_docker" == true ]]; then
  install_docker_engine
fi
if [[ "$install_dependencies" == true ]]; then
  install_host_dependencies
fi
require_command git
require_command go
require_command openssl
if [[ "$defer_docker" != true ]]; then
  require_command docker
fi

if [[ -z "$docker_socket" ]]; then
  docker_socket="$(default_docker_socket)"
fi
require_safe_value '--docker-socket' "$docker_socket"
[[ "$docker_socket" == /* && "$docker_socket" != "/" ]] || fail '--docker-socket must be an absolute, non-root path'
if [[ "$defer_docker" != true ]]; then
  [[ -S "$docker_socket" ]] || fail "Docker socket is not available: $docker_socket"
fi
[[ "$repo_url" != *$'\n'* && "$repo_url" != *$'\r'* && "$repo_url" != *[[:space:]]* ]] || fail '--repo must be one Git URL without whitespace'
[[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || fail '--branch contains unsupported characters'

if [[ "$init_swarm" == true ]]; then
  initialize_swarm
fi

if [[ "$defer_docker" == true ]]; then
  docker_bin_dir='/usr/bin'
else
  docker_bin_dir="$(dirname "$(command -v docker)")"
fi
require_safe_value 'Docker command directory' "$docker_bin_dir"
if [[ "$os_name" == Linux ]]; then
  require_command systemctl
else
  require_command launchctl
fi

set_paths
for install_path in "$source_dir" "$config_dir" "$runtime_dir" "$service_file"; do
  require_safe_value 'installation path' "$install_path"
done
if [[ "$os_name" == Linux ]]; then
  require_safe_value 'provisioning service path' "$provision_service_file"
  require_safe_value 'provisioning socket path' "$provision_socket"
  if [[ "$automatic_updates" == true ]]; then
    require_safe_value 'agent update service path' "$update_service_file"
    require_safe_value 'agent update timer path' "$update_timer_file"
    require_safe_value 'agent update path unit path' "$update_path_file"
  fi
fi
if [[ "$automatic_updates" == true ]]; then
  for update_path in "$update_busy_file" "$update_request_file" "$update_status_dir" "$update_status_file" "$update_script"; do
    require_safe_value 'agent update path' "$update_path"
    [[ "$update_path" == /* && "$update_path" != / ]] || fail 'agent update paths must be absolute, non-root paths'
  done
fi
install -d -m 0700 "$config_dir"

# A caller may supply reviewed TLS material; otherwise the installer generates
# a pinned self-signed leaf so a first install needs no preparation at all.
if [[ -z "$core_url" && -z "$tls_cert_file" && -z "$tls_key_file" ]]; then
  generate_tls_material
fi
if [[ -z "$core_url" ]]; then
	[[ -n "$tls_cert_file" && -n "$tls_key_file" ]] || fail '--tls-cert-file and --tls-key-file must be given together'
	require_safe_value '--tls-cert-file' "$tls_cert_file"
	require_safe_value '--tls-key-file' "$tls_key_file"
	require_regular_file '--tls-cert-file' "$tls_cert_file"
	require_protected_file '--tls-key-file' "$tls_key_file"
fi
if [[ "$os_name" == Linux && -z "$core_url" ]]; then
  for tls_path in "$tls_cert_file" "$tls_key_file"; do
    case "$tls_path" in
      /home/*|/root/*|/run/user/*)
        fail 'Linux TLS files must stay outside /home, /root, and /run/user because the systemd service protects home directories'
        ;;
    esac
  done
fi
if [[ -n "$api_key_file" ]]; then
  require_safe_value '--api-key-file' "$api_key_file"
fi

ensure_checkout
build_agent
install_api_key
if [[ -n "$core_url" ]]; then
	enroll_args=(enroll --core "$core_url" --name "$(hostname)" --state-dir "$update_status_dir")
	if [[ -n "$core_fingerprint" ]]; then
		enroll_args+=(--core-fingerprint "$core_fingerprint")
	fi
	if [[ -n "$enrollment_code" ]]; then
		enroll_args+=(--code "$enrollment_code")
	fi
	"$binary_dir/swarmops-agent" "${enroll_args[@]}"
else
	install_enrollment_secret
fi
write_environment_file
if [[ "$automatic_updates" == true ]]; then
  write_update_script
fi
case "$os_name" in
  Linux)
    write_linux_provision_service
    if [[ "$automatic_updates" == true ]]; then
      write_linux_update_services
    else
      disable_linux_update_services
    fi
    write_linux_service
    ;;
  Darwin)
    write_macos_service
    if [[ "$automatic_updates" == true ]]; then
      write_macos_update_service
    else
      disable_macos_update_service
    fi
    ;;
esac

if [[ -n "$core_url" ]]; then
	printf '%s\n' '' 'SwarmOps machine agent installed and enrolled.' 'The agent opens only outbound HTTPS long polls to Core; no inbound agent port is required.'
	exit 0
fi
fingerprint="$(certificate_fingerprint)"
printf '%s\n' \
  '' \
  'SwarmOps machine agent installed.' \
  '' \
  'Paste this enrollment token into the SwarmOps console (Servers -> Add server):' \
  '' \
  "  $(enrollment_token)" \
  '' \
  'The token is single-use. It carries this host address, the pinned certificate' \
  'fingerprint, and a one-time secret that the console trades for the machine API' \
  'key over the pinned connection. The API key itself is never printed and never' \
  'leaves this host by any other path. Allow only the SwarmOps controller to reach' \
  "TCP port $port."
if [[ "$generated_tls" == true ]]; then
  printf '%s\n' "Generated a self-signed agent certificate for $advertise_host at $tls_cert_file."
fi
if [[ "$automatic_updates" == true ]]; then
  printf '%s\n' 'Automatic agent updates are enabled: Core requests a local check while connected, and this host checks the trusted Git source every six hours when Core is unavailable.'
else
  printf '%s\n' 'Automatic agent updates are disabled for this installation.'
fi
