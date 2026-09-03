#!/usr/bin/env bash
set -euo pipefail
umask 077

# Give an already-installed Core host the update wiring the console needs.
#
# Installs before this fix wired Warden to a repository, a release directory
# and a health URL, but never to a request marker or a status file — and never
# told the controller where either lives. The console read that as "this
# controller has no updater" and hid the update button, which is exactly what
# an operator sees when they cannot update Core from Core settings.
#
# Nothing here downloads or replaces a binary. It writes environment keys, adds
# one systemd path unit, and restarts the controller so it reads them.

config_dir="/etc/swarmops"
runtime_dir="/usr/local/lib/swarmops"
release_dir="$runtime_dir/releases"
state_dir="/var/lib/swarmops"
service_name="swarmops-control-plane.service"
warden_service_name="swarmops-core-warden.service"
warden_path_name="swarmops-core-warden.path"
core_environment="$config_dir/control-plane.env"
warden_environment="$config_dir/warden.env"
update_request_file="$state_dir/update.request"
update_status_file="$state_dir/update-status.json"
update_busy_file="$state_dir/update.busy"

fail() {
  printf 'SwarmOps Core update wiring: %s\n' "$*" >&2
  exit 1
}

info() {
  printf 'SwarmOps Core update wiring: %s\n' "$*" >&2
}

[[ "$(id -u)" == "0" ]] || fail 'run this command with sudo on the Core host'
[[ "$(uname -s)" == Linux ]] || fail 'this repair supports Linux only'
command -v systemctl >/dev/null 2>&1 || fail 'systemctl is required'
[[ -f "$core_environment" && ! -L "$core_environment" ]] || fail "$core_environment is missing or is not a regular file"
[[ -f "$warden_environment" && ! -L "$warden_environment" ]] || fail "$warden_environment is missing or is not a regular file"
[[ -d "$release_dir" && ! -L "$release_dir" ]] || fail "$release_dir is missing or is not a directory"

# Replace the key if it is already present, append it if it is not. Running
# this twice leaves the same file, which is what makes it safe to re-run after
# a partial repair.
set_key() {
  local file="$1" key="$2" value="$3" owner group mode temporary
  owner="$(stat -c '%U' "$file")"
  group="$(stat -c '%G' "$file")"
  mode="$(stat -c '%a' "$file")"
  temporary="$(mktemp "$config_dir/.repair.env.XXXXXX")"
  KEY="$key" VALUE="$value" awk '
    BEGIN { key = ENVIRON["KEY"]; value = ENVIRON["VALUE"]; written = 0 }
    index($0, key "=") == 1 { if (!written) { print key "=" value; written = 1 } ; next }
    { print }
    END { if (!written) print key "=" value }
  ' "$file" >"$temporary"
  install -o "$owner" -g "$group" -m "$mode" "$temporary" "$file"
  rm -f -- "$temporary"
}

set_key "$core_environment" SWARMOPS_CORE_RELEASE_DIR "$release_dir"
set_key "$core_environment" SWARMOPS_CORE_UPDATE_REQUEST_FILE "$update_request_file"
set_key "$core_environment" SWARMOPS_CORE_UPDATE_STATUS_FILE "$update_status_file"
info "controller environment now names the release directory, the request marker and the status file"

set_key "$warden_environment" SWARMOPS_WARDEN_BUSY_FILE "$update_busy_file"
set_key "$warden_environment" SWARMOPS_WARDEN_REQUEST_FILE "$update_request_file"
set_key "$warden_environment" SWARMOPS_WARDEN_STATUS_FILE "$update_status_file"
info 'Warden now consumes the same request marker and writes the same status file'

# Warden's unit confines writes to the release directory. It now also writes
# the status file the controller reads, which lives in the state directory.
install -d -o root -g root -m 0755 "/etc/systemd/system/$warden_service_name.d"
{
  printf '%s\n' \
    '[Service]' \
    "ReadWritePaths=$state_dir"
} | install -o root -g root -m 0644 /dev/stdin "/etc/systemd/system/$warden_service_name.d/update-wiring.conf"

# The button writes a marker; this unit is what makes Warden read it now rather
# than whenever the twelve-hour timer next fires.
{
  printf '%s\n' \
    '[Unit]' \
    'Description=Run the SwarmOps Core update check requested from the console' \
    '' \
    '[Path]' \
    "PathExists=$update_request_file" \
    "Unit=$warden_service_name" \
    '' \
    '[Install]' \
    'WantedBy=multi-user.target'
} | install -o root -g root -m 0644 /dev/stdin "/etc/systemd/system/$warden_path_name"

systemctl daemon-reload
systemctl enable --now "$warden_path_name"
info "$warden_path_name is enabled"

# The controller reads these paths once, at start. Restarting it is the only
# way it learns it has an updater; the console is briefly unavailable.
systemctl restart "$service_name"
for attempt in $(seq 1 15); do
  systemctl is-active --quiet "$service_name" && break
  sleep 1
done
systemctl is-active --quiet "$service_name" || fail "$service_name did not come back; check journalctl -u $service_name"

info 'done — Core settings now offers "Check for an update" and lists the releases on disk'
