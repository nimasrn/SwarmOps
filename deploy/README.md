# Docker Swarm platform

This directory is the operational path for the SwarmOps control plane:

```text
SwarmOps source ── make build/push ──> GHCR or private registry
                                       │
                               Docker Swarm pulls image only
                                       │
                      deploy/stacks/<stack>.yml + Swarm secrets
```

This source release carries the SwarmOps, Traefik, observability, and reviewed
managed PostgreSQL/MongoDB/Redis templates needed to render and inspect the
control plane. Each application repository owns its own image build,
`deploy/stacks/<app>.yml`, and public build arguments. Publishing this release
does not build images, change servers, or deploy a stack.

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
local ACME volume is not shared storage. SwarmOps is also one active replica on
that manager (`node.role == manager` and `nim.control=true`): its local
`swarmops_data` volume is the authoritative home for AES-256-GCM-sealed server
profiles, audit history, command metadata/payload, and pending build contexts,
while its API image and mounted configs provide the production console and
reviewed deployment assets. It has no Docker socket. The reviewed mobility
workflow can cold-handover that volume and API service to another eligible
manager after checksum verification and sustained replacement health, but it
does not make the control plane active-active or replicated.
Operators can run Vite locally as an interface only and proxy it to this API;
they do not run a second local control plane. That makes recovery
straightforward, but a shared ACME store and shared, audited application state
are still required before claiming high availability.

As an alternative, SwarmOps can run on one separate Docker-free controller
host. That host is not a Swarm node and does not carry a Docker socket. Its
direct-TLS bootstrap binds a configured local IP on one random high port and
requires an operator CIDR allowlist; it is not run at the same time as the
manager-bound singleton against a separate data directory.

SwarmOps includes reviewed, single-replica MongoDB, PostgreSQL, and Redis stacks
for deliberate managed-database use. They use local named volumes on a
`nim.stateful=true` node and do not claim high availability. The guarded
mobility workflow can quiesce, checksum-copy, start, burn in, and then await an
explicit source-retirement decision for these volumes and the monitoring
stores. It is not database replication, automatic cleanup, or a substitute for
backups and restore drills. The 8 GB reference cluster is not a safe default
for running all of them: use existing services or add capacity, placement,
backups, and a tested restore plan before moving stateful data into the swarm.
Immediately before source cleanup, SwarmOps checks the replacement is still
healthy on the recorded destination. A failed pre-cleanup handover can be
closed only with the console's typed confirmation, which retains source data
and makes no Docker change; a record whose cleanup may have started remains
open for manual recovery.
The wider platform manifest still rejects multi-node Mongo, PostgreSQL, Redis
Sentinel, Jitsi, or shared-observability profiles unless their distinct labels
and current capacity are present.

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
SwarmOps is reached through its Traefik HTTPS route. Prometheus, Alertmanager,
Jaeger, Fluentd forwarding/query routes, and probes stay on isolated internal
overlay networks; graphs, metrics, and sanitized logs are rendered inside the
SwarmOps console rather than a separate dashboard service. The SwarmOps API
itself has no Docker socket mount and reaches a
selected remote target only through that target's fixed machine API.

## Automated host and Swarm bootstrap

Forming a cluster goes through the controller. There is no push mechanism and
no inventory: an agent is installed by running one command on the machine, and
everything after that is a typed operation with an actor, an audit record and a
retry policy behind it.

~~~bash
# Reports what it would do and changes nothing.
bash scripts/bootstrap-swarm.sh --core https://core.example.com --managers 3

# Queues the operations and follows each run to a terminal result.
bash scripts/bootstrap-swarm.sh --core https://core.example.com --managers 3 --apply
~~~

The script signs in to the controller, mints a short-lived enrolment code for
each machine, prints the exact installer command to run on it, and waits for
that machine to connect. It then queues Docker installation on each, starts the
Swarm on the first, and joins the rest. It opens no SSH connection and holds no
credential for any host — the only thing it talks to is the controller.

Adding a machine later is the same script with a different name prefix, or the
**Add a machine** action in the console. Join tokens are read from the manager
by the controller when the join runs; they are never written to the command
ledger, the audit trail, or a browser response.

