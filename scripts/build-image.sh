#!/usr/bin/env bash
set -euo pipefail

mode="${1:?usage: build-image.sh <build|push>}"
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tag="${TAG:?TAG is required}"
registry="${REGISTRY:-ghcr.io}"
namespace="${REGISTRY_NS:-nimasrn}"
platform="${PLATFORM:-linux/amd64}"
requested_target="${TARGET:-}"
targets="${TARGETS:-api agent cli fluentd logs}"

case "$mode" in
  build|push) ;;
  *) echo "unsupported image mode: $mode" >&2; exit 2 ;;
esac

command -v docker >/dev/null || { echo "docker is required" >&2; exit 1; }
[[ -f "$repo_root/Dockerfile" ]] || { echo "missing Dockerfile" >&2; exit 1; }

build_one() {
  local target="$1"
  local image_ref="$registry/$namespace/swarmops-$target:$tag"
  local -a command=(docker build --platform "$platform" --file "$repo_root/Dockerfile" --target "$target" --tag "$image_ref")

  command+=(
    --build-arg "APP_VERSION=$tag"
    --build-arg "VITE_APP_VERSION=$tag"
  )
  command+=("$repo_root")

  printf '>> %s\n' "$image_ref"
  "${command[@]}"
  if [[ "$mode" == "push" ]]; then
    docker push "$image_ref"
  fi
}

if [[ -n "$requested_target" ]]; then
  [[ " $targets " == *" $requested_target "* ]] || {
    echo "TARGET=$requested_target is not a SwarmOps build stage" >&2
    exit 1
  }
  build_one "$requested_target"
else
  for target in $targets; do
    build_one "$target"
  done
fi
