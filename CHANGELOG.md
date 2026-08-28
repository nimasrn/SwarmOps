# Changelog

All notable changes to SwarmOps are recorded here, newest first. The published
version is the `version` constant in [cmd/api/main.go](cmd/api/main.go), and the
same history is served to the public at
[nim.zone/docs/swarmops](https://nim.zone/docs/swarmops) from
`apps/nim/content/docs/swarmops.json`. All three must agree — see
[AGENTS.md](AGENTS.md), "Release duty".

Roadmap entries live in the site record rather than here, because a roadmap is
read by people deciding whether to adopt SwarmOps, not by people reading the
source.

## 0.7.7 — 2026-08-28

This patch keeps live operations stable during polling and makes failed
commands explain their safe next action.

- **Silent live refresh** — background command, audit, log, and cluster polls
  retain the mounted workspace and last successful data instead of replacing
  the screen with a loading or landing state.
- **Stable explicit targeting** — the selected manager survives transient agent
  disconnects for the browser session and is cleared on sign-out, preventing
  an automatic switch to a different cluster.
- **Actionable needs-attention state** — the command ledger retains bounded,
  non-secret failure codes, summaries, and recovery hints. Observability runs
  surface missing gateway, agent, and stateful-placement prerequisites, link to
  their setup screens, and disable retry until those blockers are resolved.

## 0.7.6 — 2026-08-28

This patch closes two safety and language gaps found during the authenticated
production walkthrough.

- **Truthful gateway status** — the panel now says that no SwarmOps-managed
  gateway is present without claiming host-native or Docker Compose proxies are
  absent, and the install review explicitly requires checking HTTP/HTTPS port
  ownership first.
- **Consistent controller language** — control-plane recovery, enrollment,
  diagnostics, and overview copy now use “controller” instead of exposing the
  internal Core implementation term.

## 0.7.5 — 2026-08-28

This patch makes automatic Core updates schedule correctly even when the
Warden timer is installed or enabled long after the host booted.

- **Reliable timer activation** — the Core Warden uses `OnActiveSec=15m`
  followed by its 12-hour interval, so enabling the timer always produces a
  future trigger instead of an already-elapsed unit with no next run.

## 0.7.4 — 2026-08-28

This patch completes the native update path for outbound machine agents.

- **Health-checked outbound upgrades** — an outbound Agent now serves its
  existing health handler on IPv4 loopback only, giving Warden a local liveness
  gate without opening an inbound control port.
- **Older-install compatibility** — `swarmops-agent upgrade` prefers the fixed
  Warden unit and falls back to the older fixed Git updater unit when that is
  the installation contract present on the host.

## 0.7.3 — 2026-08-28

This patch makes every native Core access path enforce the same bounded client
network policy before a configuration can reach systemd.

- **Consistent access validation** — the installer and `access set-cidrs`
  command now reject IPv4 and IPv6 catch-all networks just as Core startup does.
- **Safe production migration** — existing unrestricted installations can be
  narrowed transactionally; certificate-IP and loopback access are preserved,
  readiness is checked, and a failed restart restores the previous policy.

## 0.7.2 — 2026-08-28

This patch restores direct Warden upgrades from every supported pre-0.7 Core
while retaining the complete native release bundle introduced in 0.7.1.

- **Backward-compatible release assets** — Fluentd configuration payloads now
  use the Warden's established flat `.yml` archive namespace. Their container
  mount targets remain `fluent.conf`, so runtime behavior is unchanged.
- **Proven upgrade bridge** — a v0.6.2 Core can stage, checksum, switch to, and
  health-check the complete 0.7.2 bundle through the normal `swarmops-core
  upgrade` command without replacing the updater out of band.

## 0.7.1 — 2026-08-28

This release reorganizes the console around operator tasks and closes the
remaining setup dead ends discovered during end-to-end release validation.

- **Operator-centered console** — the sidebar now groups Overview, Cluster,
  Workloads, Networking, Monitoring, Activity, and Settings; old implementation
  labels such as Observe, Operations, Traffic, and Control plane are removed.
- **Visible action workflows** — readiness uses fix actions instead of a switch
  plan, catalog actions open immediately in a responsive review sheet, Runs and
  Resources expose working filters, and queued work links back to Activity.
- **Clear gateway and source setup** — Traefik has an explicit reviewed install
  action; entrypoints, certificate resolvers, and Cloudflare/ArvanCloud DNS
  credentials are separated; source/registry blockers have a guided setup action.
- **Unified log workspace** — Monitoring → Logs provides typed filters, cursor
  paging, five-second live polling, current-container enrichment, and health banners.
- **Complete native bundles** — Core release archives now carry and verify every
  reviewed Prometheus, Alertmanager, Jaeger, Fluentd, and Traefik configuration
  alongside their stack assets, so Warden upgrades cannot install a partial runtime.

## 0.7.0 — 2026-08-28

This release replaces the former log runtime with a SwarmOps-owned Fluentd
pipeline and one bounded, manager-targeted log workspace.

- **All managed-node logs** — a global Fluentd 1.19.3 forwarder tails Docker
  JSON stdout/stderr and the host systemd journal with persistent cursors,
  acknowledged forwarding, retry-forever file buffers, and backpressure.
- **Fixed safe records** — input is reduced to one schema, control characters
  are removed, messages stop at 32 KiB, and secret-like material is redacted
  before storage. Command output remains only in its bounded ledger.
- **Bounded local retention** — UTC one-minute JSONL partitions expire after
  seven days and are evicted oldest-first at the 20 GiB hard cap, with buffer,
  malformed-record, retained-byte, and capacity-warning status.
- **One query contract** — the new targeted logs and status APIs accept only
  validated literal filters, opaque cursors, bounded pages, deadlines, and
  response sizes. Service and Traefik log endpoints use the same query path.
- **Private route split** — Forward traffic and agent HTTP queries use distinct
  encrypted routes; neither listener is public.
- **Unified console** — Observe → Logs provides typed filters, cursor paging,
  five-second live polling, current-container enrichment, and health banners.
- **Migration boundary** — source collectors are recognized as replaceable
  infrastructure. Historical data is neither imported nor deleted, and this
  prepared release does not mutate a live cluster.

## 0.6.2 — 2026-08-28

This reliability release repairs first enrollment against the self-signed TLS
identity created by the Docker-free Core installer, closing the restart loop
that left legacy in-memory agent profiles permanently disconnected.

- **Authenticated first contact** — Core publishes its exact SHA-256 leaf
  fingerprint over the same direct HTTPS endpoint and includes it in every
  authenticated one-time enrollment grant. The console carries that pin in
  each generated install command.
- **No insecure TLS fallback** — the Agent accepts a Core pin only in the
  strict `SHA256:<64-hex>` form and constant-time checks the presented leaf.
  Without a pin it keeps normal system-CA verification; it never silently
  disables certificate verification.
- **Restart-safe transport** — newly enrolled agents keep their private key
  locally and reconnect to Core with renewable mTLS outbound long polls, so a
  Core restart no longer depends on a memory-only legacy API key.
- **Ordered restart recovery** — Core advances a restarted in-memory broker to
  the durable cursor reported by the authenticated agent, so the next leased
  command cannot be rejected as a replay after Core restarts.
- **Truthful connection health** — an outbound profile becomes disconnected
  after 45 seconds without a poll and reconnects automatically on the next
  authenticated lease. Diagnostics support outbound agents instead of
  rejecting them as legacy listener profiles.
- **Absent services are not transport failures** — when Traefik, Loki, or
  Prometheus is not deployed, the API returns empty runtime/log data and an
  explicit not-collected status. The console labels Traefik “Not installed”
  rather than “unhealthy.”
- **Pinned workstation CLI and update feedback** — live preflight and build
  accept the same exact Core certificate pin. A server without automatic agent
  updates returns a clear conflict instead of a generic gateway failure.
- **Narrow console containment** — shared nim-ui console pages, headers,
  banners, selectors, and tab strips stay inside a 390px workspace; wide tab
  sets retain their own horizontal scroller.
- **Installer regression coverage** — self-signed acceptance, wrong-pin and
  malformed-pin rejection, Core fingerprint extraction, help text and CLI
  propagation are exercised by automated tests.

## 0.6.1 — 2026-08-27

This corrective release makes the intended observability boundary explicit:
SwarmOps owns the operator experience and renders its own graphs and metrics.

- **No Grafana service** — the public Grafana route, container, admin secret,
  provisioning files, dashboard bundle, configuration, and installer prompts
  have been removed from the trusted stacks and release assets.
- **Internal telemetry remains** — Prometheus, Alertmanager, and Jaeger remain
  private services used by SwarmOps. Loki and Alloy continue to provide the
  internal log pipeline; their upstream image names retain the `grafana/`
  publisher namespace but do not install the Grafana dashboard product.
- **Explicit rollout boundary** — publishing this release does not mutate a
  running cluster. Operators can review and deploy the corrected observability
  stack separately, at which point Swarm reconciles the removed service.

## 0.6.0 — 2026-08-27

The complete control-plane surface, redesigned Quorum console, and native
Core/Agent recovery line are published together for the first time.

- **Unified native release and recovery** — the release line now contains the
  complete `v0.5.10` native installer and updater hardening alongside the full
  control plane. Installed Core and Agent binaries expose allow-listed
  `upgrade` and credential-generation commands; Core can
  manage its trusted client CIDRs; streamed installers preserve executable
  modes, recover root-owned staging directories, verify checksums and
  readiness, and roll back failed activation before showing login details.

- **Server readiness with latest-intent queue semantics** — newly enrolled
  Debian/Ubuntu machines can run the native agent before Docker with
  `--defer-docker`, then queue a typed, confirmed plan to update OS packages,
  install or update Docker, initialize a one-node Swarm, and apply UFW using
  explicit controller and Swarm-peer CIDRs. The normal agent remains sandboxed
  and asks a separate root-only Unix-socket helper; neither can execute a
  browser-supplied shell command. A new command now durably supersedes only an
  unstarted queued or retry-scheduled command with the same server, action and
  target, leaving running and ordinary needs-attention work intact for review.

- **Full Docker and Swarm surface in the console** — three new screens.
  *Resources* lists containers, images, volumes, networks, secrets, and
  configs, with container inspect and a one-shot CPU/memory/network/block
  sample, and creates or deletes networks, volumes, and configs, starts,
  stops, restarts, or removes containers, and pulls or removes images.
  *Insights* rolls up node, service, task, and container counts, fleet
  capacity, `system df` with reclaimable totals, a bounded Engine event
  window, and the swarm object, and offers per-kind pruning, the task-history
  retention limit, and join-token rotation. *Supported commands* renders the
  served catalogue of every operation with the Docker command it becomes.
  The machine agent gained the matching read endpoints and 26 new fixed
  operations; nothing here is a Docker-socket proxy or an arbitrary command,
  and each mutation keeps the ledger, CSRF, audit, and confirmation rules.
  Container environment values, config payloads, and join tokens are withheld
  on the way out. Stack removal is now name-shaped rather than confined to the
  platform's own stacks, so an operator can delete a stack SwarmOps did not
  create.
- **Insight dashboard and a console command runner** — *Insights* is now a
  charted dashboard. The API samples every connected manager once a minute
  into a bounded four-hour in-memory series (`GET /api/v1/insights/history`),
  and the screen draws tasks and containers over time, failures and
  degradation, disk by resource with the reclaimable share split out, the
  largest images, and Engine activity by action, with a sparkline beside each
  headline figure. The series holds counts and byte totals only and is not
  persisted; Prometheus remains the long-range store. *Supported commands*
  gained a Run button on every entry: each catalogue entry now describes its
  own parameters, the console generates the form from that description, a read
  shows the control plane's response verbatim, and a mutation is queued in the
  ledger. Every run names the server it executes on — defaulted to the shell's
  selection but chosen explicitly, restricted to connected Swarm managers, and
  sent as the request's own target header rather than inherited — and the
  Command queue gained a Server column so each row states the cluster it will
  change. The runner reaches no route the catalogue does not already list.
- **Private source-to-deploy** — the console now guides an operator through a
  sealed, verified GitHub/GitHub Enterprise, GitLab/self-managed GitLab, or
  Gitea/Forgejo connection; repository and immutable revision selection;
  bounded recursive monorepo discovery; review of every Compose/Dockerfile
  evidence record; and one durable `source.deploy` command. Named Compose
  variants are discovered alongside canonical Compose files and receive
  distinct immutable build images. Provider Compose and Dockerfile bodies,
  tokens, build contexts, environment values, labels, mounts, arbitrary
  networks, and credentials never become browser, audit, or command payload
  data.
- **Source deploy reads as one procedure** — the screen is five numbered
  stages, Provider through Deploy, beside a standing deployment plan that lists
  the applications, immutable images, managed databases, shared platform
  stacks, domain, and telemetry the deployment will own, together with the
  warnings and blockers still in its way. The plan is the only place the
  deployment is queued from, so what is committed is read back in one place
  rather than reconstructed from five sections. A verified provider connection
  now reads as a record — provider, masked credential state, verified account —
  and the connection form returns only when there is something to add or
  replace. None of this is app CSS: the stage spine, the sticky plan rail, the
  numbered panel marker, and the copy chip are `nim-ui` 0.14.0 console
  components, per the standing rule that a layout rule in
  `web/src/styles.css` is a missing kit component.
- **A real mark** — SwarmOps had a letter in a box, which is a placeholder
  rather than an identity: it says nothing about the software and has to be
  explained everywhere it appears. The mark is now "Quorum" — three hive cells
  for the three managers that have to agree before a Swarm does anything —
  drawn once in `web/src/brand.tsx` and mirrored in the favicon. An earlier cut
  with a manager ring and six workers was cut precisely because six petals and
  a centre reads as a daisy at every size below the sign-in screen. Three
  shapes need no simplified variant: the sign-in screen and a 16px favicon draw
  the same geometry. The amber is the brand's own and appears nowhere else, so
  it can be read as neither the emerald accent nor an amber warning. The
  wordmark is two-tone — "Swarm" in ink, "Ops" in the mark's amber — and the
  lockup itself is now `nim-ui`'s `Brand`: the flex row, the mark slot, the
  display-face wordmark and the tagline were app CSS describing a LAYOUT, which
  this repo treats as a missing kit component. What is left in
  `web/src/styles.css` is one custom property naming the brand's colour.
- **The plan carries the names, not the containers** — managed data, shared
  platform stacks and the source forge are shown as the software they actually
  are (PostgreSQL, Redis, Prometheus, Jaeger, GitHub/GitLab/Gitea)
  through `nim-ui`'s `BrandMark`, which is a separate registry from the role
  icons on purpose. A mark is only ever drawn beside the product's own name.
  Findings are reported once, in the deployment plan, rather than in the plan
  and again in a panel below it, so two counts of "what is still wrong" cannot
  disagree.
- **Draft deployment plans** — the plan's selections can be saved and are
  restored per manager. The draft is browser-local and holds only the
  selection: no path, digest, finding, or provider response is written to
  storage, so a saved draft cannot become a copy of a repository sitting in
  `localStorage`. The controller has no draft state and gains none.
- **The delivery palette** — the console moves from the `sable` colourway to
  `malachite`, an emerald accent on near-hueless slate. `sable` was picked so a
  cobalt accent could not be read as a fourth node status; that trade is given
  up deliberately here, because the delivery screens report decisions rather
  than health and their two remaining states — warning and blocker — are amber
  and red. Fleet status keeps stating itself in words beside the colour.
- **Console navigation and manager scope** — the sidebar is grouped as
  Platform, Delivery, and Configuration, and collapses to its icons. The
  selected Swarm manager moved to the topbar where a page title would sit,
  because it is the scope of every read and every change on the screen below
  it, not one control among the actions.
- **Managed source substitutions and domains** — source PostgreSQL, MongoDB,
  Redis, and Valkey dependencies become SwarmOps managed data attachments;
  Prometheus, Alertmanager, Jaeger, Loki, Alloy, node-exporter, and
  cAdvisor become reviewed global stacks rather than provider deployments.
  Application slots can now declare an optional route or approved domain
  suffix, letting the Applications console queue a policy-checked hostname
  assignment or confirmed route removal without editing Traefik directly.
- **Published installer URL** — the console and quick start now download the
  agent installer from the standalone SwarmOps GitHub Release. They no longer
  point at a nonexistent raw path in the `nim` monorepo.
- **One-command agent install** — `scripts/install-swarmops-agent.sh` now runs
  with no required flags. It generates the agent's P-256 TLS certificate,
  machine API key, and single-use enrollment secret, installs missing build
  prerequisites, and prints one enrollment token. `--install-docker` installs
  Docker Engine from Docker's own signed apt repository on Debian/Ubuntu and
  `--init-swarm` forms a single-node Swarm when the host is in none. Reviewed
  TLS material and a supplied API key are still accepted.
- **One-paste enrollment** — the installer's token carries the origin, pinned
  leaf certificate fingerprint, and a one-time secret, never the machine API
  key. `POST /api/v1/servers/enroll` decodes it, exchanges the secret for the
  key over the pinned connection, and connects. The agent's `POST /v1/enroll`
  succeeds at most once per installation, deletes its on-disk secret, and
  closes the window after a small budget of failed attempts.
- **Sealed machine API keys** — an enrolled operator has no key to retype, so
  the received key is AES-256-GCM sealed in the controller volume and the API
  reconnects saved machine-API profiles at startup. It is never returned by an
  endpoint or written to the audit trail, and disconnecting or removing a
  server deletes the sealed copy. `SWARMOPS_RETAIN_MACHINE_KEYS=false` restores
  the previous memory-only posture.
- **Rendered applications** — a new Applications page deploys one application
  from a closed spec: approved slot, pushed image, port, health path,
  resources, attached databases, and an optional backend. SwarmOps generates
  the Compose, the Traefik router, the health probe, and the database wiring,
  then puts its own output through the same `ValidateCompose` and platform
  admission as hand-written Compose. Name, domain, certificate resolver, and
  resource ceiling still come from the reviewed platform manifest. See
  [ADR-0005](../../docs/adr/ADR-0005-swarmops-rendered-applications.md).
- **Isolated routed data plane** — each application and managed database uses
  one encrypted overlay containing only that service and Traefik. Typed
  dependency bindings install derived aliases on the caller overlay, and
  platform admission rejects the former shared data and edge networks.
- **Database connection URIs** — creating a managed database generates its
  password and full connection URI together, because a Swarm secret cannot be
  read back. The URI is sealed in the controller volume and copied into a
  stack-scoped secret for each application that attaches it. Delivery is per
  application: a mounted file, or an environment variable for images that can
  only read one.
- **Automatic metrics discovery** — Prometheus polls `/metrics/targets` on the
  controller over the internal overlay, so an application that publishes
  metrics is scraped as soon as it is recorded. Prometheus is never given the
  Docker socket and its configuration is not regenerated per deployment.
- **Edge HTTPS redirect** — Traefik's `web` entrypoint now redirects to
  `websecure`, which is what lets a rendered application be routed without the
  per-stack middleware labels admission forbids.
- **Managed databases** — PostgreSQL, MongoDB, and Redis are reviewed,
  checked-in Compose assets rendered on the controller and deployed from a new
  console page. Their passwords are generated on the manager as Swarm secrets
  and never returned to a browser; each engine is pinned to a
  `nim.stateful=true` node on the internal `swarmops` overlay; removal needs
  the exact `REMOVE_DATABASE_<ENGINE>` confirmation and leaves the named volume
  in place. The agent command vocabulary gains only two bounded shapes —
  listing Swarm secret names and creating one secret whose name must start with
  `swarmops_` — so browser-authored stateful Compose remains impossible.

## 0.1.0

First public cut: the Docker-free controller, the durable command queue, and the
platform admission model.

- **Docker-free controller** — the API runs on the control manager with no
  Docker daemon or socket, reaching a selected Engine only through a pinned-TLS
  machine agent whose API key lives in process memory and is cleared on
  disconnect or restart.
- **Durable command queue** — write-before-execute, `Idempotency-Key` on every
  mutation, one command at a time, bounded retry at 2/4/8/16/32/64 seconds
  across at most eight attempts, and `needs_attention` as an explicit terminal
  state rather than a blind replay. History is pruned oldest-first beyond
  `SWARMOPS_COMMAND_HISTORY_LIMIT` (default 2000); non-terminal commands are
  never pruned.
- **Encrypted state** — AES-256-GCM-sealed server profiles, audit history,
  command metadata, and pending build contexts on the controller's named
  volume. Every store transition rolls back its in-memory change when the
  sealed write fails.
- **Platform admission** — a non-secret platform manifest validated offline or
  against fresh authenticated node inventory, rejecting duplicate namespace or
  domain claims, unavailable capacity, incompatible certificate settings, and
  unsafe stateful placement before a build or deploy is requested.
- **Operations** — image-only Compose v3.9 application-stack deploys with
  optional single-node pinning, bounded service-log tails, fixed-shape service
  actions, Traefik reconciliation with the ACME DNS challenge, a
  Prometheus/Alertmanager/Jaeger observability core with separately
  toggled host probes and log collection, allow-listed Ansible fleet jobs, and
  opt-in Restic backups of local named volumes to S3-compatible storage.
- **swarmopsctl** — a real local build path: a tarred context that respects
  `.dockerignore`, allow-listed immutable image tags, CPU and RAM caps, and a
  queued command ID instead of remote build output.
- **Console** — React, built entirely on the nim console layer (`console` style,
  `sable` colourway), holding no UI components of its own.
- **Licensing** — Apache-2.0 with the [NOTICE](NOTICE) attribution requirement,
  plus four checked-in decision artifacts under [docs/](docs) recording the
  architecture, expansion, controller, and command-queue designs.