This replaced an Ansible playbook that reached every host over SSH. Every task
it performed — Docker from Docker's signed repository, Swarm formation, manager
promotion, the encrypted overlay, placement labels — is a typed operation the
controller already offers, and running them through the controller means they
are recorded. Secrets, DNS and firewall changes, image pushes, and stack
deployment remain explicit operator actions below.

## Remote SwarmOps connection

The production SwarmOps API runs on the designated control manager. An operator
can use its hosted console or run only the Vite UI locally with:

```bash
SWARMOPS_API_URL=https://swarmops.example.com make web-dev
```

The local server proxies browser API requests to the manager; it has no
SwarmOps data directory, Docker dependency, or local API process. Generate an
outbound enrollment command in **Fleet → Servers** for each Ubuntu
host, or use the install-first form and approve its printed code:

```bash
set -o pipefail
curl --fail --silent --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh \
  | sudo bash -s -- --core https://core.example.com --defer-docker
```

The installer resolves an immutable GitHub release, downloads the matching
Agent/Warden bundle and `checksums.txt`, verifies SHA-256 before extraction,
then activates the release through an atomic `releases/current` symlink. It
does not clone source, install Go, contact a module proxy, or compile on the
server. Warden repeats the same checksum-verified update every six hours,
health-checks the candidate, and restores the previous known-good release on
failure. Core can request that fixed local check but cannot select a source,
release, command, or executable. Re-running the installer preserves an
existing outbound identity for the same Core URL; it never prints the private
key and requires no inbound agent listener. Core stores the renewable
connection credential only as AES-256-GCM-sealed state; explicit disconnect
removes it, and `SWARMOPS_RETAIN_MACHINE_KEYS=false` restores the manual,
memory-only posture.

The normal installer command does not install Docker or form/join a Swarm.
Once the agent is enrolled, **Cluster → Setup & readiness** offers only fixed
controller-managed setup actions:
install Docker on Debian/Ubuntu, initialize a new Swarm, or join the selected
Swarm. The join credential is not shown or persisted in the browser.

Swarm service, node, stack, and build operations require Docker and a remote
Swarm manager. A connected Docker host that is not a manager remains visible
but cannot be selected for cluster pages, builds, or Swarm preflight. The
global `swarmops-agent` stack is still a separate read-only overlay probe; do
not expose it as the machine-control endpoint.

### Separate Docker-free controller

The Swarm stack remains the default production topology. If the designated
controller must not run Docker or join a cluster, install the native Core
release on that host instead of deploying the `swarmops` stack. Keep
`pipefail` enabled so a failed download cannot be treated as a successful
empty pipeline:

```bash
set -o pipefail
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash
```

For unattended installation:

```bash
set -o pipefail
curl --fail --silent --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh \
  | sudo bash -s -- \
      --listen-ip <literal-controller-ip> \
      --allow-cidr <operator-device-ip>/32 \
      --generate-admin-password
```

The bootstrap downloads `swarmops-core` and `swarmops-warden`, then serves the
embedded GUI and API through a generated TLS 1.3 certificate on a random high
port. It prints the certificate fingerprint, creates a dedicated service
account with no Docker group, enforces the supplied client CIDR in the API, and
starts with remote builds and mutations disabled. Core's Warden follows the
same local health/rollback/three-version policy. The random port is not the
security boundary: verify the fingerprint and enforce the same operator CIDR
at the host/cloud firewall.

Server profiles, audit history, command metadata/payload, and pending build
contexts are AES-256-GCM sealed in `/var/lib/swarmops`. The unrelated
data-encryption key lives under
`/etc/swarmops`, so it must be backed up separately and protected like a
secret. Enrollment-based controllers persist machine API keys only in a
separate AES-256-GCM-sealed file; keys are never returned or audited. Do not run
this controller at the same time as the manager-bound SwarmOps service: choose
one authoritative API and data directory. Keep any reviewed, non-secret
platform-admission manifest on that host too and set
`SWARMOPS_PLATFORM_MANIFEST_FILE` to it when browser deployments are enabled;
the repository sample is not a production manifest.

