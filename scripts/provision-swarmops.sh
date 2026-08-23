#!/usr/bin/env bash
set -euo pipefail

# A human-safe front door to the existing idempotent Ansible Swarm bootstrap.
# It deliberately asks only for connection facts; Ansible itself handles an
# SSH password prompt and this script never receives, saves, or logs it.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  printf '%s\n' \
    'Usage: make swarmops-provision' \
    '' \
    'Interactively collects three manager addresses and an SSH username.' \
    'SSH passwords are prompted only by Ansible and are never saved.' \
    'With explicit confirmation, it can also create versioned secrets from' \
    'protected local files and deploy pre-built Traefik and SwarmOps images.'
}

case "${1:-}" in
  -h|--help)
    usage
    exit 0
    ;;
  "")
    ;;
  *)
    printf 'unknown option: %s\n' "$1" >&2
    usage >&2
    exit 2
    ;;
esac

ask_required() {
  local prompt="$1"
  local value=""
  while [[ -z "$value" ]]; do
    read -r -p "$prompt: " value
  done
  printf '%s' "$value"
}

ask_optional() {
  local prompt="$1"
  local value=""
  read -r -p "$prompt (press Enter to reuse SSH address): " value
  printf '%s' "$value"
}

ask_file() {
  local prompt="$1"
  local value=""
  while [[ -z "$value" ]]; do
    read -r -p "$prompt: " value
  done
  printf '%s' "$value"
}

printf '%s\n' 'SwarmOps provisioning plan — passwords are handled only by Ansible prompts.'
ssh_user="$(ask_required 'SSH username')"
manager_01="$(ask_required 'manager-01 SSH IP or hostname')"
manager_02="$(ask_required 'manager-02 SSH IP or hostname')"
manager_03="$(ask_required 'manager-03 SSH IP or hostname')"
advertise_01="$(ask_optional 'manager-01 private Swarm IP')"
advertise_02="$(ask_optional 'manager-02 private Swarm IP')"
advertise_03="$(ask_optional 'manager-03 private Swarm IP')"

args=(
  --ssh-user "$ssh_user"
  --manager-01 "$manager_01"
  --manager-02 "$manager_02"
  --manager-03 "$manager_03"
  --password-auth
)
[[ -n "$advertise_01" ]] && args+=(--advertise-01 "$advertise_01")
[[ -n "$advertise_02" ]] && args+=(--advertise-02 "$advertise_02")
[[ -n "$advertise_03" ]] && args+=(--advertise-03 "$advertise_03")

read -r -p 'Apply the reviewed plan to these hosts now? [y/N]: ' apply
if [[ "$apply" == "y" || "$apply" == "Y" ]]; then
  args+=(--apply)
  read -r -p 'Deploy the pre-built Traefik and SwarmOps stacks after bootstrap? [y/N]: ' platform
  if [[ "$platform" == "y" || "$platform" == "Y" ]]; then
    printf '%s\n' 'The platform phase creates versioned secrets from protected local files. It never asks for or stores secret values.'
    traefik_email="$(ask_required 'Traefik ACME email')"
    swarmops_host="$(ask_required 'SwarmOps HTTPS hostname')"
    grafana_host="$(ask_required 'Grafana HTTPS hostname')"
    dashboard_host="$(ask_required 'Traefik dashboard HTTPS hostname')"
    traefik_token_file="$(ask_file 'Path to Cloudflare DNS token file')"
    dashboard_auth_file="$(ask_file 'Path to Traefik dashboard htpasswd file')"
    password_hash_file="$(ask_file 'Path to SwarmOps bcrypt password-hash file')"
    session_key_file="$(ask_file 'Path to SwarmOps random session-key file')"
    agent_token_file="$(ask_file 'Path to SwarmOps random agent-token file')"
    registry_config_file="$(ask_file 'Path to Docker registry-config JSON file')"
    grafana_password_file="$(ask_file 'Path to Grafana administrator-password file')"
    args+=(
      --platform
      --traefik-email "$traefik_email"
      --swarmops-host "$swarmops_host"
      --grafana-host "$grafana_host"
      --traefik-dashboard-host "$dashboard_host"
      --traefik-token-file "$traefik_token_file"
      --traefik-dashboard-auth-file "$dashboard_auth_file"
      --swarmops-admin-password-hash-file "$password_hash_file"
      --swarmops-session-key-file "$session_key_file"
      --swarmops-agent-token-file "$agent_token_file"
      --swarmops-registry-config-file "$registry_config_file"
      --grafana-admin-password-file "$grafana_password_file"
    )
  fi
else
  printf '%s\n' 'Running plan-only validation. Re-run and answer y to apply.'
fi

exec bash "$repo_root/scripts/setup-three-managers.sh" "${args[@]}"
