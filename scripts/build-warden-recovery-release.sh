#!/usr/bin/env bash
set -euo pipefail

# Build dedicated Warden recovery bundles. The matching GitHub release is a
# prerelease so /releases/latest continues to select a complete Core/Agent
# release rather than this updater-only artifact.

release_tag="${1:-}"
output_dir="${2:-}"

fail() {
  printf 'SwarmOps Warden release build: %s\n' "$*" >&2
  exit 1
}

[[ "$release_tag" =~ ^warden-v[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'first argument must be a safe warden-v release tag'
[[ -n "$output_dir" ]] || fail 'second argument must be an empty output directory'
[[ "$output_dir" == /* && "$output_dir" != / ]] || fail 'output directory must be an absolute, non-root path'

if [[ -e "$output_dir" ]]; then
  [[ -d "$output_dir" ]] || fail 'output path exists and is not a directory'
  [[ -z "$(find "$output_dir" -mindepth 1 -maxdepth 1 -print -quit)" ]] || fail 'output directory must be empty'
else
  install -d -m 0755 "$output_dir"
fi

for required in go tar; do
  command -v "$required" >/dev/null 2>&1 || fail "$required is required"
done

build_dir="$(mktemp -d "${TMPDIR:-/tmp}/swarmops-warden-release.XXXXXX")"
cleanup() {
  rm -rf -- "$build_dir"
}
trap cleanup EXIT INT TERM

for architecture in amd64 arm64; do
  stage_dir="$build_dir/linux-$architecture"
  asset_name="swarmops-warden_${release_tag}_linux_${architecture}.tar.gz"
  install -d -m 0755 "$stage_dir"
  CGO_ENABLED=0 GOOS=linux GOARCH="$architecture" \
    go build -trimpath -buildvcs=false -ldflags "-s -w -X main.version=$release_tag" \
      -o "$stage_dir/swarmops-warden" ./cmd/warden
  chmod 0755 "$stage_dir/swarmops-warden"
  tar -C "$stage_dir" -czf "$output_dir/$asset_name" swarmops-warden
done

if command -v sha256sum >/dev/null 2>&1; then
  (
    cd "$output_dir"
    LC_ALL=C sha256sum -- *.tar.gz > checksums.txt
  )
elif command -v shasum >/dev/null 2>&1; then
  (
    cd "$output_dir"
    LC_ALL=C shasum -a 256 -- *.tar.gz > checksums.txt
  )
else
  fail 'sha256sum or shasum is required'
fi

install -m 0755 scripts/repair-swarmops-core-updater.sh "$output_dir/repair-swarmops-core-updater.sh"
printf 'Built SwarmOps Warden %s recovery assets in %s\n' "$release_tag" "$output_dir"
