.PHONY: help local dev dev-api dev-agent test integration web-build web-dev

help:
	@printf '%s\n' \
	  'Local: make local      # Core and console' \
	  '       make dev-agent  # host machine agent only' \
	  '       make dev        # Core and console' \
	  '       make dev-api    # Core only; prepares a persistent local identity' \
	  'Checks: make test | make integration | make web-build'

local:
	@set -eu; \
	  command -v curl >/dev/null 2>&1 || { echo 'curl is required for make local'; exit 1; }; \
	  dev_root="$${SWARMOPS_DEV_DIR:-$${TMPDIR:-/tmp}/swarmops-dev}"; \
	  export SWARMOPS_DEV_DIR="$$dev_root"; \
	  $(MAKE) --no-print-directory dev

dev:
	@set -eu; \
	  command -v curl >/dev/null 2>&1 || { echo 'curl is required for make dev'; exit 1; }; \
	  api_addr="$${SWARMOPS_LISTEN_ADDR:-127.0.0.1:8084}"; \
	  case "$$api_addr" in 127.0.0.1:[0-9]*) ;; *) echo 'make dev requires SWARMOPS_LISTEN_ADDR to use 127.0.0.1:<port>'; exit 1;; esac; \
	  SWARMOPS_LISTEN_ADDR="$$api_addr" $(MAKE) --no-print-directory dev-api & api_pid=$$!; \
	  cleanup() { \
	    kill_tree() { local pid="$${1:-}" child children; children="$$(pgrep -P "$$pid" 2>/dev/null || true)"; for child in $$children; do kill_tree "$$child"; done; kill "$$pid" >/dev/null 2>&1 || true; }; \
	    kill_tree "$$api_pid"; \
	    wait "$$api_pid" >/dev/null 2>&1 || true; \
	  }; \
	  trap cleanup EXIT; \
	  attempts=0; \
	  until curl --fail --silent --max-time 1 "http://$$api_addr/healthz" >/dev/null; do \
	    if ! kill -0 "$$api_pid" 2>/dev/null; then wait "$$api_pid"; exit 1; fi; \
	    attempts=$$((attempts + 1)); \
	    if [ "$$attempts" -ge 100 ]; then echo "local SwarmOps API did not become healthy on $$api_addr"; exit 1; fi; \
	    sleep 0.2; \
	  done; \
	  $(MAKE) --no-print-directory web-dev

dev-api:
	@set -eu; \
	  dev_root="$${SWARMOPS_DEV_DIR:-$${TMPDIR:-/tmp}/swarmops-dev}"; \
	  SWARMOPS_DEV_DIR="$$dev_root" bash scripts/run-dev-machine-agent.sh --prepare; \
	  if [ -n "$${SWARMOPS_DEV_SESSION_KEY:-}" ]; then session_key="$${SWARMOPS_DEV_SESSION_KEY}"; else session_key="$$(tr -d '[:space:]' <"$$dev_root/core-session-key")"; fi; \
	  SWARMOPS_INSECURE_DEV_AUTH=true \
	  SWARMOPS_SECURE_COOKIES=false \
	  SWARMOPS_ADMIN_USERNAME=admin \
	  SWARMOPS_DEV_PASSWORD_HASH= \
	  SWARMOPS_DEV_SESSION_KEY="$$session_key" \
	  SWARMOPS_DATA_DIR="$${SWARMOPS_DATA_DIR:-$$dev_root/core}" \
	  SWARMOPS_SOURCE_ENABLED="$${SWARMOPS_SOURCE_ENABLED:-true}" \
	  SWARMOPS_LISTEN_ADDR="$${SWARMOPS_LISTEN_ADDR:-127.0.0.1:8084}" \
	  SWARMOPS_DEV_MACHINE_API_CERT_FILE="$${SWARMOPS_DEV_MACHINE_API_CERT_FILE:-$$dev_root/machine-agent/tls.crt}" \
	  SWARMOPS_DEV_MACHINE_API_KEY_FILE="$${SWARMOPS_DEV_MACHINE_API_KEY_FILE:-$$dev_root/machine-agent/api-key}" \
	  SWARMOPS_DEV_MACHINE_API_NAME="$${SWARMOPS_DEV_MACHINE_API_NAME:-Local machine}" \
	  SWARMOPS_DEV_MACHINE_API_PORT="$${SWARMOPS_DEV_MACHINE_API_PORT:-9180}" \
	  SWARMOPS_DEV_MACHINE_API_URL="$${SWARMOPS_DEV_MACHINE_API_URL:-https://127.0.0.1}" \
	  go run ./cmd/api

dev-agent:
	@bash scripts/run-dev-machine-agent.sh

test:
	npm --prefix web test
	go test ./...

# This lane is deliberately opt-in: it creates and leaves a one-node Swarm on
# the selected local Docker Engine, and refuses an Engine that is already in a
# Swarm. The test itself removes only its uniquely named test resources.
integration:
	@test "$${SWARMOPS_INTEGRATION_DOCKER:-}" = 1 || { echo 'set SWARMOPS_INTEGRATION_DOCKER=1 to run the disposable Docker Swarm integration test'; exit 2; }
	go test -tags=integration ./api/http -run TestDockerSwarmCommandLifecycle -count=1

web-build:
	npm --prefix web run typecheck
	npm --prefix web run build

web-dev:
	npm --prefix web run dev
