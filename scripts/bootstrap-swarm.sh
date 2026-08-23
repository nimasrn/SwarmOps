#!/usr/bin/env bash
set -euo pipefail

# Provision the host OS and Docker Swarm only. Image construction, registry
# pushes, secrets, and stack deployments intentionally remain Makefile tasks.

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ansible_dir="$repo_root/deploy/ansible"
inventory=""
apply=0
password_auth=0
ask_become_pass=0
install_password_helper=0

usage() {
  printf '%s\n' \
    'Usage: bash scripts/bootstrap-swarm.sh --inventory <path> [options]' \
    '' \
    'Without --apply, this performs inventory, SSH, syntax, and Ansible' \
    'check-mode validation only. --apply provisions Docker and forms the' \
    'Swarm; it never pushes images, deploys stacks, creates secrets, or' \
    'changes DNS/firewall policy.' \
    '' \
    'Options:' \
    '  --password-auth             Prompt Ansible for the SSH password.' \
    '  --ask-become-pass           Prompt Ansible for the sudo password.' \
    '  --install-password-helper   Install sshpass with Homebrew if needed.' \
    '  --apply                     Apply host and Swarm provisioning.'
}

fail() {
  printf 'bootstrap failed: %s\n' "$*" >&2
  exit 1
}

while (($#)); do
  case "$1" in
    --inventory)
      (($# >= 2)) || fail '--inventory requires a path'
      inventory="$2"
      shift 2
      ;;
    --apply)
      apply=1
      shift
      ;;
    --password-auth)
      password_auth=1
      shift
      ;;
    --ask-become-pass)
      ask_become_pass=1
      shift
      ;;
    --install-password-helper)
      install_password_helper=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown argument: $1"
      ;;
  esac
done

[[ -n "$inventory" ]] || { usage >&2; exit 2; }
if [[ "$inventory" != /* ]]; then
  inventory="$repo_root/$inventory"
fi
[[ -f "$inventory" ]] || fail "inventory does not exist: $inventory"

command -v ansible-inventory >/dev/null || fail 'ansible-inventory is required'
command -v ansible >/dev/null || fail 'ansible is required'
command -v ansible-playbook >/dev/null || fail 'ansible-playbook is required'

auth_args=()
if ((password_auth)); then
  if ! command -v sshpass >/dev/null; then
    if ((install_password_helper)); then
      command -v brew >/dev/null || fail 'Homebrew is required to install sshpass'
      brew install sshpass
    else
      fail 'SSH password authentication requires sshpass; install it or pass --install-password-helper'
    fi
  fi
  auth_args+=(--ask-pass)
fi
if ((ask_become_pass)); then
  auth_args+=(--ask-become-pass)
fi

cd "$ansible_dir"

printf '%s\n' '== Inventory topology =='
ansible-inventory -i "$inventory" --graph

printf '%s\n' '== SSH and Python reachability =='
ansible "${auth_args[@]}" -i "$inventory" swarm_managers -m ansible.builtin.ping

printf '%s\n' '== Playbook syntax =='
ansible-playbook -i "$inventory" site.yml --syntax-check

if ((apply)); then
  printf '%s\n' '== Applying host and Swarm provisioning =='
  ansible-playbook "${auth_args[@]}" -i "$inventory" site.yml --diff
  printf '%s\n' \
    'Swarm provisioning completed.' \
    'Next, create the ignored deploy/hosts/*.env files, create the required' \
    'versioned Swarm secrets, build/push the SwarmOps images, then use' \
    'make platform-deploy to install Traefik and SwarmOps.'
else
  printf '%s\n' '== Check-mode plan (no host changes) =='
  ansible-playbook "${auth_args[@]}" -i "$inventory" site.yml --check --diff
  printf '%s\n' \
    'Check completed. Run the same command with --apply when the plan and' \
    'network/firewall prerequisites have been reviewed.'
fi