For CLI calls to the authenticated API, pass that visible server profile ID:

```bash
go run ./cmd/swarmopsctl preflight \
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
# This is public topology only. It becomes the immutable admission contract
# mounted into SwarmOps; do not put secret values in this file.
make swarmops-preflight MANIFEST=/secure/swarmops-platform.yml
make config-create HOST=manager-01 \
  CONFIG=swarmops_platform_manifest_v1 FILE=/secure/swarmops-platform.yml

make secret-create HOST=manager-01 \
  SECRET=ai_gateway_config_v1 FILE=/secure/ai-gateway.production.json
```

Cloudflare and ArvanCloud credentials are optional. Create only the provider
secret used by a DNS-01 resolver:

```bash
make secret-create HOST=manager-01 \
  SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 \
  SECRET=traefik_arvan_api_key_v1 FILE=/secure/traefik-arvan-api-key
```

When no usable provider credential exists, SwarmOps renders HTTP-01 on the
public `web` entrypoint. A wildcard certificate cannot use that fallback and
remains blocked until its DNS-01 credential is configured.

Set non-secret deployment settings such as `TRAEFIK_ACME_EMAIL` and
`SWARMOPS_HOST` in the ignored `deploy/hosts/manager-01.env`. A direct
Makefile deployment of the Traefik stack also requires
`TRAEFIK_DASHBOARD_HOST` for Compose interpolation. When SwarmOps installs the
gateway, enter that hostname in **Traffic → Gateway & ports** instead; it is
stored with the selected cluster and the dashboard URL is derived from it.
Build and push the immutable SwarmOps API and agent images, then validate and
deploy Traefik before SwarmOps:

```bash
make push TARGET=api TAG=<git-sha>
make push TARGET=agent TAG=<git-sha>
make push TARGET=fluentd TAG=<git-sha>
make push TARGET=logs TAG=<git-sha>
make stack-check STACK=traefik TAG=<git-sha>
make stack-check STACK=swarmops TAG=<git-sha>
make platform-deploy HOST=manager-01 TAG=<git-sha>
```

`platform-deploy` refuses a dirty worktree and always deploys Traefik first.
It does not create secrets, configs, change DNS, or open firewalls. The
interactive provisioner performs the manifest preflight and immutable config
creation before it calls this deployment step.

## Everyday SwarmOps image and stack workflow

```bash
# Build a SwarmOps image locally; this never talks to a server.
make build TARGET=api TAG=<git-sha>

# Login interactively, then build and push an immutable image.
make registry-login
make push TARGET=api TAG=<git-sha>

# Validate the fully rendered Swarm manifest.
make stack-check STACK=swarmops TAG=<git-sha>

# Deploy one stack only. Server-side builds are never used.
make deploy STACK=swarmops HOST=manager-01 TAG=<git-sha>

# Operate one service without changing its manifest.
make ps HOST=manager-01 STACK=swarmops
make logs HOST=manager-01 STACK=swarmops SERVICE=api
make scale HOST=manager-01 STACK=swarmops SERVICE=api REPLICAS=1
make rollback HOST=manager-01 STACK=swarmops SERVICE=api
```

Application images and manifests are built and validated in their owning
repositories. Here, `make stack-check-all` validates only the SwarmOps platform
stacks. The `push` and `deploy` commands reject a dirty worktree so an image and
its manifest can be traced back to a committed SHA.

## Secrets and configuration

Build arguments are public by definition: the browser can read any Vite value
baked into a frontend bundle. `scripts/build-image.sh` rejects names that look
like secrets and derives the application version from `TAG`.

Runtime configuration is a versioned Swarm secret, never an image layer,
`deploy/hosts/*.env` file, or stack literal:

