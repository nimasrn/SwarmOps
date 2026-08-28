# SwarmOps open-source build and Docker Swarm workflow.

REGISTRY    ?= ghcr.io
REGISTRY_NS ?= nimasrn
TAG         ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
PLATFORM    ?= linux/amd64
TARGETS     := api agent cli fluentd logs
STACKS      := traefik swarmops swarmops-agent swarmops-observability swarmops-logs swarmops-postgres swarmops-mongo swarmops-redis

.PHONY: help test web-build web-dev local dev dev-api dev-agent build push registry-login context swarm-init swarm-network \
	swarm-label secret-create secret-list stack-check stack-check-all deploy \
	platform-deploy swarmops-provision swarmops-native-api swarmops-native-bootstrap ps service-ps logs scale rollback docs-check clean-worktree

help:
	@printf '%s\n' \
	  'Build:    make build [TARGET=api|agent|cli|fluentd|logs] [TAG=<immutable-tag>]' \
	  'Push:     make registry-login && make push [TARGET=api|agent|cli|fluentd|logs]' \
	  'Validate: make test | make stack-check STACK=<stack>' \
	  'Local:    make local      # Core and console' \
	  'Dev:      make dev-agent  # host machine agent only' \
	  '          make dev        # Core and console' \
	  '          make dev-api    # Core only; prepares a persistent local identity' \
	  'Deploy:   make deploy STACK=<stack> HOST=<host>' \
	  'Platform: make platform-deploy HOST=<host>  # Traefik, then SwarmOps' \
	  'Bootstrap: make swarmops-provision' \
	  'Native:   make swarmops-native-api  # no Docker; requires protected secret-file env vars' \
	  'Secrets:  make secret-create HOST=<manager> SECRET=<versioned-name> FILE=<secure-file>'

test:
	go test ./...

web-build:
	npm --prefix web run typecheck
	npm --prefix web run build

web-dev:
	npm --prefix web run dev

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

clean-worktree:
	@test -z "$$(git status --porcelain)" || { \
	  echo 'refusing to push or deploy from a dirty worktree; commit or stash first'; exit 1; }

build:
	@TAG='$(TAG)' REGISTRY='$(REGISTRY)' REGISTRY_NS='$(REGISTRY_NS)' \
	  PLATFORM='$(PLATFORM)' TARGET='$(TARGET)' TARGETS='$(TARGETS)' \
	  bash scripts/build-image.sh build

push: clean-worktree
	@TAG='$(TAG)' REGISTRY='$(REGISTRY)' REGISTRY_NS='$(REGISTRY_NS)' \
	  PLATFORM='$(PLATFORM)' TARGET='$(TARGET)' TARGETS='$(TARGETS)' \
	  bash scripts/build-image.sh push

registry-login:
	@docker login '$(REGISTRY)'

deploy: clean-worktree
ifndef STACK
	$(error set STACK=<one of: $(STACKS)>)
endif
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
	@HOST='$(HOST)' STACK='$(STACK)' TAG='$(TAG)' REGISTRY='$(REGISTRY)' \
	  REGISTRY_NS='$(REGISTRY_NS)' PRUNE='$(PRUNE)' bash scripts/swarm.sh deploy

ps:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef STACK
	$(error set STACK=<stack>)
endif
	@HOST='$(HOST)' STACK='$(STACK)' bash scripts/swarm.sh ps

service-ps:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef STACK
	$(error set STACK=<stack>)
endif
ifndef SERVICE
	$(error set SERVICE=<service>)
endif
	@HOST='$(HOST)' STACK='$(STACK)' SERVICE='$(SERVICE)' bash scripts/swarm.sh service-ps

logs:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef STACK
	$(error set STACK=<stack>)
endif
ifndef SERVICE
	$(error set SERVICE=<service>)
endif
	@HOST='$(HOST)' STACK='$(STACK)' SERVICE='$(SERVICE)' TAIL='$(TAIL)' bash scripts/swarm.sh logs

scale:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef STACK
	$(error set STACK=<stack>)
endif
ifndef SERVICE
	$(error set SERVICE=<service>)
endif
ifndef REPLICAS
	$(error set REPLICAS=<count>)
