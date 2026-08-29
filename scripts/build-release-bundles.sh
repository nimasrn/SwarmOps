#!/usr/bin/env bash
set -euo pipefail

# Build every supported native, self-updating release asset published by GitHub
# Actions. Each Agent/Core bundle includes its matching Warden updater and a
# checksums.txt file is generated alongside it. Both native installers activate
# these bundles directly; production hosts never need a Go toolchain or source
# checkout.
#
# Agent: Linux (amd64, arm64) and macOS (amd64, arm64)
# Core: Linux (amd64, arm64); Core uses systemd and is the controller/data host.

release_version="${1:-}"
output_dir="${2:-}"

fail() {
  printf 'SwarmOps release build: %s\n' "$*" >&2
  exit 1
}

[[ "$release_version" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'first argument must be a safe release tag'
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

release_build_dir="$(mktemp -d "${TMPDIR:-/tmp}/swarmops-release.XXXXXX")"
cleanup() {
  rm -rf "$release_build_dir"
}
trap cleanup EXIT INT TERM

build_bundle() {
  local component="$1"
  local package_path="$2"
  local executable="$3"
  local operating_system="$4"
  local architecture="$5"
  local stage_dir asset_name

  stage_dir="$release_build_dir/${component}-${operating_system}-${architecture}"
  asset_name="swarmops-${component}_${release_version}_${operating_system}_${architecture}.tar.gz"
  install -d -m 0755 "$stage_dir"
  CGO_ENABLED=0 GOOS="$operating_system" GOARCH="$architecture" \
    go build -trimpath -buildvcs=false -ldflags "-s -w -X main.version=$release_version" \
      -o "$stage_dir/$executable" "$package_path"
  CGO_ENABLED=0 GOOS="$operating_system" GOARCH="$architecture" \
    go build -trimpath -buildvcs=false -ldflags "-s -w -X main.version=$release_version" \
      -o "$stage_dir/swarmops-warden" ./cmd/warden
  chmod 0755 "$stage_dir/$executable" "$stage_dir/swarmops-warden"
  if [[ "$component" == core ]]; then
    install -d -m 0755 "$stage_dir/assets"
    install -m 0444 deploy/observability/alertmanager.yml "$stage_dir/assets/alertmanager.yml"
    install -m 0444 deploy/stacks/swarmops-agent.yml "$stage_dir/assets/agent.yml"
    # Release assets stay within the flat *.yml namespace accepted by every
    # supported pre-0.7 Warden. Fluentd accepts arbitrary config filenames;
    # only the mounted target inside the container needs to remain .conf.
    install -m 0444 deploy/observability/fluentd-aggregator.conf "$stage_dir/assets/fluentd-aggregator.yml"
    install -m 0444 deploy/observability/fluentd-forwarder.conf "$stage_dir/assets/fluentd-forwarder.yml"
    install -m 0444 deploy/observability/jaeger.yml "$stage_dir/assets/jaeger.yml"
    install -m 0444 deploy/stacks/swarmops-logs.yml "$stage_dir/assets/logs.yml"
    install -m 0444 deploy/stacks/swarmops-mongo.yml "$stage_dir/assets/mongo.yml"
    install -m 0444 deploy/stacks/swarmops-observability.yml "$stage_dir/assets/observability.yml"
    install -m 0444 deploy/stacks/swarmops-postgres.yml "$stage_dir/assets/postgres.yml"
    install -m 0444 deploy/observability/prometheus-alerts.yml "$stage_dir/assets/prometheus-alerts.yml"
    install -m 0444 deploy/observability/prometheus.yml "$stage_dir/assets/prometheus.yml"
    install -m 0444 deploy/stacks/swarmops-redis.yml "$stage_dir/assets/redis.yml"
    install -m 0444 deploy/traefik/dynamic.yml "$stage_dir/assets/traefik-dynamic.yml"
    install -m 0444 deploy/stacks/traefik.yml "$stage_dir/assets/traefik.yml"
    tar -C "$stage_dir" -czf "$output_dir/$asset_name" "$executable" swarmops-warden \
      assets/alertmanager.yml assets/agent.yml assets/fluentd-aggregator.yml \
      assets/fluentd-forwarder.yml assets/jaeger.yml assets/logs.yml \
      assets/mongo.yml assets/observability.yml assets/postgres.yml \
      assets/prometheus-alerts.yml assets/prometheus.yml assets/redis.yml \
      assets/traefik-dynamic.yml assets/traefik.yml
  else
    tar -C "$stage_dir" -czf "$output_dir/$asset_name" "$executable" swarmops-warden
  fi
}

agent_platforms=(linux/amd64 linux/arm64 darwin/amd64 darwin/arm64)
for platform in "${agent_platforms[@]}"; do
  operating_system="${platform%/*}"
  architecture="${platform#*/}"
  build_bundle agent ./cmd/agent swarmops-agent "$operating_system" "$architecture"
done

# The Docker-free controller remains a distinct trust boundary from the agent.
# Its bundle allows the same Warden rollout policy on the one machine that owns
# controller state, without giving that process a Docker socket.
core_platforms=(linux/amd64 linux/arm64)
for platform in "${core_platforms[@]}"; do
  operating_system="${platform%/*}"
  architecture="${platform#*/}"
  build_bundle core ./cmd/api swarmops-core "$operating_system" "$architecture"
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

install -m 0755 scripts/install-swarmops-agent.sh "$output_dir/install-swarmops-agent.sh"
install -m 0755 scripts/bootstrap-swarmops-control-plane.sh "$output_dir/install-swarmops-core.sh"
install -m 0755 scripts/repair-swarmops-core-updater.sh "$output_dir/repair-swarmops-core-updater.sh"

printf 'Built SwarmOps %s native release assets in %s\n' "$release_version" "$output_dir"