| Stack | Secret name default | Mount / consumption |
| --- | --- | --- |
| `traefik` | required: `traefik_dashboard_auth_v1`; optional: `traefik_cf_dns_token_v1`, `traefik_arvan_api_key_v1` | Protected dashboard auth file; optional Cloudflare or ArvanCloud credential for DNS-01. Without a usable DNS credential SwarmOps renders HTTP-01 automatically. |
| `swarmops` | `swarmops_admin_password_hash_v1`, `swarmops_session_key_v1`, `swarmops_data_encryption_key_v1`, `swarmops_agent_token_v1`, `swarmops_registry_config_v1` | bcrypt operator hash, session HMAC key, and a base64-encoded random 32-byte AES-256-GCM data key for the API; node-agent token for the optional agent; standard Docker `config.json` for capped remote Engine builds only. Private stack pulls use reviewed credentials on the remote Swarm nodes. |
| `swarmops-agent` | `swarmops_agent_token_v1` | Optional global read-only host inventory agent; the companion node-exporter has no credential and remains internal |
| `swarmops-observability` | none | Prometheus, Alertmanager, and Jaeger remain internal; Alertmanager uses a checked-in blackhole receiver until an operator supplies a reviewed, credential-safe receiver config |

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
stacks. It also mounts `deploy/traefik/dynamic.yml` read-only as the reviewed
source for the Gateway panel's one-button prerequisite repair; the repair can
create that exact config on a selected cluster but cannot accept browser-authored
YAML. When changing one of those checked-in config assets, bump the matching
`SWARMOPS_*_CONFIG_NAME` value in the ignored host file (the full list is in
`hosts/example.env`), validate `swarmops`, deploy that core stack, and then
reconcile the affected optional stack. Keep the former config until every task
using it has converged; never overwrite a config name in place.

The direct Docker socket mount required by Traefik's Swarm provider remains a
high-trust boundary. SwarmOps has no equivalent API socket mount: each target
is reached through a pinned TLS machine API using an operator-supplied API key
held only in memory. Restrict manager access, the machine-agent listener,
certificate pinning, API-key distribution, and host firewalls accordingly. The
optional read-only agent, node-exporter, and global Fluentd forwarder still
mount reviewed host paths for inventory, metrics, Docker JSON logs, and host
journals; they expose no arbitrary command or file endpoint.

## Platform admission, durable fleet jobs, and backups

Before a build or deployment, validate a non-secret platform manifest. It
checks global names/domains within the selected namespace, registry selection,
certificate/DNS resolver choice, required S3 provider references, Jitsi ingress
IP, resource reservations, and stateful anti-affinity:

```bash
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml
go run ./cmd/swarmopsctl preflight --manifest deploy/swarmops/platform.example.yml
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

### Fleet operations and volume backups

Two capabilities described in earlier revisions of this file were driven by the
Ansible inventory that has been removed, and neither has an implementation in
this repository: an all-node job runner (`swarmops-fleet-run`) and a Restic
volume-backup timer (`swarmops-backup-install`). The Makefile targets they named
do not exist and the roles that would have installed them are not here.

What does exist today:

- **Running an operation on many machines** is the console's **Activity → Runs**
  and the typed action catalogue behind it. Each machine gets its own durable
  run with its own attempts and retry schedule, which is what a dropped
  connection needed in the first place.
- **Controller state** is backed up as one sealed file with its separately held
  key; see **Control → Core** and the recovery procedure in the root README.
- **Local Docker volumes are not backed up by SwarmOps.** Use your own snapshot
  or backup tooling on the stateful node until this is built, and do not treat
  the absence of an error as evidence that data is protected.

## Stack readiness and cutover scope

| Stack family | Manifest status | Cutover condition |
| --- | --- | --- |
| `traefik`, `swarmops` | ready for operator deployment | platform bootstrap, required secrets, immutable image push, and live checks completed |
| `swarmops-agent`, `swarmops-observability`, `swarmops-logs` | optional host monitoring, shared monitoring, and logging manifests | enable only after capacity, retention, alert receiver, and backup plan are reviewed; operator graphs stay in SwarmOps |
| `mongo-replicaset`, `postgres-primary-replica` | reviewed stateful manifests | only after distinct durable slot labels, live capacity admission, versioned database secrets, and tested database-consistent recovery |

Application readiness and cutover notes now live beside each application's
own `deploy/stacks/<app>.yml`; SwarmOps does not duplicate those manifests.

No production cutover is performed by these files or by the commands above.
See [`../docs/swarm-platform.md`](../docs/swarm-platform.md) for the architecture
and release checklist.
