# SwarmOps

> A production-minded, remote Docker Swarm control plane for
> [nim.zone](https://nim.zone), maintained by Nima Sarayan.

SwarmOps is a remote Docker Swarm control plane. It is the replacement path
for Portainer: an auditable Go API plus React console, an Ansible bootstrap
entrypoint, and shared Grafana/Prometheus/Alertmanager/Jaeger observability
manifests. In
the deployed platform, the API is a singleton on the designated control
manager: its persisted cluster profiles, audit history, encrypted command
ledger, checked-in deployment assets, and production console all live there.
An operator can run only the
Vite UI locally and proxy it to that API; no local SwarmOps API, Docker daemon,
Docker socket, or local Swarm is needed. Operators install the native machine
agent on a Linux or macOS Docker host, then add its pinned HTTPS API URL, port,
certificate fingerprint, and API key in the console.

It does **not** make Docker’s root-equivalent socket harmless. The product
reduces its exposure to a small, reviewed API rather than forwarding arbitrary
Docker commands from a browser.

## Source-release scope

This repository is self-contained for SwarmOps controller and machine-agent
development, container builds, and the direct controller and machine-agent
installers. The wider `nim` platform manifests and operator automation remain
in [nimasrn/nim](https://github.com/nimasrn/nim). When an operational procedure
below uses an `apps/swarmops` path, run it from that monorepo checkout.

Published native installations and their rollback behavior are documented in
[Native release installation and updates](docs/Native-Release-Updates.md).

## What it operates

| Area | Capability | Boundary |
| --- | --- | --- |
| Servers | Add a Linux or macOS Docker host through its native machine API URL, port, API key, and pinned TLS certificate | The key stays only in controller process memory and is cleared on disconnect/restart; only non-secret profile metadata is stored. A Swarm manager is required before cluster pages or mutations are enabled. |
| Nodes | Docker role/state/availability, labels, task placement, and engine-declared CPU/memory capacity from the selected machine agent | A target must be a remote Swarm manager for cluster operations; optional global host probes are not required for connection. |
| Stacks | Validate and deploy approved image-only Compose v3.9 application stacks; optionally pin all services to one selected node | Browser deployment requires a mounted reviewed namespace manifest. Stateful profiles remain Git-only; external secrets/configs/volumes must use the exact stack-name prefix, and Traefik labels are restricted to the approved HTTPS domain/resolver. |
| Services | Read a bounded service-log tail; restart, rollback, or scale with fixed Docker command shapes | Mutations are off by default and every request has CSRF plus an audit record. |
| Commands | Track every accepted remote mutation from admission through completion, retry, or operator attention | The API writes the command ledger before returning `202`; it exposes no raw payload, source archive, remote output, or secret. |
| Images | Build a tarred local context with CPU/RAM caps and allow-listed immutable image tags; optionally push | Browser accepts `.tar`; `swarmopsctl build --context` respects `.dockerignore`, never gives the manager a local path, and receives a queued command ID rather than remote build output. |
| Edge / TLS | Discover and reconcile the checked-in Traefik stack; protected dashboard, internal Prometheus metrics, and ACME DNS challenge | DNS/provider tokens and dashboard credentials remain external Swarm secrets; the browser never supplies routes or credentials. |
| Observability | One Grafana + Prometheus + Alertmanager + Jaeger core stack; separately enable/disable the read-only agent/node-exporter and Docker JSON-log collection | Core, host-probe, and log-collector removal require exact typed confirmations. |
| Provisioning | Guided `make swarmops-provision` invokes Ansible with fresh manager IPs and SSH user | Docker installation and Swarm formation remain reviewed Ansible operator actions; the machine API may be installed first, but Docker/Swarm operations wait for Docker to become available. |
| Platform admission | Validate a non-secret platform manifest offline or against fresh authenticated node inventory | It rejects duplicate namespace/domain claims, unavailable capacity, incompatible certificate settings, and unsafe stateful placement before a build or deployment is requested. |
| Fleet jobs | Queue an allow-listed Ansible operation on every selected inventory host and read durable status | A node-owned transient systemd job survives an accepted SSH control-channel loss; the remote model uses the trusted-workstation SSH inventory status path and never exposes command output in the browser. |
| Backups | Install an opt-in Restic timer for local Docker named-volume paths to S3-compatible storage | Credentials are supplied only through a protected controller-side file; repository initialisation and restore validation stay explicit operator actions. |

## Architecture

```text
hosted browser ── HTTPS ──────────────────────────┐
local Vite UI ── relative /api proxy ──────────────┼──> SwarmOps API on the control manager
                                                    │          (no Docker socket)
                                                    │
                                  pinned TLS machine API (URL, port, key)
                                                    │
                                      Linux/macOS Docker host / Swarm manager
                                                    │
                              fixed agent endpoints ──> local Docker Engine/CLI

trusted workstation ─ swarmopsctl tar stream ─> API build endpoint ─> encrypted command ledger ─> selected remote Engine
```

- `cmd/api` serves the React build and authenticated API on port `8084`. The
  deployed singleton is constrained to a manager with `nim.control=true`; its
  named volume holds AES-256-GCM-sealed server profiles, audit history, command
  metadata/payload, and pending build contexts. It starts without a Docker
  daemon or socket.
- `cmd/swarmopsctl` runs on the operator workstation for a real local build
  path. It prompts for a password securely or reads it once from stdin.
- `internal/remote` owns the pinned machine-API transport. It exposes a
  bounded Docker facade and fixed Docker command shapes only; it never exposes
  a shell, socket proxy, or remote filesystem API to the browser.
- `internal/ops` is the narrow mutation boundary. It owns Compose policy,
  selected-node placement injection, and audit calls. Domain data does not
  depend on HTTP, a machine API, or Docker.
- `internal/queue` is the singleton command ledger and worker. It admits only
  fixed mutation shapes, serializes remote execution, and preserves every
  accepted command across an API restart.

## Durable command lifecycle

All approved remote mutations — node availability, application-stack deploy,
service action, image build, Traefik reconciliation, and reviewed
observability controls — require an `Idempotency-Key`. After admission and
policy checks, SwarmOps atomically writes an encrypted command record before
returning HTTP `202` with a command ID. The matching console route shows only
safe metadata: action, target, state, attempt count, next retry, and generic
failure guidance.

The singleton worker runs one command at a time. Its states are `queued`,
`running`, `retry_scheduled`, `succeeded`, and `needs_attention`. Only
reconcilable fixed actions receive bounded automatic retry: 2, 4, 8, 16, 32,
then 64 seconds, with no more than eight attempts. A shutdown, timeout, API
restart while a command is running, deterministic policy error, non-retryable
action, or exhausted retry budget becomes `needs_attention`; SwarmOps never
blindly replays an uncertain remote effect. An operator can manually requeue
that terminal state after inspecting the target.

Command metadata and JSON payloads are AES-256-GCM sealed in the controller
volume. A build source archive remains in an AES-256-GCM-sealed, owner-only
(`0600`) spool until it can stream to Docker; it is never returned by the API,
browser, or audit log and SwarmOps attempts immediate deletion after a
successful lifecycle write. A failed upload is retained as a visible
`needs_attention` command rather than silently discarded. Server-profile
connect/disconnect and local login/session management are not remote mutation
commands and remain synchronous.

## Decision artifacts

- [System design](docs/SwarmOps-System-Design.docx) records the technical
  architecture, trust boundaries, rollout sequence, and test strategy.
- [Platform expansion system design](docs/SwarmOps-Platform-Expansion-System-Design.docx)
  records the admission, fleet, backup, DNS, registry, and stateful-workload
  design introduced for this operating model.
- [Docker-free controller system design](docs/SwarmOps-Docker-Free-Controller-System-Design.docx)
  records the separate-host direct-TLS, encrypted-state, and recovery model.
- [Durable command queue design](docs/SwarmOps-Command-Queue-System-Design.docx)
  records the write-before-execute invariant, retry policy, Ansible boundary,
  and rollout gates for this lifecycle.
- [Docker-free controller ADR](https://github.com/nimasrn/nim/blob/main/docs/adr/ADR-0003-docker-free-swarmops-controller.md)
  records the security trade-offs and production evidence gates.
- [Native release installation and updates](docs/Native-Release-Updates.md)
  records the Core/Agent/Warden host layout, GitHub Release assets, update
  health checks, rollback behavior, and retention policy.
- [Business review](docs/SwarmOps-Business-Review.pptx) frames the adoption
  decision and its explicit production-evidence gates.
- [Operating review](docs/SwarmOps-Operating-Review.pptx) is the operator
  rollout checklist and ownership decision queue.

## Local UI against the control manager

The standard local workflow runs the UI only. Point Vite at the HTTPS origin of
the deployed SwarmOps API on the designated manager:

```bash
SWARMOPS_API_URL=https://swarmops.example.com make web-dev
```

Vite serves the interface on `http://127.0.0.1:5284` and proxies `/api`,
`/healthz`, and `/readyz` to that remote origin. Browser calls remain relative,
so the local UI holds no cluster state, copied assets, API credential, or CORS
configuration. `SWARMOPS_API_URL` must be a complete HTTPS origin without a
path, query, fragment, or embedded credential; Vite refuses non-loopback HTTP
targets and invalid TLS certificates. The production API remains the source of
truth for cluster profiles, audit records, checked-in deployment assets, and
the served production console.

The sidebar always changes the console route. Servers, Provisioning, Fleet
operations, the Command queue, and the Audit trail remain available before a Swarm manager is
selected; cluster inventory and mutation pages instead show their selected
manager prerequisite with a direct path back to Servers. The console never
silently replaces a chosen destination with the Servers page.

### Cluster overview

The Overview route is a summary-first, point-in-time operator dashboard. It
refreshes from the selected manager every 30 seconds and combines the current
cluster snapshot with reviewed stack, Traefik, and observability status. Its
cards distinguish cluster health, ready-node coverage, running-versus-desired
tasks, host-probe coverage, and the tightest measured memory/disk headroom.
The supporting lists put degraded nodes and services first, then retain stack
and platform posture for follow-up.

SwarmOps does not retain a performance time series, so Overview intentionally
does not draw historical trends. CPU is shown as declared core capacity rather
than inferring utilisation from load average. Memory and disk utilisation (and
the headroom card) are shown only when every selected node has a healthy
read-only host probe; otherwise the console labels the source-coverage gap and
shows capacity without a misleading percentage.

`make dev-api` starts the local Core API with `admin` / `admin`, uses an
owner-only development session
value, and does not represent or share the manager's control-plane state. The
development password hash can be overridden with `SWARMOPS_DEV_PASSWORD_HASH`
when launching the API manually. `SWARMOPS_INSECURE_DEV_AUTH` is absent from
the Swarm manifest, which always uses external secrets; never set the
development flag or values in a host environment file or Swarm service.

### Full local development

When developing the Core API and a source-built machine agent on the same
computer, start the complete local environment with one command:

```bash
make local
```

It prepares the local identity, starts the loopback machine API, waits for its
TLS health check, then starts Core and the Vite console. On exit, it cleans up
the processes it started. The machine API is a host process and starts even
when Docker is not running. Core connects it automatically, while Docker and
Swarm operations remain unavailable until the local Docker Engine comes up.

To debug the two parts independently, run the agent in one terminal and Core
plus the console in another:

```bash
# Terminal 1: starts the loopback machine API.
make dev-agent

# Terminal 2: starts the local Core API and Vite console.
make dev
```

`make dev-agent` creates a private development API key and pinned P-256 TLS
identity in SwarmOps' local development directory, then serves the agent only
at `https://127.0.0.1:9180`. `make dev-api` uses that same local identity and
automatically adds and connects the **Local machine** profile without sending a
key through the browser. It continues waiting if the agent starts after Core;
the console refreshes the server list and selects it automatically when the
local Docker Engine is a Swarm manager. The local identity remains owner-only
where private and is never printed.

By default the shared development directory is
`${TMPDIR:-/tmp}/swarmops-dev`; set `SWARMOPS_DEV_DIR` to another absolute
non-root directory when needed. To run Core yourself instead of `make dev`,
use `make dev-api` and `make web-dev`; Vite already proxies relative browser
requests to `http://127.0.0.1:8084` automatically. This shortcut is available
only with `SWARMOPS_INSECURE_DEV_AUTH`, accepts only a loopback HTTPS agent,
and is rejected by production configuration. Core's encrypted development
state lives under that directory's `core` subdirectory, so it remains readable
across local restarts but stays separate from earlier disposable development
state at the directory root.

## Direct Docker-free controller

For a separate, freshly installed controller host, download the published
native Core installer. It serves the bundled GUI and API from that host only;
it does not install Docker, join a Swarm, or contact a cluster.

```bash
curl --fail --location --remote-name \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh
sudo bash install-swarmops-core.sh \
  --listen-ip <literal-server-ip> \
  --allow-cidr <operator-device-ip>/32
```

The command requires the exact IP already configured on the server and one or
more trusted operator CIDRs. It prompts for a 16+ character administrator
password, generates independent session and AES-256-GCM data keys, installs a
restricted systemd service, and chooses a random high TCP port. It prints the
HTTPS URL and the SHA-256 certificate fingerprint. Verify that fingerprint
from a trusted server console before accepting the self-signed IP certificate
in a browser. The controller downloads a release binary; it does not need Git,
Go, or npm on the server.

The service account has no Docker-group membership or capabilities, and the
service gets no Docker socket. Browser mutations and remote builds begin
disabled. Server profiles, audit history, and command metadata/payload are
sealed with AES-256-GCM under `/var/lib/swarmops`; pending build contexts are
owner-only spool files retained only while a queued or needs-attention build
needs its source and deleted after a successful build. The separate key remains
in a protected file under `/etc/swarmops`. Machine API keys are never stored in
controller state. The encryption protects copied state or backups without the
key; it cannot protect a controller host already compromised as root.

The allowlist is enforced by the API, not by the random port. Also add an outer
firewall or security-group rule that exposes the printed port only to the same
trusted networks. Back up the state key separately from the encrypted state:
losing it makes saved controller state unrecoverable.

## Direct machine agent (Linux and macOS)

The target machine runs a native agent from a published release as a host
process; it is not the global read-only `swarmops-agent` Swarm service. It can
start before Docker is installed or running, reports that Docker is unavailable
until the Engine appears, and needs a ready Docker Engine only for inventory or
Swarm operations. On Linux, run the installer with `sudo`. On macOS, run it as
the logged-in user, without `sudo`:

```bash
curl --fail --location --remote-name \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh
# Linux:
sudo bash install-swarmops-agent.sh
# macOS:
bash install-swarmops-agent.sh
```

The release repository publishes three native programs: `swarmops-core`,
`swarmops-agent`, and the shared checksum-verifying **SwarmOps Warden**
(`swarmops-warden`). An agent host receives Agent + Warden, while a controller
host receives Core + Warden. The installer downloads the matching
checksum-verified GitHub Release bundle, then installs a systemd service on
Linux or a per-user LaunchAgent on macOS. It requires curl,
OpenSSL, and the platform service manager—not a live Docker socket, Docker CLI,
Git, Go, or pre-created TLS files. By default it listens on `0.0.0.0:9180`,
generates a P-256 self-signed certificate for SwarmOps'
certificate-pin trust model, and writes its TLS identity to
`/etc/swarmops-agent/tls/agent.crt` and `/etc/swarmops-agent/tls/agent.key` on
Linux, or `$HOME/.config/swarmops-agent/tls/agent.crt` and
`$HOME/.config/swarmops-agent/tls/agent.key` on macOS. Pass the paired
`--tls-cert-file` and `--tls-key-file` flags only when an operator deliberately
uses a different managed certificate. Pass `--install-dependencies` only when
its documented Debian/Ubuntu or Homebrew package installation is appropriate.
It does not install Docker, change the firewall, create a Swarm, or print the
generated API key.

It writes `SWARMOPS_AGENT_TOKEN_FILE`, `SWARMOPS_AGENT_TLS_CERT_FILE`,
`SWARMOPS_AGENT_TLS_KEY_FILE`, `SWARMOPS_AGENT_LISTEN_ADDR`,
`SWARMOPS_DOCKER_SOCKET`, and `SWARMOPS_AGENT_REMOTE_CONTROL_ENABLED=true`
into its protected service environment. Keep the token/key file owner-only;
the agent refuses a symlink or group/world-readable token or TLS key.

On Linux, the default TLS identity is already in the SwarmOps-owned
`/etc/swarmops-agent/tls` directory. A custom TLS identity must stay outside
`/home`, `/root`, and `/run/user`, because the installed systemd service
protects home directories. The agent must remain reachable only from the
controller through an explicit firewall rule.

Warden checks GitHub Releases every 12 hours. It downloads and verifies a new
bundle before stopping the agent, probes only the local health endpoint, rolls
back a failed candidate, and retains the current release plus two prior
known-good releases. Use `sudo swarmops-agent upgrade` for an immediate agent
update, or `sudo swarmops-core upgrade` on a Linux controller. An older agent
that predates these commands is upgraded once with the same one-line installer
above; it preserves its existing API key, TLS identity, listener, and service
configuration.

Rotate an Agent key with `sudo swarmops-agent gen key`. It atomically replaces
the protected key file and restarts the Agent. The command prints the new key
once; paste it into **Servers → Reconnect**, because Core deliberately clears
machine API keys on disconnect or restart rather than storing them.

The installer prints the machine API port and a public TLS certificate
fingerprint in `SHA256:<64-hex>` form, and gives the protected key-file path.
Copy the key through an approved secure channel. Then open **Servers** and add
the HTTPS origin without a port, the port, the fingerprint, and that key. The
controller pins the exact leaf certificate and retains the key only until the
server disconnects or the controller restarts.

Profiles saved before this transport change are marked **Legacy SSH** in the
Servers table. They remain readable only for migration; remove each one and
add the corresponding machine agent rather than reusing an SSH credential.

The machine API accepts only the inventory calls, bounded service/node/stack
operations, and capped image-build call SwarmOps uses. It is not a generic
Docker proxy, shell, file service, or socket tunnel. Image builds are disabled
in the installer by default; enabling them requires an explicit local agent
build policy (`SWARMOPS_AGENT_BUILD_*`) matching the controller's reviewed
limits and allow-listed image registry. Direct-agent metrics require the same
API key; only the separate private-overlay inventory stack exposes unauthenticated
Prometheus metrics.

## Advanced loopback native runner

The normal Swarm stack remains the default manager-bound topology. For a
reviewed reverse-proxy topology on a Docker-free host, the lower-level runner
still builds and stages the same server-local binary:

```bash
SWARMOPS_ADMIN_PASSWORD_HASH_FILE=/etc/swarmops/admin-password-hash \
SWARMOPS_SESSION_KEY_FILE=/etc/swarmops/session-key \
SWARMOPS_DATA_ENCRYPTION_KEY_FILE=/etc/swarmops/data-encryption-key \
SWARMOPS_DATA_DIR=/var/lib/swarmops \
make swarmops-native-api
```

`scripts/run-swarmops-api.sh` rejects development authentication, requires the
dedicated data key, and binds to `127.0.0.1:8084` by default. Without a direct
TLS certificate/key pair it refuses non-loopback binding, so place an HTTPS
reverse proxy in front of it. Use
`bash scripts/run-swarmops-api.sh --prepare` to build and stage the binary and
assets without starting it; a service manager can then start the prepared
binary with the same `SWARMOPS_*` environment values.

A production platform-admission manifest is deliberately not copied from the
example. If browser deployments or platform admission are required, keep its
reviewed, non-secret manifest on this same control host and set
`SWARMOPS_PLATFORM_MANIFEST_FILE` to that path before starting the API.

## Local checks

```bash
go test ./...
npm --prefix web ci
npm --prefix web run typecheck
npm --prefix web run lint
npm --prefix web run build

make build TARGET=api TAG=<immutable-tag>
make build TARGET=agent TAG=<immutable-tag>
make build TARGET=cli TAG=<immutable-tag>
make stack-check STACK=swarmops TAG=<immutable-tag>
make stack-check STACK=swarmops-agent TAG=<immutable-tag>
make stack-check STACK=swarmops-observability TAG=<immutable-tag>
make stack-check STACK=swarmops-logs TAG=<immutable-tag>
```

No Docker daemon or Swarm is required to run the local UI against the deployed
API or use the console's Servers page. The target machine must run the native
agent before it can connect, but it may connect before Docker is available;
Docker and Swarm operations remain unavailable until the engine starts. A
remote Swarm manager is required to verify cluster placement, service
operations, or Swarm mutations.
A local Docker daemon is still needed only to build the container images in the
optional image-build checks above.

## Platform admission before build or deploy (nim monorepo)

The following platform procedures use the full, reviewed `nim` deployment
repository. Clone [nimasrn/nim](https://github.com/nimasrn/nim) and run these
commands there; this source release does not carry unrelated application stacks
or production host configuration.

Use a reviewed, non-secret platform manifest for every cluster-wide rollout:

```bash
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml

# After a remote manager is connected through its machine API, compare the same
# manifest to that selected server's current Docker inventory. The controller
# API password is prompted locally.
cd apps/swarmops
go run ./cmd/swarmopsctl preflight \
  --manifest ../../deploy/swarmops/platform.example.yml \
  --url https://swarmops.example.com --username operator --server-id <server-id>
```

The manifest carries only public topology and versioned secret *names*. It
requires globally unique workload names within its namespace and unique routed
domains across that plan. It validates the selected registry (`ghcr` or
`private`), cache/build labels, S3-compatible provider references, backup
prefix/schedule, certificate resolver selection, and reservation budget.

The live form requires every declared node to be ready, retain the expected
labels, and meet the declared CPU, memory, free-memory, and free-disk facts.
The selected remote manager supplies Docker state; a compatible host probe is
still required for free-memory/free-disk evidence, and the check fails closed
when it is unavailable. CPU availability is intentionally not inferred from
load average: retain a reviewed reservation budget in the manifest. A pass is
an admission result, not a deployment, DNS, S3, or credential verification.

The deployed API loads the same manifest from an immutable Swarm config. It
accepts browser Compose only for declared `application` workloads in that
namespace, rejects stateful profiles, and validates the browser's boundary as
well as its image policy. A routed service may use only an HTTPS `websecure`
router whose name begins with `<stack-name>-`, claims the declared domain, and
uses the declared resolver; TCP/UDP routes, shared middleware, and arbitrary
Traefik service settings stay Git-reviewed. Any external secret, config, or
volume must declare a safe physical name beginning with `<stack-name>-` (or
`<stack-name>_`), while the only permitted external network is `traefik`.
Browser services must remain replicated and their combined replica, CPU, and
memory reservations cannot exceed the reviewed workload budget.
MongoDB and PostgreSQL can only be deployed with their checked-in stacks after
live admission, not replaced by a browser document.

After SwarmOps is online, use the guarded deployment path to require a fresh
authenticated remote-node/resource check and a stack render before a deployment
side effect:

```bash
make swarmops-checked-deploy \
  MANIFEST=deploy/swarmops/platform.example.yml \
  SWARMOPS_URL=https://swarmops.example.com \
  SWARMOPS_USERNAME=operator \
  SWARMOPS_SERVER_ID=<server-id> \
  STACK=swarmops HOST=manager-01 TAG=<immutable-tag>
```

It prompts for the SwarmOps password locally unless
`SWARMOPS_PASSWORD_STDIN=1` is explicitly supplied. The first Traefik and
SwarmOps bootstrap uses `make swarmops-checked-platform-deploy`, which performs
offline admission only because the control plane is not available yet.

The built-in profiles protect topology rather than creating a database from a
browser placeholder: Mongo replica sets need three distinct `nim.mongo` nodes;
Postgres primary/replica needs two `nim.postgres` nodes; Redis Sentinel needs
three `nim.redis` nodes; Jitsi needs one `nim.jitsi` node and an advertised IP
that matches the declared public Traefik ingress; and the shared observability
profile permits one `nim.observability` deployment. A real stateful profile
still needs a reviewed checked-in stack, versioned secrets, logical backup
hooks, and a tested restore before it is deployed.

## Fresh nodes, stateful slots, and reconnect recovery

Add a fresh Debian/Ubuntu server to the ignored inventory's
`swarm_join_nodes` group, then use the reviewed workflow. It installs Docker
only when absent, refuses an unexpected conflicting runtime, and joins through
the designated private Swarm address without logging a join token:

```bash
make swarmops-join-node INVENTORY=deploy/ansible/inventory.yml
make swarmops-join-node INVENTORY=deploy/ansible/inventory.yml APPLY=1
```

PostgreSQL primary/replica requires two separate `nim.postgres.slot` labels;
the Mongo replica set requires all three `nim.mongo.slot=1|2|3` labels. A
second node alone cannot safely create the checked-in three-member Mongo set.
After a reconnect or reboot, run the read-only continuity check before touching
any data:

```bash
make swarmops-recovery-check INVENTORY=deploy/ansible/inventory.yml
```

It checks Docker, Swarm membership, local-volume continuity, optional backup
timer state, and manager visibility. Set each stateful host's exact local
volume names in `swarmops_recovery_expected_volumes` in the ignored inventory
to make the read-only check fail if one is missing; it never restores, deletes,
or promotes a database. The full stateful contract is
[`../../docs/swarmops-stateful.md`](../../docs/swarmops-stateful.md).

## Durable all-node operations

Run a reviewed operation from the trusted workstation, not from a browser:

```bash
make swarmops-fleet-run \
  INVENTORY=deploy/ansible/inventory.yml \
  OPERATION=node-health-report

# Remote targets use the SSH inventory status path directly.
cd apps/swarmops
go run ./cmd/swarmopsctl fleet status \
  --inventory ../../deploy/ansible/inventory.yml \
  --run-id fleet-<generated-id>
```

Only `node-health-report` and `warm-docker-cache` are allowed. Ansible submits
a fixed systemd transient unit to every selected host; once that unit is
accepted it continues independently of an SSH disconnect. `swarmopsctl` retries
the same run ID through Ansible up to eight times with the same 2, 4, 8, 16,
32, and 64 second backoff; the host runner applies the same bounded retry
schedule and records `attempt`, `maxAttempts`, and `nextAttemptAt` in its
root-owned status. Reuse the same run ID to resume hosts that missed a submit
attempt. For remote-server operation, use the inventory SSH read-only status
path. Operation output remains root-owned on the host and is never returned by
the API or console.

## S3-compatible local-volume backups

The backup timer covers local Docker named volumes on each selected node. Its
protected environment file must contain only the Restic repository/password and
the S3-compatible credential variable names/values required by the chosen
provider; keep that file outside this repository with restrictive permissions.

```bash
make swarmops-backup-install \
  INVENTORY=deploy/ansible/inventory.yml \
  BACKUP_ENV_FILE=/secure/swarmops-restic-s3.env

# This is a separate external S3 mutation for a confirmed empty repository.
make swarmops-backup-init INVENTORY=deploy/ansible/inventory.yml
```

The timer backs up `/var/lib/docker/volumes` with retention and does not expose
S3 credentials to SwarmOps. Each host tags and retains only its own snapshots;
the shared repository lock is retried for up to 30 minutes so simultaneous
timers do not silently skip a backup. Add each reviewed persistent bind-mount
root to `swarmops_backup_paths` in the protected inventory (never `/`) so the
allow-list covers all intended local state. It is a host-volume safety net, not a
database-consistency guarantee: MongoDB and Postgres require application-aware
logical/physical backup hooks and a documented, exercised restore before their
replica profiles are considered protected.

## DNS, certificates, registry, and cache

Traefik has three reviewed resolver names: `le` (Cloudflare DNS), `arvan`
(ArvanCloud DNS), and `http` (HTTP-01 on public port 80). Each DNS resolver
uses one provider; use a CNAME delegation when a domain needs validation in a
different DNS authority. The platform phase requires both
`traefik_cf_dns_token_v1` and `traefik_arvan_api_key_v1` to exist as versioned
external secrets, plus dashboard credentials. The HTTP resolver remains
appropriate only when the declared public ingress is really reachable on port
80.

The preflight manifest accepts GHCR or a private registry and names the
versioned private-registry auth secret when needed. SwarmOps' own image build
uses a BuildKit npm cache mount; the manifest requires that intended build/cache
capacity is labelled `nim.build=true` and `nim.cache=true`. The bounded build
runs on the selected remote Docker Engine through the pinned machine API;
selecting that target is explicit in the console or `swarmopsctl --server-id`.
The trusted
workstation chooses a local Dockerfile/context and uploads only a bounded,
`.dockerignore`-honouring tar stream; SwarmOps never scans arbitrary paths on
the GUI machine.

## Production prerequisites

1. Deploy the SwarmOps stack as a singleton on the designated control manager
   (`node.role == manager` and `nim.control=true`). Its `swarmops_data` volume
   keeps AES-256-GCM-sealed control-plane profiles, audit history, and command
   ledger on that
   node; the API image and mounted Swarm configs provide the production console
   and reviewed deployment assets there. It starts without a local Docker
   socket. Sign in through that API, install the native machine agent on each
   selected Linux/macOS Docker host, and add its HTTPS origin, port, TLS
   certificate fingerprint, and API key. Select the target only after it is a
   Swarm manager.
2. Form the three-manager Swarm and create the encrypted `traefik` overlay if
   the target cluster is not already formed. `make swarmops-provision` prompts
   for manager addresses and SSH user; its optional platform phase accepts only
   protected secret-file paths plus a reviewed non-secret platform manifest,
   then deploys Traefik plus SwarmOps after images are already pushed.
3. Build and push the immutable API and agent images through the root Makefile.
4. Create the versioned external secrets from permission-restricted files
   outside this repository. The API needs a bcrypt hash (not a cleartext
   password), at least 32 random bytes for the session key, a base64-encoded
   random 32-byte data-encryption key, and a standard Docker `config.json`
   only when a remote Engine must push a private image.
   That JSON is sent over the encrypted Docker API stream for the build and
   never reaches the browser. Remote Swarm nodes use their own reviewed image
   pull credentials for private-stack deployments.
5. Create the Traefik Cloudflare DNS-token, ArvanCloud API-key, and
   `htpasswd`-format dashboard-auth secrets. The dashboard is routed to
   `api@internal`; port `8080` is never published.
6. Create the Grafana administrator-password secret before enabling the core
   observability stack. Configure a reviewed Alertmanager receiver before
   relying on notifications; the committed baseline uses a blackhole receiver.
   Jaeger uses the checked-in v2.20 Badger config on the labelled stateful
   node, so its volume needs a backup/recovery procedure.
7. Set non-secret host values such as `SWARMOPS_HOST`, `GRAFANA_HOST`,
   `TRAEFIK_DASHBOARD_HOST`, `TRAEFIK_DASHBOARD_URL`, and
   `TRAEFIK_ACME_EMAIL` in the ignored `deploy/hosts/<host>.env` file.

Example secret creation (the referenced files are intentionally outside Git):

```bash
umask 077
openssl rand -base64 32 > /secure/swarmops-data-key.base64

make secret-create HOST=manager-01 SECRET=swarmops_admin_password_hash_v1 FILE=/secure/swarmops-admin.bcrypt
make secret-create HOST=manager-01 SECRET=swarmops_session_key_v1 FILE=/secure/swarmops-session-key
make secret-create HOST=manager-01 SECRET=swarmops_data_encryption_key_v1 FILE=/secure/swarmops-data-key.base64
make secret-create HOST=manager-01 SECRET=swarmops_agent_token_v1 FILE=/secure/swarmops-agent-token
make secret-create HOST=manager-01 SECRET=swarmops_registry_config_v1 FILE=/secure/swarmops-registry-config.json
make secret-create HOST=manager-01 SECRET=swarmops_grafana_admin_password_v1 FILE=/secure/grafana-admin-password
make secret-create HOST=manager-01 SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 SECRET=traefik_arvan_api_key_v1 FILE=/secure/traefik-arvan-api-key
make secret-create HOST=manager-01 SECRET=traefik_dashboard_auth_v1 FILE=/secure/traefik-dashboard.htpasswd
```

## Deploy order

`make platform-deploy` deploys only Traefik then SwarmOps; it does not create
secrets or configs, change DNS/firewalls, push images, or enable
mutations/builds.

```bash
make push APP=swarmops TARGET=api TAG=<immutable-tag>
make push APP=swarmops TARGET=agent TAG=<immutable-tag>
make swarmops-preflight MANIFEST=/secure/swarmops-platform.yml
make config-create HOST=manager-01 CONFIG=swarmops_platform_manifest_v1 FILE=/secure/swarmops-platform.yml
make stack-check STACK=traefik TAG=<immutable-tag>
make stack-check STACK=swarmops TAG=<immutable-tag>
make platform-deploy HOST=manager-01 TAG=<immutable-tag>

# After Grafana's versioned secret and SwarmOps config versions exist:
make deploy STACK=swarmops-observability HOST=manager-01 TAG=<immutable-tag>
```

The console can also deploy/remove the reviewed observability core after a
user enables `SWARMOPS_MUTATIONS_ENABLED=true`. It can separately install the
read-only agent/node-exporter stack and enable the log stack only after the
core and API are healthy.

For the first controlled rollout, leave `SWARMOPS_MUTATIONS_ENABLED=false` and
`SWARMOPS_BUILD_ENABLED=false`, log in, connect a remote manager, verify node
inventory, Traefik HTTPS/dashboard access, Grafana authentication, Prometheus
targets, Alertmanager delivery, Grafana's overview dashboard, and Jaeger
storage. Enable each mutation surface deliberately
afterwards.

## Auth and audit

The initial production model is one operator account. Its bcrypt hash and HMAC
session key are Swarm secrets when the optional stack is used. The browser receives a
short-lived HTTP-only SameSite cookie and CSRF token; no password or token is
persisted in the client. Login attempts are locally throttled and Traefik adds
an edge rate limit to the login route.

Audit events are append-only JSONL records in the API’s named volume. They
contain actor, target, action, outcome, request ID, and non-sensitive details.
They never contain cleartext credentials, Compose content, build contexts,
registry configuration, or service-log output.

The command ledger is separate from audit history: it is the durable source of
truth for accepted command intent and local lifecycle, not proof that a remote
Docker side effect occurred exactly once. It records safe state transitions in
the audit trail without copying command payloads, source archives, or remote
output.

Server profiles persist only display name, machine API origin/port,
authentication method, and pinned TLS certificate fingerprint in sealed state
beside the audit data. API keys are never written there, placed in a Swarm
secret, or included in audit records. They are retained only by the live
controller process so a restart requires an explicit reconnect.

The Servers panel reports safe, actionable connection diagnostics for TLS-pin
mismatches, rejected API keys, machine-API reachability, disabled control, and
Docker Engine failures. It includes a request ID for protected server-log
correlation, but never returns credentials, raw remote output, or unreviewed
remote error text to the browser.

The fingerprint pins the exact TLS leaf certificate presented by the machine
agent. Verify its public SHA-256 fingerprint from the target's trusted console
before saving it; a certificate renewal or reverse-proxy change requires an
explicit verified profile update.

## Important limitations

- The control plane is intentionally a single replica on the designated
  control manager because its audit/command volume and in-memory machine API
  connections are local to that task. A separate shared state and credential
  design is required before it can become HA.
- A remote host must run the native machine agent before it can be added. It
  can connect before Docker starts, but Docker and cluster operations remain
  unavailable until the engine is ready. Cluster operations require a selected
  remote Swarm manager; use the reviewed Ansible provisioning workflow to
  prepare a fresh Debian/Ubuntu host. SwarmOps does not install Docker or form
  a Swarm from the browser.
- Jaeger’s checked-in Badger store is durable only on its labelled stateful
  node. Use documented OpenSearch config and a tested backup/restore plan when
  trace HA/retention requires it.
- The global agent and optional log collector need privileged *read* mounts of
  host paths. They do not publish a control endpoint, but that host access
  remains a high-trust operating decision.
- Portainer’s manifest remains in the repository for migration/rollback only.
  Do not run both as independent mutation control planes after SwarmOps is
  accepted; Git and the Makefile remain the deployment source of truth.

## License and attribution

SwarmOps is licensed under [Apache-2.0](LICENSE), copyright 2026 Nima Sarayan.
Redistributions and derivative works must retain the attribution in
[NOTICE](NOTICE), as required by Apache-2.0 section 4(d). This is a
redistribution notice, not a requirement to show a product UI badge.
