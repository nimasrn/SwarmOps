#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
installer="${1:-$script_dir/install-swarmops-agent.sh}"
[[ -f "$installer" ]] || { printf 'installer not found: %s\n' "$installer" >&2; exit 1; }
test_root="$(mktemp -d "${TMPDIR:-/tmp}/swarmops-agent-installer-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

mkdir -p "$test_root/bin" "$test_root/home"
printf '%s\n' '#!/usr/bin/env bash' \
  'case "${1:-}" in' \
  "  -s) printf '%s\\n' \"\${SWARMOPS_TEST_OS:-Darwin}\" ;;" \
  "  -m) printf '%s\\n' \"\${SWARMOPS_TEST_ARCH:-arm64}\" ;;" \
  "  *) printf '%s\\n' \"\${SWARMOPS_TEST_OS:-Darwin}\" ;;" \
  'esac' >"$test_root/bin/uname"
printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' \"\${SWARMOPS_TEST_UID:-1000}\"" >"$test_root/bin/id"
chmod 0755 "$test_root/bin/uname" "$test_root/bin/id"

run_installer() {
  local os_name="$1" architecture="$2" uid="$3"
  shift 3
  SWARMOPS_TEST_OS="$os_name" SWARMOPS_TEST_ARCH="$architecture" SWARMOPS_TEST_UID="$uid" \
    PATH="$test_root/bin:$PATH" HOME="$test_root/home" bash "$installer" "$@"
}

expect_failure() {
  local expected="$1" output
  shift
  if output="$(run_installer Darwin arm64 1000 "$@" 2>&1)"; then
    printf 'expected installer validation to fail: %s\n' "$*" >&2
    exit 1
  fi
  if [[ "$output" != "SwarmOps machine-agent install: $expected" ]]; then
    printf 'unexpected installer validation result for %s\nexpected: %s\nactual:   %s\n' \
      "$*" "$expected" "$output" >&2
    exit 1
  fi
}

expect_success() {
  local expected="$1" output
  shift
  if ! output="$(run_installer Darwin arm64 1000 "$@" 2>&1)"; then
    printf 'expected installer validation to succeed: %s\n%s\n' "$*" "$output" >&2
    exit 1
  fi
  if [[ "$output" != "$expected" ]]; then
    printf 'unexpected installer validation result for %s\nexpected: %s\nactual:   %s\n' \
      "$*" "$expected" "$output" >&2
    exit 1
  fi
}

expect_linux_success() {
  local expected="$1" output
  shift
  if ! output="$(run_installer Linux amd64 0 "$@" 2>&1)"; then
    printf 'expected Linux installer validation to succeed: %s\n%s\n' "$*" "$output" >&2
    exit 1
  fi
  if [[ "$output" != "$expected" ]]; then
    printf 'unexpected Linux installer validation result for %s\nexpected: %s\nactual:   %s\n' \
      "$*" "$expected" "$output" >&2
    exit 1
  fi
}

# An intentionally invalid release stops execution immediately after listener,
# repository, and release validation, before any installation side effect.
expect_failure '--release must be latest or a safe release tag' --release 'bad tag'
expect_failure '--release must be latest or a safe release tag' \
  --listen-addr '[::]:9180' --release 'bad tag'
expect_failure '--release must be latest or a safe release tag' \
  --listen-addr 'localhost:9180' --release 'bad tag'
expect_failure '--listen-addr may contain only letters, numbers, _, ., /, :, [, ], and -' \
  --listen-addr '0.0.0.0:9180;id' --release v0.4.1

expect_success $'SwarmOps machine-agent installer configuration is valid.\nRelease: v0.4.1\nListener: 0.0.0.0:9180\nAdvertise host: 127.0.0.1\nNo host changes were made.' \
  --validate-only --release v0.4.1 --advertise-host 127.0.0.1 --install-docker --init-swarm
expect_linux_success $'SwarmOps machine-agent installer configuration is valid.\nRelease: v0.4.1\nListener: 0.0.0.0:9180\nAdvertise host: 127.0.0.1\nNo host changes were made.' \
  --validate-only --release v0.4.1 --advertise-host 127.0.0.1 --install-docker --init-swarm

printf 'SwarmOps machine-agent installer validation tests passed.\n'
