#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
installer="${1:-$script_dir/install-swarmops-agent.sh}"
[[ -f "$installer" ]] || { printf 'installer not found: %s\n' "$installer" >&2; exit 1; }
test_root="$(mktemp -d "${TMPDIR:-/tmp}/swarmops-agent-installer-test.XXXXXX")"
trap 'rm -rf "$test_root"' EXIT

mkdir -p "$test_root/bin" "$test_root/home"
printf '%s\n' '#!/usr/bin/env bash' "printf 'Darwin\\n'" >"$test_root/bin/uname"
printf '%s\n' '#!/usr/bin/env bash' "printf '1000\\n'" >"$test_root/bin/id"
chmod 0755 "$test_root/bin/uname" "$test_root/bin/id"

expect_failure() {
  local expected="$1" output
  shift
  if output="$(PATH="$test_root/bin:$PATH" HOME="$test_root/home" bash "$installer" "$@" 2>&1)"; then
    printf 'expected installer validation to fail: %s\n' "$*" >&2
    exit 1
  fi
  if [[ "$output" != "SwarmOps machine-agent install: $expected" ]]; then
    printf 'unexpected installer validation result for %s\nexpected: %s\nactual:   %s\n' \
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

printf 'SwarmOps machine-agent installer validation tests passed.\n'