endif
	@HOST='$(HOST)' STACK='$(STACK)' SERVICE='$(SERVICE)' REPLICAS='$(REPLICAS)' bash scripts/swarm.sh scale

rollback:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef STACK
	$(error set STACK=<stack>)
endif
ifndef SERVICE
	$(error set SERVICE=<service>)
endif
	@HOST='$(HOST)' STACK='$(STACK)' SERVICE='$(SERVICE)' bash scripts/swarm.sh rollback

stack-check:
ifndef STACK
	$(error set STACK=<one of: $(STACKS)>)
endif
	@case ' $(STACKS) ' in *' $(STACK) '*) ;; *) echo 'unknown STACK=$(STACK)'; exit 1;; esac
	@STACK='$(STACK)' TAG='$(TAG)' REGISTRY='$(REGISTRY)' REGISTRY_NS='$(REGISTRY_NS)' \
	  bash scripts/swarm.sh stack-config

stack-check-all:
	@for stack in $(STACKS); do \
	  $(MAKE) --no-print-directory stack-check STACK=$$stack TAG='$(TAG)' || exit 1; \
	done

platform-deploy: clean-worktree
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
	@$(MAKE) --no-print-directory deploy STACK=traefik HOST='$(HOST)' TAG='$(TAG)'
	@$(MAKE) --no-print-directory deploy STACK=swarmops HOST='$(HOST)' TAG='$(TAG)'

swarmops-provision:
	@bash scripts/provision-swarmops.sh

swarmops-native-api:
	@bash scripts/run-swarmops-api.sh

swarmops-native-bootstrap:
ifndef LISTEN_IP
	$(error set LISTEN_IP=<literal IP configured on the controller host>)
endif
ifndef ALLOW_CIDR
	$(error set ALLOW_CIDR=<operator CIDR; repeat with comma-separated values if needed>)
endif
	@if [ "$(INSTALL_DEPS)" = 1 ]; then \
	  bash scripts/bootstrap-swarmops-control-plane.sh --listen-ip '$(LISTEN_IP)' --allow-cidr '$(ALLOW_CIDR)' --install-dependencies; \
	else \
	  bash scripts/bootstrap-swarmops-control-plane.sh --listen-ip '$(LISTEN_IP)' --allow-cidr '$(ALLOW_CIDR)'; \
	fi

context:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
	@HOST='$(HOST)' bash scripts/swarm.sh context

swarm-init:
ifndef HOST
	$(error set HOST=<host> for deploy/hosts/<host>.env)
endif
ifndef ADVERTISE_ADDR
	$(error set ADVERTISE_ADDR=<node-private-ip>)
endif
	@HOST='$(HOST)' ADVERTISE_ADDR='$(ADVERTISE_ADDR)' bash scripts/swarm.sh init

swarm-network:
ifndef HOST
	$(error set HOST=<manager host>)
endif
	@HOST='$(HOST)' bash scripts/swarm.sh network

swarm-label:
ifndef HOST
	$(error set HOST=<manager host>)
endif
ifndef NODE
	$(error set NODE=<swarm node hostname>)
endif
ifndef LABEL
	$(error set LABEL=<key>)
endif
ifndef VALUE
	$(error set VALUE=<value>)
endif
	@HOST='$(HOST)' NODE='$(NODE)' LABEL='$(LABEL)' VALUE='$(VALUE)' bash scripts/swarm.sh label

secret-create:
ifndef HOST
	$(error set HOST=<manager host>)
endif
ifndef SECRET
	$(error set SECRET=<versioned-secret-name>)
endif
ifndef FILE
	$(error set FILE=<local secure file path>)
endif
	@HOST='$(HOST)' SECRET='$(SECRET)' FILE='$(FILE)' bash scripts/swarm.sh secret-create

secret-list:
ifndef HOST
	$(error set HOST=<manager host>)
endif
	@HOST='$(HOST)' bash scripts/swarm.sh secret-list

docs-check:
	@test -f README.md
	@test -f LICENSE
	@test -f NOTICE
	@test -f SECURITY.md
	@test -f deploy/README.md
	@test -f deploy/ansible/README.md
	@test -f deploy/hosts/example.env
	@for stack in $(STACKS); do test -f deploy/stacks/$$stack.yml || exit 1; done
