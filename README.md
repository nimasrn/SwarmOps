# SwarmOps

> A production-minded, remote Docker Swarm control plane for
> [nim.zone](https://nim.zone), maintained by Nima Sarayan.

SwarmOps is a remote Docker Swarm control plane. It is the replacement path
for Portainer: an auditable host-native Go Core, host-native Ubuntu agents,
and Prometheus/Jaeger/Fluentd observability manifests. A
production installation has one active **control-plane** member by default:
its persisted cluster profiles, audit history, encrypted command ledger,
checked-in deployment assets, and production console live there. That process
is not a Docker target and has no implicit local Docker, UFW, or provisioning
access. **Servers** contains only independently installed and enrolled native
machine agents, including when an agent happens to run on the same host as the
core. An operator can run only the Vite UI locally and proxy it to the active
API; no local SwarmOps API, Docker daemon, Docker socket, or local Swarm is
needed. Production agents run on Ubuntu 22.04 or 24.04 and initiate outbound
mutual-TLS long polls to Core. No inbound agent port, SSH session, WebSocket,
or Traefik route is required for control traffic.

Core can send only catalogued fixed requests through that outbound channel.
The reviewed catalogue includes bounded log status and query routes; a local
Core catalogue rejection is treated as a controller contract error and never
as evidence that the authenticated agent or its network path is unreachable.

## Quick start

In **Fleet → Servers**, generate a short-lived one-time installer
command and run it on the Ubuntu host:

```sh
curl --fail --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh \
  | sudo bash -s -- --core https://core.example.com --core-fingerprint 'SHA256:<64-hex>' --enrollment-code '<one-time-code>' --defer-docker
```

The installer creates the systemd service, generates the private key on the
host, verifies the exact Core certificate fingerprint before exchanging the
one-time code for a renewable client certificate, and starts the outbound poll loop. The console
adds `--core-fingerprint` to its generated command automatically; it is required
for the self-signed certificate created by the Docker-free Core installer. Docker installation and
Swarm initialization remain separate typed catalog operations after the agent
is visible; the Core process itself never needs Docker. Alternatively, run the
same command without `--enrollment-code`; the agent prints a short-lived code
to approve in **Fleet → Servers** and retains the private redemption
secret locally.

After a native agent is enrolled, **Fleet → Host setup** shows a
one-target checklist in the console. The page reads a bounded host snapshot first —
hostname, operating system, kernel, architecture, CPU capacity and load,
memory, root-disk capacity, uptime, agent version, Docker state, and Swarm
state — even when Docker has not been installed yet. Each missing requirement
has a concrete fix button and visible review sheet. It can queue a fixed
Debian/Ubuntu action to update OS packages, install or update Docker Engine,
initialise an inactive host as a single-node Swarm, or apply a CIDR-scoped UFW
baseline. Docker Swarm ports are restricted to reviewed peer CIDRs. Joining an
existing Swarm, manager promotion, node availability, and package maintenance
are typed catalog operations; custom shell commands and arbitrary UFW rules do
not exist.

### Control-plane placement and recovery

**Control → Controller & recovery** is deliberately separate from **Servers**.
It reports the API process identity, whether this member is active or standby,
and the recorded handoff state. The host serving the console never appears in
the agent inventory by itself. If it must be operated as a Docker host, install
and enrol its own machine agent through either certificate flow, then link that
already-enrolled server profile as optional topology context.

The normal deployment remains one active API task. A standby is a recovery
candidate, not a second active controller: give it a unique
`SWARMOPS_CORE_ID`, set `SWARMOPS_CORE_MODE=standby`, deploy the same reviewed
release, and restore a complete encrypted controller-state copy plus its
separately protected data-encryption key. The Controller & recovery page records an
operator-attested restore verification; it never copies state, secrets, or
service binaries over an unpinned connection.

For the Docker-free bootstrap, pass `--core-id <unique-id> --core-mode standby`
on the recovery host. It starts with no managed-server profile and stays unable
to act on agents until the restored topology is explicitly promoted.

For a planned move, prepare the verified standby, take and restore a final
state copy, fence the old primary from the page, copy the resulting fenced
state to the target, and promote the target from its own page. Fencing pauses
new agent and cluster work on the former primary; a command that is already
running is left visible rather than guessed at or replayed. Emergency
promotion is available only after an operator explicitly confirms the former
primary is stopped or fenced. There is no automatic failover, shared-volume
replication, or split-brain detector. Use a tested encrypted-state restore and
external fencing instead of running two active cores.

### Deploying an application

Once a host is enrolled, deploy from an immutable image or connect a private
Git provider and let SwarmOps discover the deployment evidence. SwarmOps
renders the Compose, Traefik route, health probe, metrics/tracing wiring, and
managed database attachments:

1. **Databases** → deploy PostgreSQL, MongoDB, or Redis. SwarmOps generates the
   password and the connection URI as Swarm secrets.
2. **Applications** → choose an approved slot, give it an already-pushed
   immutable image tag, tick the databases it needs, and deploy.
3. **Source deploy** → add a GitHub, GitLab, or Gitea/Forgejo token, choose a
   repository and ref, review every Compose/Dockerfile found in the monorepo,
   then release one application candidate. The screen is four numbered stages —
   Source, Discovery, Review, Release — beside a standing deployment plan.
   Source contains both the sealed provider connection and the immutable
   repository revision; Discovery scans the complete tree; Review owns the
   accepted mapping; Release builds and starts the healthy task first. The plan
   lists the applications, immutable images, managed
   databases, shared stacks, domain, and telemetry the deployment will own, and
   the warnings and blockers still in its way. The plan is the only place the
   deployment is queued from, and it can be saved as a browser-local draft
   holding the selection alone — never evidence. Source PostgreSQL/MongoDB/Redis/
   Valkey services are replaced by managed databases; Prometheus,
   Alertmanager, Jaeger, Fluentd, and exporters reuse the global stacks.
   Dashboard containers from a source repository are unsupported.

The application slot — its name, public domain, certificate resolver, and
resource ceiling — comes from the reviewed platform manifest, so an operator
picks from approved domains rather than claiming an arbitrary one. Everything
else is generated: no Compose, no Traefik label, and no connection string is
written by hand. See
[applications.example.json](../../deploy/swarmops/applications.example.json)
for two worked specs.

It does **not** make Docker’s root-equivalent socket harmless. The product
reduces its exposure to a small, reviewed API rather than forwarding arbitrary
Docker commands from a browser.

## Product direction

The SwarmOps program goal is to create the kind of developer platform offered
by managed container PaaS providers, but as open-source, self-hostable
software that operators can run on infrastructure they control. “Better” is a
directional standard rather than a premature feature-parity claim: portable
image and deployment definitions, operator-owned data and infrastructure,
auditable bounded operations, and no required provider lock-in.

Today, SwarmOps is a Docker Swarm control plane, not a turnkey multi-tenant
cloud PaaS. Its deployment primitive is a reviewed, generated image-only
Compose v3.9 application stack. Private repository content can inform that
generator and its bounded image build, but source Compose is never deployed
directly. SwarmOps does not ingest Kubernetes manifests or Helm charts.
Kubernetes/Helm compatibility is a future product decision, not an existing
capability or promise. The dated Iranian market scan and the exact comparison
boundary are in [market positioning](docs/market-positioning.md). The
bilingual programme reference and phased resilience roadmap are rendered from
the nim.zone site’s versioned docs content and publish at
[nim.zone/docs/swarmops](https://nim.zone/docs/swarmops) when the current site
version is deployed.

## Console information architecture

The console uses a two-level operator hierarchy, and both levels are built
from one file — `web/src/navigation.ts`, which holds the areas, the screens,
their icons, the one line each screen exists to answer, and every retired hash
that must keep resolving. A screen that is routable and appears in no area is a
test failure, not a discovery an operator makes.

The areas are named for the operator's job rather than the system's object
model. A persistent icon rail owns **Overview**, **Deliver**, **Fleet**,
**Workloads**, **Traffic**, **Observe**, **Activity**, and **Control**; a
contextual sidebar names the screens inside the active area and states what the
area is for. Overview answers what is healthy and what to do next. Deliver owns
the whole path from source to running production — deploy from source,
applications, images and builds, and the container registry. Fleet owns
servers, host setup, Swarm placement, connection diagnostics, and Docker
resources. Workloads owns what is scheduled right now: Swarm services, stacks,
and managed databases. Traffic gives gateway ports, routes, DNS providers, and
TLS their own destinations. Observe owns health, logs, and collectors. Activity
owns runs, the fixed action catalog, and audit. Control owns controller
authority and recovery.

⌘K opens a command palette that both reaches any destination and runs the
operations an operator reaches for under pressure — deploy from source, add a
server, refresh, diagnose a connection, review runs, sign out, and point the
console at another cluster. It ranks by where the match landed, so the thing
whose name was started is the thing Enter is already on.

A page may show a compact status owned elsewhere, but it must link to the
owner for investigation or mutation. It must not recreate the owner's tables,
filters, charts, configuration, or action menus. Overview is the deliberate
exception for summaries, never a second full workspace. Every destination is
directly addressable and preserves the selected server.

The complete ownership table, drill-down rules, and cleanup acceptance criteria
are in [console information architecture](docs/console-information-architecture.md).

## What it operates

| Area | Capability | Boundary |
| --- | --- | --- |
| Controller | Show the active or standby controller identity, register a recovery standby, record a tested encrypted-state restore, fence a planned handoff, and promote a local standby | A controller member is never an implicit Server. A standby does not contact agents, claim queued commands, or run cluster mutations until promotion. State/key transfer and external primary fencing remain an explicit operator recovery procedure; automatic failover is intentionally not claimed. |
| Agents | Enrol an Ubuntu 22.04/24.04 host with a dashboard-generated command or approve the code printed by an install-first agent | Both flows generate the private key locally, issue a renewable client certificate, pin Core identity, and use outbound HTTPS long polls. Long-lived credentials are never printed. A Swarm manager is required before cluster pages or mutations are enabled. |
| Nodes | Docker role/state/availability, labels, task placement, and engine-declared CPU/memory capacity from the selected machine agent | A target must be a remote Swarm manager for cluster operations; optional global host probes are not required for connection. |
| Stacks | Validate and deploy approved image-only Compose v3.9 application stacks; optionally pin all services to one selected node | Browser deployment requires a mounted reviewed namespace manifest. Stateful profiles remain Git-only; external secrets/configs/volumes must use the exact stack-name prefix, and Traefik labels are restricted to the approved HTTPS domain/resolver. |
| Services | Read a bounded service-log tail; restart, rollback, or scale a replicated service with fixed Docker command shapes | Mutations are off by default and every request has CSRF plus an audit record. The console permits a whole replica count from 0 through 1000 and deliberately omits replica control for global services. |
| Docker resources | Read containers, images, volumes, networks, secrets, and configs on the selected target, and create or delete networks, volumes, and configs; start, stop, restart, or remove a container; pull or remove an image | Reads are projections, not a socket proxy: container environment values are reduced to variable names, secret values are unreadable by Docker itself, and config payloads are never returned. Every create or delete is one fixed, CSRF-protected, audited command with its own typed confirmation phrase. |
| Monitoring health | Compact task, node, container, and disk trends over the rolling minute series; current alerts derived from manager evidence; recent Engine activity; explicit source boundaries for traces and scrape-target failures | The series is in-memory only, bounded to four hours per target, and lost on API restart; it holds counts and byte totals, never operator data. Logs, traces, and scrape failures are shown only when their owning collectors return them; long-range history remains the Prometheus stack SwarmOps deploys. |
| Command runner | Run any catalogued operation from the console against an explicitly chosen server: the form is generated from the operation's own parameter description, a read shows exactly what that server returned, and a mutation is queued in the ledger for it | The target is named per command rather than inherited from the shell's selection, and only a connected remote Swarm manager is eligible; the Command queue shows the server each row will change. The runner adds no capability. It builds requests only from catalogued routes, and a destructive entry stays disabled until the operator types the phrase the API derives for that exact target. |
| Cluster insights | Node, service, task, and container counts; fleet CPU/memory/disk capacity; image, volume, container, and build-cache disk usage with reclaimable totals; a bounded Engine event window; and swarm orchestration settings | Computed once on the control plane so every screen reads the same numbers. Pruning any resource kind needs its own `PRUNE_<RESOURCE>` confirmation; a volume prune destroys data SwarmOps cannot restore. |
| Swarm | Read the cluster object and raft/orchestration settings, set the task-history retention limit, and rotate a leaked worker or manager join token | Join tokens are never returned by any read path or by the rotation itself; enrolment stays an installer workflow on the machine. |
| Supported commands | A served catalogue of every read and mutation SwarmOps offers, with the Docker command each becomes, its API route, and the guards on it | The vocabulary is closed. An operation absent from the catalogue has no route, no queue action, and no argv the machine agent will accept. |
| Commands | Track every accepted remote mutation from admission through completion, retry, or operator attention | The API writes the command ledger before returning `202`; it exposes no raw payload, source archive, remote output, or secret. Safe controller-owned failure codes, summaries, and recovery guidance remain visible in Runs and on the initiating screen. The newest queued or retry-scheduled command for the same server/action/target atomically replaces the older one; running and needs-attention commands remain visible. |
| Images | Build a tarred local context with CPU/RAM caps and allow-listed immutable image tags; optionally push | Browser accepts `.tar`; `swarmops build --context` respects `.dockerignore`, never gives the manager a local path, and receives a queued command ID rather than remote build output. |
| Source deploy | Verify and seal GitHub, GitLab, GitHub Enterprise, self-managed GitLab, or Gitea/Forgejo-compatible tokens; list accessible repositories; resolve a ref to a commit; find every Compose file and Dockerfile at any depth; build and deploy one classified application | Private hosts require an exact `SWARMOPS_SOURCE_ALLOWED_HOSTS` entry. Provider content is evidence only: browser responses and audit records contain paths, digests, classifications, and findings—not tokens, Compose/Dockerfile bodies, environment values, build contexts, or logs. Only regular files from the pinned build context enter the encrypted artifact queue. |
| Edge / TLS | Typed HTTP/TCP/UDP routes, service-role inventory, isolated dependency bindings, static entrypoints, Cloudflare/Arvan DNS records, ACME state/retry, bounded logs, internal Prometheus status, and one-action cutover | Raw labels/rules/provider URLs/queries are never accepted. Every mutation is durably queued for the selected manager; public exposure is denied by default and static changes warn that they restart the singleton. |
| Applications | Render and deploy an application from a small spec: approved slot, immutable image, container port, health path, attached databases, metrics/tracing, optional backend, and an optional policy-bounded domain | SwarmOps generates the Compose and puts its own output through `ValidateCompose` and platform admission. Manual applications use an already-pushed image; Source deploy may first build a pinned repository context through the same capped build service. Exact domains and optional suffix policies come from the reviewed manifest, runtime assignments are unique, and removal needs the application-specific confirmation. |
| Databases | Deploy or remove one managed PostgreSQL, MongoDB, or Redis instance from the console | Each is a reviewed, checked-in Compose asset rendered on the controller; the browser never authors it. The password and routed connection URI are generated as Swarm secrets and never returned to a browser. Each engine is pinned to a `nim.stateful=true` node and attached only to its encrypted service-and-Traefik overlay; removal needs the exact `REMOVE_DATABASE_<ENGINE>` confirmation and leaves the named volume in place. |
| Observability | Prometheus + Alertmanager + Jaeger core stack; separately enable/disable the read-only agent/node-exporter and Docker JSON-log collection. Applications that publish metrics are discovered automatically, and SwarmOps renders its own operator graphs and metrics. | Every scrape/dependency path uses a typed internal Traefik alias. The console exposes bounded, product-owned views rather than arbitrary PromQL or a separate dashboard service. |
| Provisioning | After enrollment, Server readiness shows the agent's bounded live host snapshot and queues typed Docker install/repair, Swarm init/join/leave, manager promotion, node availability, package, and diagnostic operations for explicit targets. | Docker comes from Docker's signed apt repository. Host inspection exposes capacity and OS metadata, never files, processes, environment, package lists, or command output. The agent validates each closed operation locally; no arbitrary remote shell or Docker-socket proxy exists. |
| Platform admission | Validate a non-secret platform manifest offline or against fresh authenticated node inventory | It rejects duplicate namespace/domain claims, unavailable capacity, incompatible certificate settings, and unsafe stateful placement before a build or deployment is requested. |
| Agent operations | Queue a typed operation for one node or an explicit node set and inspect durable attempts, evidence, retries, and attention states. | Agents lease work through outbound HTTPS, acknowledge ordered events, resume after disconnects, and reject commands from stale Core authority epochs. |
| Backups | Install an opt-in Restic timer for local Docker named-volume paths to S3-compatible storage | Credentials are supplied only through a protected controller-side file; repository initialisation and restore validation stay explicit operator actions. |

## Architecture

```text
hosted browser ── HTTPS ──────────────────────────┐
local Vite UI ── relative /api proxy ──────────────┼──> active SwarmOps core
                                                    │    (separate identity; no Docker socket)
                                                    │
                                  outbound mutual-TLS long polls
                                                    │
                             independently enrolled Ubuntu machine agent
                                                    │
                                      Docker host / Swarm manager / local Engine

trusted workstation ─ swarmops tar stream ─> API build endpoint ─> encrypted command ledger ─> selected remote Engine
private Git provider ─ bounded HTTPS API ─> evidence plan ─ regular-file tar ────────────────┘
```

- `cmd/api` serves the React build and authenticated API on port `8084`. The
  default active core is constrained to a manager with `nim.control=true`; its
  named volume holds AES-256-GCM-sealed server profiles, audit history, command
  metadata/payload, pending build contexts, and non-secret core-topology state.
  It starts without a Docker daemon or socket. A restored standby has its own
  stable core ID and blocks agent/cluster operations until it is explicitly
  promoted.
- `swarmops` runs on the operator workstation for a real local build
  path. It prompts for a password securely or reads it once from stdin.
- `internal/enroll` defines the single copy-paste token: origin, pinned leaf
  fingerprint, and a one-time enrollment secret. The agent serves exactly one
  `POST /v1/enroll` exchange, burns the secret, deletes its on-disk copy, and
  closes the window permanently — including after a small budget of failed
  attempts.
- `internal/remote` owns the pinned machine-API transport. It exposes a
  bounded Docker facade and fixed Docker command shapes only; it never exposes
  a shell, socket proxy, or remote filesystem API to the browser.
- `internal/ops` is the narrow mutation boundary. It owns Compose policy,
  selected-node placement injection, and audit calls. Domain data does not
  depend on HTTP, a machine API, or Docker.
- `internal/coretopology` owns the separate core-membership and handoff record.
  It has no remote shell, Docker, or agent-registration path.
- `internal/queue` is the active-core command ledger and worker. It admits only
  fixed mutation shapes, serializes remote execution, preserves every accepted
  command across an API restart, and does not claim work while the local core
  is standby.

## Durable command lifecycle

All approved remote mutations — node availability, application-stack deploy,
service action, image build, Traefik reconciliation, and reviewed
observability controls — require an `Idempotency-Key`. After admission and
policy checks, SwarmOps atomically writes an encrypted command record before
returning HTTP `202` with a command ID. The matching console route shows only
safe metadata: action, target, state, attempt count, next retry, and a bounded
failure code, operator summary, and recovery hint. Raw remote output and error
text remain excluded, but the failure class and next action are retained instead
of collapsing every problem into the same generic sentence.

The active-core worker runs one command at a time. Its states are `queued`,
`running`, `retry_scheduled`, `succeeded`, and `needs_attention`. Only
reconcilable fixed actions receive bounded automatic retry: 2, 4, 8, 16, 32,
then 64 seconds, with no more than eight attempts. A shutdown, timeout, API
restart while a command is running, deterministic policy error, non-retryable
action, or exhausted retry budget becomes `needs_attention`; SwarmOps never
blindly replays an uncertain remote effect. An operator can manually requeue
that terminal state after inspecting the target. Runs shows current blockers
for known workflows and disables retry while a required agent connection,
managed gateway, or placement label is absent. A planned fence stops it from
claiming new work; it does not cancel an already-running remote operation. The
worker also retries a
transient durable-store failure with bounded exponential backoff before it
stops, and every store transition rolls back its in-memory change when the
encrypted write fails, so a claim can never leave a phantom running command.

The ledger is bounded: succeeded commands beyond
`SWARMOPS_COMMAND_HISTORY_LIMIT` (default `2000`) are pruned oldest-first on
each transition. Queued, running, retry-scheduled, and needs-attention
commands are never pruned, and pruning only takes effect once the sealed
write succeeds.

Command metadata and JSON payloads are AES-256-GCM sealed in the controller
volume. A build source archive remains in an AES-256-GCM-sealed, owner-only
(`0600`) spool until it can stream to Docker; it is never returned by the API,
browser, or audit log and SwarmOps attempts immediate deletion after a
successful lifecycle write. A failed upload is retained as a visible
`needs_attention` command rather than silently discarded. Server-profile
connect/disconnect and local login/session management are not remote mutation
commands and remain synchronous.

## Versions

The current version is `0.9.3`. Release history is in
[CHANGELOG.md](CHANGELOG.md), and the public reference — capabilities, use
cases, changelog, and roadmap — is published at
[nim.zone/docs/swarmops](https://nim.zone/docs/swarmops).

## Decision artifacts

- [Console information architecture](docs/console-information-architecture.md)
  defines the single-owner navigation model, contextual-summary boundary, and
  acceptance criteria for removing legacy duplicate workspaces.
- [System design](docs/SwarmOps-System-Design.docx) records the technical
  architecture, trust boundaries, rollout sequence, and test strategy.
- [Platform expansion system design](docs/SwarmOps-Platform-Expansion-System-Design.docx)
  records the admission, fleet, backup, DNS, registry, and stateful-workload
  design introduced for this operating model.
- [Docker-free controller system design](docs/SwarmOps-Docker-Free-Controller-System-Design.docx)
  records the separate-host direct-TLS, encrypted-state, and recovery model.
- [Control-plane topology system design](docs/SwarmOps-Control-Plane-Topology-System-Design.docx)
  records the explicit core/agent boundary, restored-standby evidence, and
  fenced promotion workflow without an automatic-HA claim.
- [Durable command queue design](docs/SwarmOps-Command-Queue-System-Design.docx)
  records the write-before-execute invariant, retry policy, agent boundary,
  and rollout gates for this lifecycle.
- [Source-to-deploy system design](docs/SwarmOps-Source-to-Deploy-System-Design.docx)
  records provider adapters, sealed credentials, evidence classification,
  managed/shared substitutions, dynamic-domain policy, and rollout gates.
- [Source-to-deploy ADR](../../docs/adr/ADR-0006-swarmops-source-to-deploy.md)
  records why repository Compose remains evidence rather than executable input.
- [Docker-free controller ADR](../../docs/adr/ADR-0003-docker-free-swarmops-controller.md)
  records the security trade-offs and production evidence gates.
- [Business review](docs/SwarmOps-Business-Review.pptx) frames the adoption
  decision and its explicit production-evidence gates.
- [Operating review](docs/SwarmOps-Operating-Review.pptx) is the operator
  rollout checklist and ownership decision queue.

## Local UI against the control manager

The standard local workflow runs the UI only. Point Vite at the HTTPS origin of
the deployed SwarmOps API on the designated manager:

```bash
cd apps/swarmops
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

The console has eight stable areas: **Overview**, **Deliver**, **Fleet**,
**Workloads**, **Traffic**, **Observe**, **Activity**, and **Control**. They
appear in a persistent desktop icon rail and in the same order with labels in
the mobile drawer. A
contextual sidebar shows the destinations owned by the active area and becomes a
horizontal strip on narrow screens. The masthead keeps controller authority separate from the
selected Swarm cluster, and every cluster read or mutation continues to carry
that explicit manager target. Pages that require a
manager show a selected-manager workspace with direct recovery paths instead
of silently replacing the requested destination.

The production console uses one calm command-center geometry at the 1536×1024
reference viewport: a compact masthead, top-level icon rail, contextual sidebar,
table-first evidence, and one malachite action language. Overview names the
evidence path and hands back the single next operator decision; Fleet opens the
topology and then a node; node container rows open health, resource sample,
configuration, telemetry boundary, and fixed restart/stop actions. Deliver,
Traffic, Observe, Activity, Workloads, and Control preserve the same header,
breadcrumb, panel, table, and review-sheet hierarchy. A surface never invents missing logs,
traces, scrape failures, routes, or telemetry: it labels the unavailable
source and directs the operator to the owning collection view.

### First server onboarding

The sign-in screen includes **Install and connect a server**, so an operator
can discover the install-first flow before signing in. The Ubuntu agent prints
a short-lived approval code, keeps its private key and redemption secret on the
host, and waits. After sign-in, **Fleet → Servers** gives equal
prominence to approving that code or generating a one-command certificate
grant.

For an install-first agent, run:

```bash
curl --fail --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh \
  | sudo bash -s -- --core https://core.example.com --core-fingerprint 'SHA256:<64-hex>'
```

Copy the fingerprint from Core's trusted server console or the command rendered
by SwarmOps, then approve the printed code within 15 minutes. After approval, the agent redeems
the certificate over the same pinned Core identity, installs its systemd
service, and appears without an inbound port or manually handled credential.

### Cluster overview

Overview is a summary-first operator control room. It
refreshes from the selected manager every 30 seconds and combines the current
cluster snapshot with reviewed stack, Traefik, and observability status. Its
attention queue puts failed nodes, degraded applications, and commands needing
review ahead of the fleet, application, traffic, and recent-operation tables.
Monitoring → Health owns the bounded minute-sample charts and source-labelled
Engine activity.

Automatic refreshes are non-destructive: the console keeps the current
workspace, selected manager, filters, and last successful data mounted while a
new snapshot is read. A temporary agent disconnect reports degraded or stale
state in place; it does not send the operator back through the first-run screen
or silently retarget the console. The selected manager is retained only for the
current browser session and is cleared on sign-out.

SwarmOps retains only a bounded in-memory operational series; it is not a
long-range performance database and disappears when Core restarts. CPU remains
declared core capacity rather than inferred utilisation from load average.
Memory and disk figures are shown only from the selected manager and healthy
read-only host probes; missing coverage stays visibly unknown.

### Local development

Run the complete local path with:

```bash
make local
```

It creates or reuses a private development identity under
`$TMPDIR/swarmops-dev` (override with `SWARMOPS_DEV_DIR`), then starts
Core at `http://127.0.0.1:8084` and the Vite console at
`http://127.0.0.1:5284` when it is free (Vite prints the next loopback port if
it is occupied). Sign in with `admin` / `admin`. The Core connects the
loopback agent when it is running through a pinned local certificate and a private
API key; neither credential goes through the browser or the saved profile.
Set `SWARMOPS_WEB_PORT` before `make local` to choose a different preferred UI
port.

The agent is a host process, not a Docker container. Run `make dev-agent`
when you want it on the host; `make dev` and `make local` run Core and the
console only. `make dev-api` runs only Core while preparing the same local
identity.

The development session/data key is persistent instead of being regenerated at
each launch. New Core state is kept in `$SWARMOPS_DEV_DIR/core`, deliberately
separate from the former `$TMPDIR/swarmops-dev` root state that may have been
sealed with an unrecoverable old key. The commands never delete existing state;
choose a new `SWARMOPS_DEV_DIR` when an intentionally clean local instance is
needed. The development password hash can be overridden with
`SWARMOPS_DEV_PASSWORD_HASH` when launching the API manually.

`SWARMOPS_INSECURE_DEV_AUTH` is absent from the Swarm manifest, which always
uses external secrets; never set the development flag or values in a host
environment file or Swarm service.

## Direct Docker-free controller

For a separate, freshly installed controller host, run the bootstrap from a
reviewed checkout. It serves the compiled GUI and API from that host only; it
does not install Docker, join a Swarm, or contact a cluster.

```bash
sudo bash scripts/bootstrap-swarmops-control-plane.sh \
  --listen-ip <literal-server-ip> \
  --allow-cidr <operator-device-ip>/32 \
  --install-dependencies
```

To bootstrap a recovery candidate, give it a different stable identity and a
standby role from the start:

```bash
sudo bash scripts/bootstrap-swarmops-control-plane.sh \
  --listen-ip <literal-standby-ip> \
  --allow-cidr <operator-device-ip>/32 \
  --core-id core-manager-02 \
  --core-mode standby
```

The command requires the exact IP already configured on the server and one or
more trusted operator CIDRs. It prompts for a 16+ character administrator
password, generates independent session and AES-256-GCM data keys, builds the
embedded React console, installs a restricted systemd service, and chooses a
random high TCP port. Before it prints the panel URL or login name, it waits
for Core's local TLS `/readyz` endpoint, which verifies both the durable audit
and command stores. If the service stops or does not become ready within 60
seconds, the installer prints the service issue, rolls back the new service,
runtime, configuration, and state, and prints no panel login details. On
success it prints the HTTPS URL, `operator` login name, and SHA-256 certificate
fingerprint. Verify that fingerprint from a trusted server console before
accepting the self-signed IP certificate in a browser.

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

### Optional plaintext HTTP listener

A direct-TLS Core can also open a second operator-only HTTP listener. It is
disabled by default, never replaces the primary HTTPS listener, and rejects all
`/agent/*` enrollment, polling, response, and certificate routes. This is a
break-glass compatibility path for an operator browser that cannot accept the
generated certificate; passwords, session cookies, and API responses are not
encrypted on this listener.

The safer form stays on loopback and is reached through an SSH tunnel. Add these
values to the native service environment at
`/etc/swarmops/control-plane.env`, then restart Core:

```bash
SWARMOPS_HTTP_ENABLED=true
SWARMOPS_HTTP_LISTEN_ADDR=127.0.0.1:8085
SWARMOPS_HTTP_ALLOW_REMOTE=false
```

```bash
sudo systemctl restart swarmops-control-plane.service
ssh -L 8085:127.0.0.1:8085 <ssh-user>@<controller>
```

Then open `http://127.0.0.1:8085`. The native bootstrap already includes
`127.0.0.1/32` in `SWARMOPS_ALLOWED_CLIENT_CIDRS`.

If HTTP must be reachable directly, bind a different unused port on the
controller IP and explicitly acknowledge the exposure:

```bash
SWARMOPS_HTTP_ENABLED=true
SWARMOPS_HTTP_LISTEN_ADDR=<literal-controller-ip>:<unused-port>
SWARMOPS_HTTP_ALLOW_REMOTE=true
SWARMOPS_ALLOWED_CLIENT_CIDRS=<preserve-existing-bootstrap-cidrs>
```

Restrict that port to the same CIDRs in the host/cloud firewall. To disable the
listener, set both `SWARMOPS_HTTP_ENABLED=false` and
`SWARMOPS_HTTP_ALLOW_REMOTE=false`, then restart
`swarmops-control-plane.service`. Core refuses to start if remote HTTP lacks the
explicit acknowledgement or a client allowlist, if its address collides with
the primary listener, or if primary TLS is not configured.

The bootstrap writes a stable `SWARMOPS_CORE_ID` derived from its bound IP and
marks the initial service `SWARMOPS_CORE_MODE=active`. A replacement controller
must use a different stable ID and `SWARMOPS_CORE_MODE=standby`; stop its API
before restoring a complete state copy, restore the matching data-encryption
key through the protected host path, then start it and use **Controller & recovery** to
record verification and promote it. Do not mount the same local state directory
on two machines, use a network filesystem as live controller state, or start
two active cores.

## Direct machine agent (Linux and macOS)

### Legacy direct-listener migration

The target Docker machine runs a native agent from this repository; it is not
the global read-only `swarmops-agent` Swarm service. The following inbound mode
is retained only to migrate existing installations; new production agents use
outbound Ubuntu enrollment. On Linux, run the installer
with `sudo`. On macOS, run it as the logged-in Docker Desktop user, without
`sudo`. The command below is for a full Nim source checkout; for the published
operator package, use the dedicated `nimasrn/SwarmOps` checkout in
[First server onboarding](#first-server-onboarding):

```bash
bash scripts/install-swarmops-agent.sh \
  --listen-addr 0.0.0.0:9180 \
  --tls-cert-file /secure/swarmops-agent.crt \
  --tls-key-file /secure/swarmops-agent.key
```

The installer clones or fast-forwards `https://github.com/nimasrn/nim.git`
(`main` by default), builds `cmd/agent`, and installs a systemd service on
Linux or a per-user LaunchAgent on macOS. It also installs a fixed trusted-Git
update check: the host runs it every six hours, and a current connected Core
can only ask the host to run that same local check. The updater verifies its
configured upstream before it fast-forwards and rebuilds the native service.
This legacy updater is not the signed Current/Candidate/Previous supervisor
specified for the completed product and must not be represented as one. It
never accepts an update URL, branch, executable, or shell command from Core or
a browser. Use `--no-auto-update` to remove the timer and request path
explicitly; custom Git sources and branches disable unattended updates. Pass
`--install-dependencies` only when its documented Debian/Ubuntu or Homebrew
package installation is appropriate. With `--install-docker` and
`--init-swarm`, it can prepare a fresh Debian/Ubuntu host before the agent
starts; the normal outbound flow instead leaves Docker and Swarm to
Infrastructure readiness. On Linux it also installs a private Unix-socket provisioning helper;
after enrollment, readiness can request only the documented fixed OS,
Docker, single-node Swarm, and CIDR-scoped UFW operations. It never prints the
generated API key.

It writes the Core URL and root-owned identity directory into its protected
service environment. The outbound private key and renewable certificate remain
owner-readable only; the agent refuses unsafe state permissions.

To rotate the machine API key on an existing host, run the installed binary
directly and restart the service:

```bash
sudo /usr/local/lib/swarmops-agent/releases/current/swarmops-agent gen apikey --key-file /etc/swarmops-agent/api-key
sudo systemctl restart swarmops-agent.service
```

The command prints the new API key so you can paste it into the same server
profile in the panel. The old key is invalid immediately after restart.

If you prefer a shorter command, create a root-owned symlink once:

```bash
sudo ln -sf /usr/local/lib/swarmops-agent/releases/current/swarmops-agent /usr/local/bin/swarmops-agent
```

Then run `swarmops-agent gen apikey --key-file ...` from shell.

On Linux, keep the TLS files outside `/home`, `/root`, and `/run/user`: the
installed systemd service protects home directories. The agent must remain
reachable only from the controller through an explicit firewall rule.

The installer prints the machine API port and a public TLS certificate
fingerprint in `SHA256:<64-hex>` form, and gives the protected key-file path.
Copy the key through an approved secure channel. Then open **Servers** and add
the HTTPS origin without a port, the port, the fingerprint, and that key. The
controller pins the exact leaf certificate and retains the key only until the
server disconnects. By default, enrollment-based controllers seal the key in
their encrypted local state so they can reconnect after restart; set
`SWARMOPS_RETAIN_MACHINE_KEYS=false` to require an explicit reconnect instead.

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

## Private source-to-deploy

Source deployment is a separate, default-off controller capability. Enable it
only after the controller data key, provider-token revocation process, selected
manager, platform manifest, registry, and build policy are ready:

```bash
SWARMOPS_SOURCE_ENABLED=true
SWARMOPS_SOURCE_ALLOWED_HOSTS=github.company.example,gitlab.company.example
SWARMOPS_SOURCE_IMAGE_PREFIX=ghcr.io/nimasrn
SWARMOPS_IMAGE_PREFIXES=ghcr.io/nimasrn/
SWARMOPS_BUILD_ENABLED=true
```

`SWARMOPS_SOURCE_ALLOWED_HOSTS` is needed only for private/self-managed hosts;
use the exact hostname (and port when non-standard). GitHub.com, GitLab.com,
and Gitea.com API origins are built in. Enter the full API base for a private
installation: typically `https://github.example/api/v3`,
`https://gitlab.example/api/v4`, or `https://git.example/api/v1`. Unknown
forges need a reviewed adapter; SwarmOps is not an arbitrary Git/HTTP proxy.

The controller verifies `/user` before saving a connection, then AES-256-GCM
seals the token in `source-connections.sealed`. Use a provider token with only
the read scopes required to list repositories, read trees/files, resolve
commits, and download an archive. The token is sent only in the provider's
authentication header. It is never returned to the browser, copied to a
command payload, mounted into a build, or written to audit. Updating a
connection verifies the replacement token before the sealed record changes;
removing it deletes the sealed credential.

The guided flow is deterministic:

1. Choose a sealed connection and one accessible repository.
2. Resolve the selected branch/tag/SHA to an immutable commit.
3. Scan the bounded recursive tree for every canonical or named Compose file
   (`compose.yml`, `compose.production.yaml`, `docker-compose.dev.yml`, and
   their `.yaml` forms), plus every `Dockerfile` and `Dockerfile.*`, including
   nested monorepo applications. Each discovered Compose variant receives its
   own immutable build identity.
4. Review classifications. Application services become closed
   `ApplicationSpec` candidates. PostgreSQL, MongoDB, Redis, and Valkey become
   managed attachments. Prometheus, Alertmanager, Jaeger, Fluentd,
   node-exporter, and cAdvisor map to reviewed global stacks. Unsupported
   stateful engines and unsafe/ambiguous build evidence stop the candidate.
5. Select an approved application slot and, when its manifest permits it, an
   exact domain or hostname inside one reviewed suffix.
6. Queue one `source.deploy` command. It reconciles required managed/global
   stacks, builds and pushes the pinned regular-file-only context when needed,
   and deploys SwarmOps' generated Compose. The command has one automatic
   attempt because a build plus several declarative stages can partially
   complete; any uncertainty remains visible as `needs_attention`.

Source Compose, Dockerfile bodies, environment values, repository symlinks,
special files, commands, labels, mounts, and arbitrary networks are never
forwarded to Docker. The plan contains only bounded metadata and digests. A
database substitution provisions a new SwarmOps-managed service and connection
secret; it does not migrate source data. A domain assignment changes the
Traefik route, not authoritative DNS, so DNS resolution and ACME issuance still
need live verification.

## Local checks

```bash
cd apps/swarmops
go test ./...
cd web && npm run typecheck && npm run build

# Opt-in: runs Core -> encrypted queue -> pinned local machine agent ->
# disposable one-node Docker Swarm. It refuses to touch an already-active
# Swarm and removes only the uniquely named resources it creates.
cd ..
SWARMOPS_INTEGRATION_DOCKER=1 make integration

cd ../..
bash -n scripts/install-swarmops-agent.sh
make build APP=swarmops TARGET=api TAG=<immutable-tag>
make build APP=swarmops TARGET=agent TAG=<immutable-tag>
make build APP=swarmops TARGET=cli TAG=<immutable-tag>
make stack-check STACK=swarmops TAG=<immutable-tag>
make stack-check STACK=swarmops-agent TAG=<immutable-tag>
make stack-check STACK=swarmops-observability TAG=<immutable-tag>
make stack-check STACK=swarmops-logs TAG=<immutable-tag>
make stack-check STACK=mongo-replicaset TAG=<immutable-tag>
make stack-check STACK=postgres-primary-replica TAG=<immutable-tag>
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml

# The controlled build path will refuse to start until the same plan passes.
make swarmops-checked-build \
  MANIFEST=deploy/swarmops/platform.example.yml \
  APP=swarmops TARGET=api TAG=<immutable-tag>
```

No Docker daemon or Swarm is required to run the local UI against the deployed
API or use the console's Servers page. The target machine must run the native
agent before it can connect; Docker may be installed afterwards through the
closed Server readiness plan. A remote Swarm manager is required to verify
cluster placement, service operations, or Swarm mutations. A local Docker
daemon is still needed only to build the container images in the optional
image-build checks above.

## Platform admission before build or deploy

Use a reviewed, non-secret platform manifest for every cluster-wide rollout:

```bash
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml

# After a remote manager is connected through its machine API, compare the same
# manifest to that selected server's current Docker inventory. The controller
# API password is prompted locally.
cd apps/swarmops
go run ./cmd/swarmopsctl preflight \
  --manifest ../../deploy/swarmops/platform.example.yml \
  --url https://swarmops.example.com --username operator --server-id <server-id> \
  --core-fingerprint 'SHA256:<64-hex>'
```

Use `--core-fingerprint` when Core has the direct self-signed certificate made
by the native installer. Obtain the exact leaf pin from the authenticated
console-generated enrollment material or another trusted channel; the CLI
constant-time checks that pin and does not add a general insecure-TLS mode.

The manifest carries only public topology and versioned secret *names*. It
requires globally unique workload names within its namespace, unique routed
domains, and non-overlapping optional application-domain suffix policies. It
validates the selected registry (`ghcr` or
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
router whose name begins with `<stack-name>-`, claims its exact domain or a
hostname inside its reviewed suffix policy, and uses the declared resolver;
TCP/UDP routes, shared middleware, and arbitrary Traefik service settings stay
Git-reviewed. Any external secret, config, or volume must declare a safe
physical name beginning with `<stack-name>-` (or `<stack-name>_`). The closed
renderer may join only `traefik`, `swarmops-data`, and `swarmops`: edge,
managed-data, and shared telemetry respectively.
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

Enroll a fresh Ubuntu server with the one-time installer command, wait for its
agent health and compatibility report, then queue Docker installation and the
appropriate Swarm init or join operation from **Fleet → Host setup**.
Every mutation carries an explicit Core, cluster, and node target and remains
visible in **Activity → Runs** through disconnect, retry, or operator attention.

PostgreSQL primary/replica requires two separate `nim.postgres.slot` labels;
the Mongo replica set requires all three `nim.mongo.slot=1|2|3` labels. A
second node alone cannot safely create the checked-in three-member Mongo set.
After a reconnect or reboot, run the catalogued continuity diagnostic from the
node page before touching data. It checks Docker, Swarm membership,
local-volume continuity, and manager visibility; it never restores, deletes,
or promotes a database. The full stateful contract is
[`../../docs/swarmops-stateful.md`](../../docs/swarmops-stateful.md).

## Durable node operations

Use **Activity → Action catalog** or the `swarmops` CLI to submit a versioned catalog action
to an explicit node or node set. Core persists the command before acceptance;
an agent leases it, emits ordered state transitions, and resumes from its last
acknowledged cursor after an outage. Only retry-safe actions retry
automatically. An uncertain remote outcome becomes `needs_attention`, and a
newer exact queued intent supersedes only its older non-running equivalent.

## S3-compatible local-volume backups

The backup timer covers local Docker named volumes on each selected node. Its
protected environment file must contain only the Restic repository/password and
the S3-compatible credential variable names/values required by the chosen
provider; keep that file outside this repository with restrictive permissions.

The catalogued backup workflow backs up approved volume paths with retention
and does not expose
S3 credentials to SwarmOps. Each host tags and retains only its own snapshots;
the shared repository lock is retried for up to 30 minutes so simultaneous
timers do not silently skip a backup. Add each reviewed persistent bind-mount
root to `swarmops_backup_paths` in the protected inventory (never `/`) so the
allow-list covers all intended local state. It is a host-volume safety net, not a
database-consistency guarantee: MongoDB and Postgres require application-aware
logical/physical backup hooks and a documented, exercised restore before their
replica profiles are considered protected.

## DNS, certificates, registry, and cache

Traefik has three reviewed resolver names: `le`, `arvan`, and `http`. `le` uses
Cloudflare DNS-01 when its versioned credential exists, and `arvan` does the
same for ArvanCloud. A resolver whose usable DNS credential is absent is
rendered as HTTP-01 on public port 80 instead, so neither DNS provider secret
is an installation prerequisite. Wildcard certificates still require DNS-01;
their preflight remains blocked until the selected resolver has a credential.
The dashboard-auth secret remains required because the dashboard is never
published without authentication.

The preflight manifest accepts GHCR or a private registry and names the
versioned private-registry auth secret when needed. SwarmOps' own image build
uses a BuildKit npm cache mount; the manifest requires that intended build/cache
capacity is labelled `nim.build=true` and `nim.cache=true`. The bounded build
runs on the selected remote Docker Engine through the pinned machine API;
selecting that target is explicit in the console or `swarmops --server-id`.
The trusted
workstation chooses a local Dockerfile/context and uploads only a bounded,
`.dockerignore`-honouring tar stream; SwarmOps never scans arbitrary paths on
the GUI machine.

## Production prerequisites

1. Deploy one active SwarmOps core on the designated control manager
   (`node.role == manager` and `nim.control=true`) with a stable
   `SWARMOPS_CORE_ID`. Its `swarmops_data` volume keeps AES-256-GCM-sealed
   control-plane profiles, audit history, command ledger, and handoff state on
   that node; the API image and mounted Swarm configs provide the production
   console and reviewed deployment assets there. It starts without a local
   Docker socket. The core host is not added to **Servers** automatically:
   install and enrol a native machine agent independently when that host must
   be operated. Sign in through the active API, install the native Ubuntu agent
   on each selected host through either certificate flow, and wait for its
   outbound health report. Select the target only after it is a Swarm manager.
2. Form the Swarm with typed init/join/manager-promotion operations. In
   **Traffic → Gateway & ports**, the **Fix all prerequisites** action can
   create the encrypted `traefik` overlay and set `nim.edge=true` on the
   deterministic ready manager. One manager is allowed and shown as
   non-resilient; three managers are the recommended target.
3. Build and push the immutable API and agent images through the root Makefile.
4. Create the versioned external secrets from permission-restricted files
   outside this repository. The API needs a bcrypt hash (not a cleartext
   password), at least 32 random bytes for the session key, a base64-encoded
   random 32-byte data-encryption key, and a standard Docker `config.json`
   only when a remote Engine must push a private image.
   That JSON is sent over the encrypted Docker API stream for the build and
   never reaches the browser. Remote Swarm nodes use their own reviewed image
   pull credentials for private-stack deployments.
5. Use **Fix all prerequisites** to copy the mounted reviewed dynamic config
   and generate the required `htpasswd` dashboard-auth secret; save the
   one-time dashboard login shown by the panel. Add a Cloudflare DNS-token or
   ArvanCloud API-key secret only when DNS-01 is wanted; without one, SwarmOps
   uses HTTP-01. The dashboard is routed to `api@internal`; port `8080` is
   never published.
6. Configure a reviewed Alertmanager receiver before
   relying on notifications; the committed baseline uses a blackhole receiver.
   Jaeger uses the checked-in v2.20 Badger config on the labelled stateful
   node, so its volume needs a backup/recovery procedure.
7. Set non-secret host values such as `SWARMOPS_HOST`,
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
make secret-create HOST=manager-01 SECRET=traefik_dashboard_auth_v1 FILE=/secure/traefik-dashboard.htpasswd

# Optional: create only the DNS-01 provider credentials you intend to use.
make secret-create HOST=manager-01 SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 SECRET=traefik_arvan_api_key_v1 FILE=/secure/traefik-arvan-api-key
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

# After the versioned SwarmOps observability configs exist:
make deploy STACK=swarmops-observability HOST=manager-01 TAG=<immutable-tag>
```

The console can also deploy/remove the reviewed observability core after a
user enables `SWARMOPS_MUTATIONS_ENABLED=true`. It can separately install the
read-only agent/node-exporter stack and enable the log stack only after the
core and API are healthy.

For the first controlled rollout, leave `SWARMOPS_MUTATIONS_ENABLED=false` and
`SWARMOPS_BUILD_ENABLED=false`, log in, connect a remote manager, verify node
inventory, Traefik HTTPS/dashboard access, Prometheus targets,
Alertmanager delivery, and Jaeger
storage. Enable each mutation surface deliberately
afterwards.

## Auth and audit

The initial production model is one operator account. Its bcrypt hash and HMAC
session key are Swarm secrets when the optional stack is used. The browser receives a
short-lived HTTP-only SameSite cookie and CSRF token; no password or token is
persisted in the client. Login attempts are locally throttled and Traefik adds
an edge rate limit to the login route.

By default the throttle key is the username plus the socket peer address,
because a forwarded header is attacker-controlled without a trusted-proxy
boundary. Set `SWARMOPS_TRUSTED_PROXY_CIDRS` to the reverse proxy's source
networks (comma-separated CIDRs) when running behind one: only then is
`X-Forwarded-For` honoured, resolving each login attempt to its first
untrusted address so clients behind a shared proxy are throttled individually
and cannot lock the operator account out from one shared bucket. A malformed
or fully trusted forwarding chain falls back to the socket peer.

Audit events are bounded JSONL-style records sealed in the API's named volume.
They contain actor, target, action, outcome, request ID, and non-sensitive details.
They never contain cleartext credentials, Compose content, build contexts,
registry configuration, or service-log output. Only the most recent
`SWARMOPS_AUDIT_MAX_EVENTS` records (default `10000`) are retained, so failed
login attempts cannot grow controller memory or disk without bound; a failed
audit write is logged loudly rather than silently dropped.

The command ledger is separate from audit history: it is the durable source of
truth for accepted command intent and local lifecycle, not proof that a remote
Docker side effect occurred exactly once. It records safe state transitions in
the audit trail without copying command payloads, source archives, or remote
output.

Server profiles persist display metadata, the pinned machine API endpoint, and
the last bounded safe agent-health evidence in sealed state beside the audit
data. API keys are never returned, placed in a Swarm secret, or included in
audit records. Enrollment-based controllers seal the key separately by default
so a restart can reconnect; set `SWARMOPS_RETAIN_MACHINE_KEYS=false` for the
memory-only posture.

The Servers panel reports safe, actionable connection diagnostics for TLS-pin
mismatches, rejected API keys, machine-API reachability, disabled control, and
Docker Engine failures. **Agent diagnostics** retains the last authenticated
probe plus bounded agent and Core events, so an unreachable server does not
silently stay green. It intentionally does not copy service logs, command
output, credentials, raw remote responses, or unreviewed error text to the
browser.

The fingerprint pins the exact TLS leaf certificate presented by the machine
agent. Verify its public SHA-256 fingerprint from the target's trusted console
before saving it; a certificate renewal or reverse-proxy change requires an
explicit verified profile update.

## Important limitations

- The control plane runs one active core at a time. It can record a standby,
  an operator-attested restore, a fenced handoff, and an emergency promotion,
  but it has no shared-state quorum, automatic health election, or automatic
  failover. A complete encrypted-state/key restore and external primary fencing
  are required before a standby can safely become active.
- A remote host can be enrolled with the native machine agent before Docker is
  ready. Cluster operations still require a selected remote Swarm manager.
  Server readiness supports only one pinned Debian/Ubuntu host and its closed
  fixed plan. Multi-manager changes use the same typed, explicit-target agent
  operations and remain visible in the durable command ledger.
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
