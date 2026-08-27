# Docker Swarm platform

This directory is the operational path for the monorepo:

```text
local source ── make build/push ──> GHCR or private registry
                                       │
                               Docker Swarm pulls image only
                                       │
                      deploy/stacks/<stack>.yml + Swarm secrets
```

This source release carries the SwarmOps, Traefik, and observability templates
needed to render and inspect the control plane. Use the
[nim monorepo](https://github.com/nimasrn/nim) for a complete platform rollout:
it owns the reviewed manifests for unrelated applications and the corresponding
operator automation. Publishing this release does not build images, change
servers, or deploy a stack.

`make build` passes its immutable `TAG` to the API and agent binaries as their
reported version. Native GitHub Release bundles are a separate path for a
Docker-free controller or native machine agent; see
[`../docs/Native-Release-Updates.md`](../docs/Native-Release-Updates.md).

Git and these manifests are the source of truth. SwarmOps is the authenticated,
audited control surface for observing node/service state, deploying a bounded
image-only Compose stack, selecting an eligible node, inspecting logs, and
performing fixed-shape service operations. It does not accept arbitrary Docker
commands or replace reviewed Git manifests.

## Target topology

Run all three servers as managers so the control plane retains quorum after one
manager fails. This is a small, cost-conscious cluster, not a promise of
multi-node high availability for stateful services.

| Node | Capacity | Labels | Intended work |
| --- | --- | --- | --- |
| `manager-01` | 4 CPU / 4 GB RAM | `nim.edge=true`, `nim.control=true`, `nim.stateful=true` | Traefik, SwarmOps, and singleton state with an explicit backup/recovery plan |
| `manager-02` | 2 CPU / 2 GB RAM | none initially | second replicas of lightweight web services and general stateless work |
| `manager-03` | 2 CPU / 2 GB RAM | none initially | third manager, stateless work, quorum |

Traefik is deliberately one replica and pinned to `manager-01` because its
local ACME volume is not shared storage. SwarmOps is also a single replica on
that manager (`node.role == manager` and `nim.control=true`): its local
`swarmops_data` volume is the authoritative home for AES-256-GCM-sealed server
profiles, audit history, command metadata/payload, and pending build contexts,
while its API image and mounted configs provide the production console and
reviewed deployment assets. It has no Docker socket.
Operators can run Vite locally as an interface only and proxy it to this API;
they do not run a second local control plane. That makes recovery
straightforward, but a shared ACME store and shared, audited application state
are still required before claiming high availability.

As an alternative, SwarmOps can run on one separate Docker-free controller
host. That host is not a Swarm node and does not carry a Docker socket. Its
direct-TLS bootstrap binds a configured local IP on one random high port and
requires an operator CIDR allowlist; it is not run at the same time as the
manager-bound singleton against a separate data directory.

The product application manifests do **not** bundle MongoDB, Redis, Postgres,
ClamAV, or object storage. Separate reviewed MongoDB and PostgreSQL platform
stacks exist, but the 8 GB reference cluster is still not a safe default for
them. Use managed/existing data services or add capacity and an approved backup
plan before moving stateful data into the swarm. SwarmOps' platform admission
manifest rejects the Mongo three-node, Postgres two-node, Redis Sentinel
three-node, Jitsi, or shared-observability profiles unless their distinct labels
and current capacity are present; it does not pretend the reference topology
can host them.

## Network and firewall prerequisites

| Traffic | Scope |
| --- | --- |
| TCP 2377 | manager-to-manager Swarm control-plane traffic |
| TCP/UDP 7946, UDP 4789 | private traffic between all swarm nodes |
| TCP 80/443 | public traffic to Traefik only |
| One random TCP port from 20000-59999 | direct TLS to a separate SwarmOps controller only; restrict to its configured operator CIDRs |
| One chosen TLS port (9180 default) | SwarmOps machine API on a selected Linux/macOS Docker host; restrict to the controller and pin its certificate |
| SSH | operator access only |

Do not expose 2377, 7946, 4789, Docker's socket, the optional SwarmOps agent
or node-exporter ports, or Traefik's internal metrics port to the public
internet. The direct-controller and explicitly installed machine-agent ports
are deliberate exceptions: restrict both through host/cloud firewall rules.
SwarmOps and Grafana are otherwise reached through Traefik HTTPS routes;
Prometheus, Alertmanager, Jaeger, Loki, and probes stay on internal overlay
networks. The SwarmOps API itself has no Docker socket mount and reaches a
selected remote target only through that target's fixed machine API.

## Automated host and Swarm bootstrap

For a new Debian/Ubuntu cluster, prefer the checked Ansible bootstrap in
[ansible/README.md](ansible/README.md). It installs Docker from the official
APT repository, forms the manager quorum, creates the encrypted traefik
overlay, and applies placement labels. It stops before secrets, DNS/firewall
changes, image pushes, and stack deployment; those remain explicit operator
actions below.

~~~bash
cp deploy/ansible/inventory.example.yml deploy/ansible/inventory.yml
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml --apply
~~~

If the servers are reached with an SSH username and password rather than a
key, run `make swarmops-provision`. It accepts the three addresses and the SSH
user, prompts Ansible for passwords without storing them, creates ignored local
inventory/context files, and can optionally deploy the prepared Traefik and
SwarmOps stacks when the operator supplies protected secret-file paths.

To add a fourth or later fresh server to an existing cluster, add it to the
ignored inventory's `swarm_join_nodes` group and use:

```bash
make swarmops-join-node INVENTORY=deploy/ansible/inventory.yml
make swarmops-join-node INVENTORY=deploy/ansible/inventory.yml APPLY=1
```

The checked workflow probes the host, installs Docker only when needed, refuses
to replace an unknown runtime, joins with its private advertised address, and
applies the reviewed role and labels. A stateful node gets a unique slot label;
see [`../docs/swarmops-stateful.md`](../docs/swarmops-stateful.md) before
assigning MongoDB or PostgreSQL data.

## Remote SwarmOps connection

The production SwarmOps API runs on the designated control manager. An operator
can use its hosted console or run only the Vite UI locally with:

```bash
SWARMOPS_API_URL=https://swarmops.example.com make -C apps/swarmops web-dev
```

The local server proxies browser API requests to the manager; it has no
SwarmOps data directory, Docker dependency, or local API process. Install the
machine agent on each Linux or macOS Docker host from a GitHub Release:

```bash
# Ubuntu/Debian:
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash

# macOS (as the logged-in user, without sudo):
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | bash
```

The installer downloads checksum-verified `swarmops-agent` and
`swarmops-warden` binaries, configures TLS 1.3, and generates its pinned
P-256 TLS identity plus a protected API-key file. The Linux identity is stored
at `/etc/swarmops-agent/tls/agent.crt` and
`/etc/swarmops-agent/tls/agent.key`; macOS uses
`$HOME/.config/swarmops-agent/tls/`. It prints the public certificate
fingerprint and protected file paths, but never prints the key. Warden checks
releases locally every 12 hours, rolls back an unhealthy candidate, and keeps
three known-good versions. The zero-argument Ubuntu/Debian path installs its
host dependencies with package-manager stdin isolated from the streamed
installer. In **Servers**, add the machine's HTTPS origin
without a port, its port, the printed `SHA256:<64-hex>` certificate fingerprint,
and the API key through an approved secure channel. The key is held only in
controller memory while connected and is cleared on disconnect or restart; the
saved profile contains only the display name, API origin/port, authentication
method, and certificate fingerprint.

Swarm service, node, stack, and build operations require Docker and a remote
Swarm manager. A connected Docker host that is not a manager remains visible
but cannot be selected for cluster pages, builds, or Swarm preflight. The
global `swarmops-agent` stack is still a separate read-only overlay probe; do
not expose it as the machine-control endpoint.

### Separate Docker-free controller

The Swarm stack remains the default production topology. If the designated
controller must not run Docker or join a cluster, install the native Core
release on that host instead of deploying the `swarmops` stack:

```bash
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash
```

The bootstrap downloads `swarmops-core` and `swarmops-warden`, then serves the
embedded GUI and API through a generated TLS 1.3 certificate on a random high
port. It confirms the detected controller IP and SSH client network through the
terminal, isolates package-manager stdin from the streamed installer, and
reports safe progress stages. It prints the certificate fingerprint and
generated `operator` password only after its health check succeeds, creates a
dedicated service account with no Docker group, enforces the confirmed client
CIDR in the API, and starts with remote builds and mutations disabled. Core's Warden
follows the same local health/rollback/three-version policy. The random port is
not the security boundary: verify the fingerprint and enforce the same operator
CIDR at the host/cloud firewall.

For unattended provisioning, keep the network policy explicit and propagate a
failed download through the pipeline:

```bash
set -o pipefail
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh \
  | sudo bash -s -- \
  --listen-ip <literal-controller-ip> \
  --allow-cidr <operator-device-ip>/32 \
  --install-dependencies \
  --generate-admin-password
```

Server profiles, audit history, command metadata/payload, and pending build
contexts are AES-256-GCM sealed in `/var/lib/swarmops`. The unrelated
data-encryption key lives under
`/etc/swarmops`, so it must be backed up separately and protected like a
secret. Machine API keys are never persisted by the controller. Do not run this
controller at the same time as the manager-bound SwarmOps service: choose one
authoritative API and data directory. Keep any reviewed, non-secret
platform-admission manifest on that host too and set
`SWARMOPS_PLATFORM_MANIFEST_FILE` to it when browser deployments are enabled;
the repository sample is not a production manifest.

For CLI calls to the authenticated API, pass that visible server profile ID:

```bash
go run ./apps/swarmops/cmd/swarmopsctl preflight \
  --manifest deploy/swarmops/platform.example.yml \
  --url https://swarmops.example.com --username operator --server-id <server-id>
```

## One-time bootstrap (manual equivalent)

Create one ignored host file per server from the committed template:

```bash
cp deploy/hosts/example.env deploy/hosts/manager-01.env
cp deploy/hosts/example.env deploy/hosts/manager-02.env
cp deploy/hosts/example.env deploy/hosts/manager-03.env

make context HOST=manager-01
make context HOST=manager-02
make context HOST=manager-03
```

Initialize the first manager using its private, node-to-node address:

```bash
make swarm-init HOST=manager-01 ADVERTISE_ADDR=10.0.0.11
```

Join the other two servers as **managers** with the current join command from
`manager-01`. Keep that short-lived join token out of Git, chat logs, and
host files. Then create the encrypted edge network and label the designated
edge/control node:

```bash
make swarm-network HOST=manager-01
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=nim.edge VALUE=true
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=nim.control VALUE=true
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=nim.stateful VALUE=true
```

Before the first platform deploy, create the required secrets from
permission-restricted local files that are outside the repository:

```bash
umask 077
openssl rand -base64 32 > /secure/swarmops-data-key.base64

make secret-create HOST=manager-01 \
  SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 \
  SECRET=traefik_arvan_api_key_v1 FILE=/secure/traefik-arvan-api-key

make secret-create HOST=manager-01 \
  SECRET=traefik_dashboard_auth_v1 FILE=/secure/traefik-dashboard.htpasswd
make secret-create HOST=manager-01 \
  SECRET=swarmops_admin_password_hash_v1 FILE=/secure/swarmops-admin.bcrypt
make secret-create HOST=manager-01 \
  SECRET=swarmops_session_key_v1 FILE=/secure/swarmops-session-key
make secret-create HOST=manager-01 \
  SECRET=swarmops_data_encryption_key_v1 FILE=/secure/swarmops-data-key.base64
make secret-create HOST=manager-01 \
  SECRET=swarmops_agent_token_v1 FILE=/secure/swarmops-agent-token
make secret-create HOST=manager-01 \
  SECRET=swarmops_registry_config_v1 FILE=/secure/swarmops-registry-config.json
make secret-create HOST=manager-01 \
  SECRET=swarmops_grafana_admin_password_v1 FILE=/secure/grafana-admin-password

# This is public topology only. It becomes the immutable admission contract
# mounted into SwarmOps; do not put secret values in this file.
make swarmops-preflight MANIFEST=/secure/swarmops-platform.yml
make config-create HOST=manager-01 \
  CONFIG=swarmops_platform_manifest_v1 FILE=/secure/swarmops-platform.yml

make secret-create HOST=manager-01 \
  SECRET=ai_gateway_config_v1 FILE=/secure/ai-gateway.production.json
```

Set non-secret deployment settings such as `TRAEFIK_ACME_EMAIL`,
`SWARMOPS_HOST`, `GRAFANA_HOST`, `TRAEFIK_DASHBOARD_HOST`, and
`TRAEFIK_DASHBOARD_URL` in the ignored `deploy/hosts/manager-01.env`. Build and
push the immutable SwarmOps API and agent images, then validate and deploy
Traefik before SwarmOps:

```bash
make push APP=swarmops TARGET=api TAG=<git-sha>
make push APP=swarmops TARGET=agent TAG=<git-sha>
make stack-check STACK=traefik TAG=<git-sha>
make stack-check STACK=swarmops TAG=<git-sha>
make platform-deploy HOST=manager-01 TAG=<git-sha>
```

`platform-deploy` refuses a dirty worktree and always deploys Traefik first.
It does not create secrets, configs, change DNS, or open firewalls. The
interactive provisioner performs the manifest preflight and immutable config
creation before it calls this deployment step.

## Everyday image and stack workflow

```bash
# Build locally; this never talks to a server.
make build APP=vlora-web TAG=<git-sha>

# Login interactively, then build and push an immutable image.
make registry-login
make push APP=vlora-web TAG=<git-sha>

# Validate the fully rendered Swarm manifest.
make stack-check STACK=vlora-web TAG=<git-sha>

# Deploy one stack only. Server-side builds are never used.
make deploy STACK=vlora-web HOST=manager-01 TAG=<git-sha>

# Operate one service without changing its manifest.
make ps HOST=manager-01 STACK=vlora-web
make logs HOST=manager-01 STACK=vlora-web SERVICE=vlora-web
make scale HOST=manager-01 STACK=vlora-web SERVICE=vlora-web REPLICAS=1
make rollback HOST=manager-01 STACK=vlora-web SERVICE=vlora-web
```

Each app owns its pinned build stage. The Vlora app currently uses Node 24 for
its lockfile-compatible build stage and Nginx only for its static runtime.

Use `make build-all`, `make push-all`, and `make stack-check-all` only for a
deliberate broad release. The `push` and `deploy` commands reject a dirty
worktree so an image and its manifest can be traced back to a committed SHA.

## Secrets and configuration

Build arguments are public by definition: the browser can read any Vite value
baked into a frontend bundle. `scripts/build-image.sh` rejects names that look
like secrets and derives the application version from `TAG`.

Runtime configuration is a versioned Swarm secret, never an image layer,
`deploy/hosts/*.env` file, or stack literal:

| Stack | Secret name default | Mount / consumption |
| --- | --- | --- |
| `traefik` | `traefik_cf_dns_token_v1`, `traefik_arvan_api_key_v1`, `traefik_dashboard_auth_v1` | Cloudflare token via `CF_DNS_API_TOKEN_FILE`, ArvanCloud API key via `ARVANCLOUD_API_KEY_FILE`, protected dashboard auth file |
| `swarmops` | `swarmops_admin_password_hash_v1`, `swarmops_session_key_v1`, `swarmops_data_encryption_key_v1`, `swarmops_agent_token_v1`, `swarmops_registry_config_v1` | bcrypt operator hash, session HMAC key, and a base64-encoded random 32-byte AES-256-GCM data key for the API; node-agent token for the optional agent; standard Docker `config.json` for capped remote Engine builds only. Private stack pulls use reviewed credentials on the remote Swarm nodes. |
| `swarmops-agent` | `swarmops_agent_token_v1` | Optional global read-only host inventory agent; the companion node-exporter has no credential and remains internal |
| `swarmops-observability` | `swarmops_grafana_admin_password_v1` | Grafana administrator password file; Alertmanager uses a checked-in blackhole receiver until an operator supplies a reviewed, credential-safe receiver config |
| `ai-gateway` | `ai_gateway_config_v1` | `/run/secrets/ai_gateway_config` via `AI_GATEWAY_CONFIG_FILE` |
| `vlora-backend` | `vlora_runtime_env_v1` | `/.env` for API and scan worker |
| `iranianlawclub-backend` | `iranianlawclub_runtime_env_v1` | `/app/.env` for API and worker |
| `reelforge` | `reelforge_runtime_env_v1` | `/app/.env` for API and worker |
| `fatemifar-go` | `fatemifar_runtime_env_v1` | `/usr/src/app/.env` for the API |
| `fa-backend` | `fa_backend_env_v1` | env file for the Mongo-only API (MONGO_URI, JWT, SMS, Zarinpal) |

The native machine agent's API key is a protected host file created or copied
by `scripts/install-swarmops-agent.sh`; it is not a Swarm secret and is never
persisted by the controller. The `swarmops_agent_token_v1` secret remains only
for the separate global read-only inventory stack.

To rotate a secret, create `*_v2`, set the corresponding non-secret
`*_RUNTIME_ENV_SECRET` override in the host file, deploy the affected stack,
verify every task, and only then remove the unused old secret. Never overwrite
a secret name in place.

Docker Swarm configs are immutable too. The `swarmops` core stack creates the
versioned config objects consumed by its optional agent, logs, and monitoring
stacks. When changing one of those checked-in config assets, bump the matching
`SWARMOPS_*_CONFIG_NAME` value in the ignored host file (the full list is in
`hosts/example.env`), validate `swarmops`, deploy that core stack, and then
reconcile the affected optional stack. Keep the former config until every task
using it has converged; never overwrite a config name in place.

The direct Docker socket mount required by Traefik's Swarm provider remains a
high-trust boundary. SwarmOps has no equivalent API socket mount: each target
is reached through a pinned TLS machine API using an operator-supplied API key
held only in memory. Restrict manager access, the machine-agent listener,
certificate pinning, API-key distribution, and host firewalls accordingly. The
optional read-only agent, node-exporter, and Alloy log collector still mount
host paths for inventory/metrics/log collection; they expose no arbitrary
command or file endpoint.

## Platform admission, durable fleet jobs, and backups

Before a build or deployment, validate a non-secret platform manifest. It
checks global names/domains within the selected namespace, registry selection,
certificate/DNS resolver choice, required S3 provider references, Jitsi ingress
IP, resource reservations, and stateful anti-affinity:

```bash
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml
make swarmops-checked-build MANIFEST=deploy/swarmops/platform.example.yml APP=swarmops TARGET=api TAG=<immutable-tag>
```

Once SwarmOps is healthy, use `swarmopsctl preflight --url ... --username ...`
with `--server-id <id>` to compare the same plan to the selected authenticated
remote manager's live node inventory. That mode does not mutate a host,
registry, DNS provider, or S3 provider. It blocks a plan if live node state,
expected labels, physical capacity, free memory, or free disk no longer meets
the declared facts; unavailable free-memory/free-disk evidence fails closed.

The browser deployment endpoint accepts only `application` profile workloads
from that mounted namespace manifest. MongoDB, PostgreSQL, and shared
observability profiles are deployed only from their reviewed Git stacks, so a
browser request cannot replace a replica-set or recovery contract with an
arbitrary Compose document. Browser routing is limited to namespaced
`websecure` HTTP routers for the workload's declared domain and resolver;
external secrets, configs, and volumes need a physical name beginning with the
exact stack name, and `traefik` is the sole allowable external network. Its
services remain replicated and cannot exceed the reviewed workload's combined
replica, CPU-reservation, or memory-reservation budget.

For a post-bootstrap deployment, `make swarmops-checked-deploy` requires the
same manifest plus `SWARMOPS_URL`, `SWARMOPS_USERNAME`, `SWARMOPS_SERVER_ID`,
`STACK`, and `HOST`; it runs a fresh authenticated admission and `stack-check`
before it reaches the normal deploy command. Use
`swarmops-checked-platform-deploy` for the initial offline Traefik/SwarmOps
bootstrap.

Run the reviewed all-node operations from the trusted workstation:

```bash
make swarmops-fleet-run INVENTORY=deploy/ansible/inventory.yml OPERATION=node-health-report
make swarmops-fleet-status INVENTORY=deploy/ansible/inventory.yml RUN_ID=fleet-<generated-id>
```

The first command queues a host-local transient systemd unit so accepted work
survives a dropped Ansible connection. The CLI re-submits the same run ID up to
eight times with 2, 4, 8, 16, 32, and 64 second backoff, while the host runner
persists its own bounded attempts and retry schedule in the fixed status file.
The second is the dependable SSH status path for remote-server operation; no
path permits arbitrary commands or returns operation output.

To protect local named volumes at every selected host, install the opt-in
Restic S3-compatible timer with a protected controller-side file, then
explicitly initialise only a confirmed empty repository:

```bash
make swarmops-backup-install INVENTORY=deploy/ansible/inventory.yml BACKUP_ENV_FILE=/secure/swarmops-restic-s3.env
make swarmops-backup-init INVENTORY=deploy/ansible/inventory.yml
```

All hosts share the reviewed repository but snapshot/retention filtering is
host-specific and repository locks are retried. Declare every intentional
local bind-mount data root in `swarmops_backup_paths`; the timer is not a substitute for MongoDB/Postgres-consistent backups or a
tested restore. Do not schedule replica databases in the Swarm until their
logical backup/recovery runbook and capacity proof exist.

After a server reconnect or reboot, run the non-mutating continuity check:

```bash
make swarmops-recovery-check INVENTORY=deploy/ansible/inventory.yml
```

It verifies Docker, Swarm membership, local volume-root continuity, optional
backup-timer state, and manager visibility. Set a stateful host's exact volume
names in `swarmops_recovery_expected_volumes` in the ignored inventory to make
the read-only check fail if a required local volume is gone. It never restores
data. The stateful deployment and restore boundaries are in
[`../docs/swarmops-stateful.md`](../docs/swarmops-stateful.md).

## Stack readiness and cutover scope

| Stack family | Manifest status | Cutover condition |
| --- | --- | --- |
| `traefik`, `swarmops`, `nim`, `ai-gateway` | ready for operator deployment | platform bootstrap, required secrets, immutable image push, and live checks completed |
| `swarmops-agent`, `swarmops-observability`, `swarmops-logs` | optional host monitoring, shared monitoring, and logging manifests | enable only after capacity, Grafana secret, retention, alert receiver, and backup plan are reviewed |
| `mongo-replicaset`, `postgres-primary-replica` | reviewed stateful manifests | only after distinct durable slot labels, live capacity admission, versioned database secrets, and tested database-consistent recovery |
| `vlora-*` | Swarm manifests are ready; existing project Compose path remains live | validate Mongo/Redis/S3, payment callbacks, CORS, Android/PWA behavior, DNS |
| `iranianlawclub-*` | Swarm manifests are ready; existing Compose path remains live | supply Mongo/Redis/S3/ClamAV, seed/migration plan, DNS and auth smoke tests |
| `reelforge` | API/worker manifest ready; no standalone web-image contract has been added | supply hostname, data stores, rendering capacity, and scoped gateway token |
| `fatemifar-*`, `fa-app`, `fa-admin`, `fa-backend` | staged manifests only; Liara remains the live deployment | Postgres→Mongo import run, payment/SMS/OAuth callbacks, DNS and rollback approval (see docs/products/fatemifar.md) |

No production cutover is performed by these files or by the commands above.
See [`../docs/swarm-platform.md`](../docs/swarm-platform.md) for the architecture
and release checklist.
