#!/usr/bin/env bash
set -euo pipefail
umask 077

# Install a native SwarmOps machine agent from Git. The agent gives an
# authenticated controller a small fixed Docker-operation API; it never opens
# the Docker socket or an arbitrary shell over the network.

repo_url="https://github.com/nimasrn/SwarmOps.git"
branch="main"
listen_addr=""
tls_cert_file=""
tls_key_file=""
api_key_file=""
docker_socket=""
install_dependencies=false
os_name="$(uname -s)"

usage() {
  printf '%s\n' \
    'Usage:' \
    '  Linux:' \
    '    sudo bash install-swarmops-agent.sh --listen-addr <host:port> \' \
    '      --tls-cert-file <absolute-path> --tls-key-file <absolute-path> [options]' \
    '  macOS:' \
    '    bash install-swarmops-agent.sh --listen-addr <host:port> \' \
    '      --tls-cert-file <absolute-path> --tls-key-file <absolute-path> [options]' \
    '' \
    'Clones or fast-forwards the selected Git branch, builds the native machine' \
    'agent, writes a protected API-key file, and installs systemd (Linux) or a' \
    'per-user LaunchAgent (macOS). It does not install Docker, create a Swarm,' \
    'open a firewall, or expose the Docker socket.' \
    '' \
    '--listen-addr <host:port>      Required listener, for example 0.0.0.0:9180.' \
    '--tls-cert-file <path>         Required non-symlink PEM certificate.' \
    '--tls-key-file <path>          Required owner-only non-symlink PEM key.' \
    '--api-key-file <path>          Copy this protected key file; otherwise generate one.' \
    '--docker-socket <path>         Docker Unix socket; defaults by platform.' \
    '--repo <Git URL>               Repository to clone (default: nimasrn/SwarmOps).' \
    '--branch <name>                Git branch to install (default: main).' \
    '--install-dependencies         Install Git, Go, and OpenSSL where supported.' \
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
  [[ "$1" =~ ^[A-Za-z0-9_./:\[\]-]+$ ]]
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

install_host_dependencies() {
  case "$os_name" in
    Linux)
      [[ -f /etc/debian_version ]] || fail '--install-dependencies supports Debian and Ubuntu Linux only'
      export DEBIAN_FRONTEND=noninteractive
      apt-get update
      apt-get install --yes --no-install-recommends ca-certificates git golang-go openssl
      ;;
    Darwin)
      require_command brew
      brew install git go openssl
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
      ;;
    Darwin)
      source_dir="$HOME/.local/share/swarmops-agent/source"
      config_dir="$HOME/.config/swarmops-agent"
      runtime_dir="$HOME/.local/lib/swarmops-agent"
      service_file="$HOME/Library/LaunchAgents/com.nimasrn.swarmops-agent.plist"
      ;;
    *)
      fail "unsupported operating system: $os_name"
      ;;
  esac
  binary_dir="$runtime_dir/bin"
  api_key_destination="$config_dir/api-key"
  environment_file="$config_dir/agent.env"
  launcher_file="$runtime_dir/run-agent.sh"
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
  [[ -f "$source_dir/go.mod" ]] || fail 'the cloned repository does not contain the SwarmOps Go module'
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
      "SWARMOPS_AGENT_TLS_CERT_FILE=$tls_cert_file" \
      "SWARMOPS_AGENT_TLS_KEY_FILE=$tls_key_file" \
      "SWARMOPS_AGENT_LISTEN_ADDR=$listen_addr" \
      "SWARMOPS_DOCKER_SOCKET=$docker_socket" \
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

write_linux_service() {
  local temporary_service
  temporary_service="$(mktemp '/etc/systemd/system/.swarmops-agent.XXXXXX')"
  {
    printf '%s\n' \
      '[Unit]' \
      'Description=SwarmOps pinned machine API agent' \
      'Wants=network-online.target' \
      'After=network-online.target docker.service' \
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
      '' \
      '[Install]' \
      'WantedBy=multi-user.target'
  } >"$temporary_service"
  install -m 0644 "$temporary_service" "$service_file"
  rm -f "$temporary_service"
  systemctl daemon-reload
  systemctl enable --now "$(basename "$service_file")"
  systemctl is-active --quiet "$(basename "$service_file")" || fail 'machine agent service did not become active'
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

certificate_fingerprint() {
  local digest
  digest="$(openssl x509 -in "$tls_cert_file" -outform DER | openssl dgst -sha256 -hex | awk '{print $NF}')" || fail 'compute TLS certificate fingerprint'
  [[ "$digest" =~ ^[A-Fa-f0-9]{64}$ ]] || fail 'compute TLS certificate fingerprint'
  printf 'SHA256:%s\n' "$(printf '%s' "$digest" | tr '[:lower:]' '[:upper:]')"
}

while [[ "$#" -gt 0 ]]; do
  case "$1" in
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

validate_listener "$listen_addr"
require_safe_value '--tls-cert-file' "$tls_cert_file"
require_safe_value '--tls-key-file' "$tls_key_file"
require_regular_file '--tls-cert-file' "$tls_cert_file"
require_protected_file '--tls-key-file' "$tls_key_file"
if [[ "$os_name" == Linux ]]; then
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
if [[ -z "$docker_socket" ]]; then
  docker_socket="$(default_docker_socket)"
fi
require_safe_value '--docker-socket' "$docker_socket"
[[ "$docker_socket" == /* && "$docker_socket" != "/" ]] || fail '--docker-socket must be an absolute, non-root path'
[[ -S "$docker_socket" ]] || fail "Docker socket is not available: $docker_socket"
[[ "$repo_url" != *$'\n'* && "$repo_url" != *$'\r'* && "$repo_url" != *[[:space:]]* ]] || fail '--repo must be one Git URL without whitespace'
[[ "$branch" =~ ^[A-Za-z0-9._/-]+$ ]] || fail '--branch contains unsupported characters'

if [[ "$install_dependencies" == true ]]; then
  install_host_dependencies
fi
require_command git
require_command go
require_command openssl
require_command docker
docker_bin_dir="$(dirname "$(command -v docker)")"
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
ensure_checkout
build_agent
install_api_key
write_environment_file
case "$os_name" in
  Linux)
    write_linux_service
    ;;
  Darwin)
    write_macos_service
    ;;
esac

fingerprint="$(certificate_fingerprint)"
port="${listen_addr##*:}"
printf '%s\n' \
  'Installed the SwarmOps machine agent.' \
  "Machine API port: $port" \
  "TLS certificate fingerprint: $fingerprint" \
  "Protected API key file: $api_key_destination" \
  'In SwarmOps, add this machine with its HTTPS URL (without a port), the port above,' \
  'the certificate fingerprint above, and the API key read through your approved secure channel.' \
  'The installer never prints the API key.'
