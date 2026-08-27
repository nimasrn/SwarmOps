#!/usr/bin/env bash
set -euo pipefail
umask 077

# Recover Core installations whose installed Warden cannot stage the current
# Core bundle. This downloads one fixed Warden from an immutable, dedicated
# recovery release, verifies it with the published checksum, and runs it only
# from a private temporary directory. It does not replace the installed updater
# directly; the normal checksum-verified update installs the stable Warden.

repository="nimasrn/SwarmOps"
recovery_release="warden-v0.6.0.1"
release_base="https://github.com/$repository/releases/download/$recovery_release"
warden_environment="/etc/swarmops/warden.env"
release_root="/usr/local/lib/swarmops/releases"

fail() {
  printf 'SwarmOps Core updater recovery: %s\n' "$*" >&2
  exit 1
}

info() {
  printf 'SwarmOps Core updater recovery: %s\n' "$*" >&2
}

[[ "$(id -u)" == "0" ]] || fail 'run this command with sudo on the Core host'
[[ "$(uname -s)" == Linux ]] || fail 'Core updater recovery supports Linux only'
[[ -f "$warden_environment" && ! -L "$warden_environment" ]] || fail "$warden_environment is missing or is not a regular file"
[[ -d "$release_root" && ! -L "$release_root" ]] || fail "$release_root is missing or is not a directory"

case "$(uname -m)" in
  x86_64 | amd64) release_arch="amd64" ;;
  aarch64 | arm64) release_arch="arm64" ;;
  *) fail "unsupported architecture $(uname -m)" ;;
esac

for required in curl tar; do
  command -v "$required" >/dev/null 2>&1 || fail "$required is required"
done
if command -v sha256sum >/dev/null 2>&1; then
  checksum_command=(sha256sum --check -)
elif command -v shasum >/dev/null 2>&1; then
  checksum_command=(shasum -a 256 --check -)
else
  fail 'sha256sum or shasum is required'
fi

recovery_dir="$(mktemp -d /tmp/swarmops-core-updater-recovery.XXXXXX)"
cleanup() {
  rm -rf -- "$recovery_dir"
}
trap cleanup EXIT INT TERM

bundle_name="swarmops-warden_${recovery_release}_linux_${release_arch}.tar.gz"
bundle_file="$recovery_dir/$bundle_name"
checksums_file="$recovery_dir/checksums.txt"
curl_options=(--fail --silent --show-error --location --proto '=https' --proto-redir '=https')

info "Downloading the immutable $recovery_release recovery Warden for Linux/$release_arch."
curl "${curl_options[@]}" "$release_base/checksums.txt" -o "$checksums_file"
curl "${curl_options[@]}" "$release_base/$bundle_name" -o "$bundle_file"

checksum_line="$(awk -v name="$bundle_name" '
  $2 == name || $2 == "*" name { line = $0; count++ }
  END { if (count != 1) exit 1; print line }
' "$checksums_file")" || fail "checksums.txt does not contain exactly one $bundle_name entry"
(
  cd "$recovery_dir"
  printf '%s\n' "$checksum_line" | "${checksum_command[@]}"
) || fail 'recovery Warden bundle checksum verification failed'

tar -xzf "$bundle_file" -C "$recovery_dir" swarmops-warden
[[ -f "$recovery_dir/swarmops-warden" && ! -L "$recovery_dir/swarmops-warden" ]] || fail 'verified bundle does not contain a regular Warden binary'
chmod 0755 "$recovery_dir/swarmops-warden"

info 'Running the verified recovery Warden; normal health validation and rollback remain active.'
while IFS='=' read -r key value; do
  case "$key" in
    SWARMOPS_WARDEN_REPOSITORY | SWARMOPS_WARDEN_COMPONENT | SWARMOPS_WARDEN_RELEASE_DIR | SWARMOPS_WARDEN_HEALTH_URL | SWARMOPS_WARDEN_SERVICE | SWARMOPS_WARDEN_HEALTH_TIMEOUT | SWARMOPS_WARDEN_HEALTH_INTERVAL)
      export "$key=$value"
      ;;
    '') ;;
    *) fail "$warden_environment contains unexpected setting $key" ;;
  esac
done <"$warden_environment"
umask 022
"$recovery_dir/swarmops-warden" update

installed_version="$(/usr/local/bin/swarmops-core --version)"
info "Recovery update completed; installed Core reports $installed_version."
