#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
installer="${1:-$script_dir/install-swarmops-agent.sh}"
[[ -f "$installer" ]] || { printf 'installer not found: %s\n' "$installer" >&2; exit 1; }
bash -n "$installer"

test_root="$(mktemp -d "${TMPDIR:-/tmp}/swarmops-agent-installer-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT
mkdir -p "$test_root/bin" "$test_root/home"
printf '%s\n' '#!/usr/bin/env bash' \
  'case "${1:-}" in' \
  "  -s) printf '%s\\n' \"\${SWARMOPS_TEST_OS:-Darwin}\" ;;" \
  "  *) printf '%s\\n' \"\${SWARMOPS_TEST_OS:-Darwin}\" ;;" \
  'esac' >"$test_root/bin/uname"
printf '%s\n' '#!/usr/bin/env bash' "printf '%s\\n' \"\${SWARMOPS_TEST_UID:-1000}\"" >"$test_root/bin/id"
chmod 0755 "$test_root/bin/uname" "$test_root/bin/id"

run_installer() {
  local os_name="$1" uid="$2"
  shift 2
  SWARMOPS_TEST_OS="$os_name" SWARMOPS_TEST_UID="$uid" \
    PATH="$test_root/bin:$PATH" HOME="$test_root/home" bash "$installer" "$@"
}

expect_failure() {
  local os_name="$1" uid="$2" expected="$3" output
  shift 3
  if output="$(run_installer "$os_name" "$uid" "$@" 2>&1)"; then
    printf 'expected installer validation to fail: %s\n' "$*" >&2
    exit 1
  fi
  if [[ "$output" != "SwarmOps machine-agent install: $expected" ]]; then
    printf 'unexpected installer validation result for %s\nexpected: %s\nactual:   %s\n' \
      "$*" "$expected" "$output" >&2
    exit 1
  fi
}

help="$(run_installer Darwin 1000 --help)"
for required in '--core <https-url>' '--enrollment-code <code>' '--defer-docker' '--no-auto-update'; do
  [[ "$help" == *"$required"* ]] || { printf 'installer help is missing %s\n' "$required" >&2; exit 1; }
done

expect_failure Darwin 1000 'unknown option: --unknown' --unknown
expect_failure Darwin 1000 '--core must be one HTTPS origin without whitespace' --core http://core.example.com
expect_failure Darwin 1000 '--enrollment-code requires --core' --enrollment-code 0123456789abcdef0123456789abcdef0123456789abcdef
expect_failure Darwin 1000 '--enrollment-code is invalid' --core https://core.example.com --enrollment-code invalid
expect_failure Darwin 1000 '--listen-addr may contain only letters, numbers, _, ., /, :, [, ], and -' --listen-addr '0.0.0.0:9180;id'
expect_failure Linux 1000 'run this command with sudo on Linux' --core https://core.example.com
expect_failure Darwin 0 'run this command as the logged-in Docker Desktop user on macOS, without sudo' --core https://core.example.com
expect_failure Linux 0 '--defer-docker cannot be combined with --install-docker or --init-swarm' --core https://core.example.com --defer-docker --install-docker

printf 'SwarmOps machine-agent installer validation tests passed.\n'
