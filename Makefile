# SwarmOps open-source build and Docker Swarm workflow.

REGISTRY    ?= ghcr.io
REGISTRY_NS ?= nimasrn
TAG         ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo dev)
PLATFORM    ?= linux/amd64
TARGETS     := api agent cli
STACKS      := traefik swarmops swarmops-observability swarmops-logs

.PHONY: help test web-build build push registry-login context swarm-init swarm-network \
	swarm-label secret-create secret-list stack-check stack-check-all deploy \
	platform-deploy swarmops-provision ps service-ps logs scale rollback docs-check clean-worktree

help:
	@printf '%s\n' \
	  'Build:    make build [TARGET=api|agent|cli] [TAG=<immutable-tag>]' \
	  'Push:     make registry-login && make push [TARGET=api|agent|cli]' \
	  'Validate: make test | make stack-check STACK=<stack>' \
	  'Deploy:   make deploy STACK=<stack> HOST=<host>' \
	  'Platform: make platform-deploy HOST=<host>  # Traefik, then SwarmOps' \
	  'Bootstrap: make swarmops-provision' \
	  'Secrets:  make secret-create HOST=<manager> SECRET=<versioned-name> FILE=<secure-file>'

test:
	go test ./...

web-build:
	npm --prefix web run typecheck
	npm --prefix web run build

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
