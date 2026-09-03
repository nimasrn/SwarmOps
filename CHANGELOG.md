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

## 0.19.0 — 2026-09-04

Four screens named a prerequisite and then sent the operator somewhere else to
satisfy it. Each one now satisfies it where it is stated, and the one that
could not — because the controller was never wired to update itself — is
wired.

- **A blocker carries its own fix** — the telemetry screen's "assign
  `nim.stateful=true` to a ready, active node" is a button that labels one.
  The candidate is chosen the way the reference topology chooses it: a node
  already carrying `nim.control`, then `nim.edge`, then the most free disk,
  with the hostname breaking the tie so the same cluster always suggests the
  same node. Choosing a different node is still one click away, and a cluster
  with no ready, active node says that instead of offering a button that would
  fail. The Platform screen's "no node can hold data yet" banner carries the
  same button, and the Logs screen's failure banner installs or redeploys the
  reviewed Fluentd stack rather than naming it.
- **The host probe is no longer called the agent** — the enrolled outbound
  agent can be connected on a cluster where the optional host probe was never
  installed, and both were labelled "Agent", so the console contradicted itself
  on two screens at once. The probe is now named as itself everywhere, its
  absence reads "Not installed" rather than "Not configured", and the Swarm
  screen's attention panel installs it under the existing
  `INSTALL_NODE_AGENT` confirmation.
- **An unmeasured figure is not printed as zero** — Docker reports a node's CPU
  and memory capacity; only the host probe reports usage, and disk at all. A
  cluster without the probe showed `0 B / 0 B` of disk and `0 B` of memory used,
  which are readings that were never taken. They now say so, in the node table,
  the fleet capacity strip, and the node's own facts.
- **Core can be updated from Core settings** — the control-plane installer
  wired Warden to a repository, a release directory and a health URL, but never
  to a request marker or a status file, and never told the controller where
  either lives. The console reads exactly that to decide whether an updater
  exists, so it reported "no updater" on every installed controller and hid the
  button. The installer now sets both halves, widens Warden's write path to the
  state directory, and installs `swarmops-core-warden.path` so a requested
  check runs immediately instead of waiting for the twelve-hour timer.
- **Existing controllers have a repair** — the installer refuses to overwrite
  an existing controller, so `repair-swarmops-core-update-wiring.sh` ships as a
  release asset for hosts installed before that wiring. It writes the
  environment keys, installs the path unit, and restarts the controller. The
  console's dead-end banner names that command instead of suggesting an
  installer run that would be refused.
- **A deployment cannot be mapped to a slot that cannot exist** — a controller
  with no platform definition rendered a review step reading "choose an approved
  application slot in the deployment plan beside this page" next to a plan that
  had no slot control at all, because there was nothing to list and nothing the
  operator was allowed to name. The review step now states that, and opens the
  platform definition; the plan says why the control is absent instead of
  showing a label with nothing under it.

## 0.18.0 — 2026-09-03

Deploying a repository for the first time no longer stops at a screen that
tells the operator to go somewhere else and write a workload down first.

- **A first deployment declares the slot it names** — where the controller owns
  its platform definition, releasing an application no reviewed slot is named
  after writes that slot into the sealed manifest: the name, domain,
  certificate resolver, replicas and CPU/memory ceiling chosen on the
  deployment screen, as an `application`-profile workload. A repository nobody
  has deployed yet is the ordinary case, not an exception, and requiring three
  values to be retyped into Platform → Platform definition before the
  deployment was accepted reviewed nothing.
- **It is a declaration, not a bypass** — the whole manifest goes back through
  the same `preflight.Check` before the new slot is kept, so a hostname another
  workload already owns is refused rather than taken, and the refusal names
  that workload instead of printing a finding code. A name already held by a
  stateful workload is refused too: those deploy from their reviewed Git
  manifest. The declaration is sealed, audited as `platform.slot.created`, and
  the deployment that caused it is then admitted against it exactly like every
  later deployment into that slot. A certificate resolver is inferred only when
  the definition declares precisely one; a deployment with no domain gets a
  slot that owns no hostname at all.
- **A mounted manifest is still the reviewed artifact** — nothing is written to
  `SWARMOPS_PLATFORM_MANIFEST_FILE`, and a deployment naming a slot that file
  does not declare is refused as before. An install that declared itself
  manifest-free has no slot list to add to and is unchanged. The slot is
  declared only after every check that can refuse the submission on its own
  evidence, so a build that was never going to run leaves no slot — and no
  domain — declared behind it.
- **Deploy names the application instead of only picking one** — the review
  step states whether the release will reuse a reviewed slot or declare a new
  one, and the ceiling it will be held to afterwards. The discovered service
  proposes its own name rather than landing in whichever approved slot sorted
  first, and naming a slot no longer wiped the hostname the operator had
  already typed beside it.

## 0.17.0 — 2026-09-03

A controller can now be set up entirely from the console: the platform
definition it admits deployments against, and a build that needs no registry
account at all.

- **The platform definition is authored in the console** — Platform → Platform
  definition asks where the definition comes from and takes one of three
  answers: a manifest written here (namespace, registry, ingress, certificate
  resolvers, measured nodes and the application slots each with its domain
  policy and resource ceiling), no manifest at all, or nothing chosen yet. What
  is authored here goes through the same `preflight.Check` a mounted file goes
  through, is sealed with the rest of the controller state, and reaches the
  next deployment without a restart. Node capacity is measured from the live
  cluster rather than retyped. A mounted `SWARMOPS_PLATFORM_MANIFEST_FILE`
  still wins and makes the console view read-only, so the reviewed artifact
  cannot be replaced from a browser.
- **An install may declare that it has no manifest** — and must not have one.
  Confirmed by typing `NO_PLATFORM_MANIFEST`, this turns off the four checks
  only a manifest can answer: an application may take any name inside the
  declared namespace, claim any domain, name any certificate resolver, and
  reserve whatever the cluster will schedule. Everything that never needed a
  manifest stays: namespace confinement, the refusal to mount another stack's
  secrets, configs, volumes or networks, the approved Traefik label subset, a
  certificate resolver on every public route, and each host's own build and
  image permissions. Deploy then takes a typed application name and a stated
  ceiling in place of a reviewed slot.
- **A push registry is optional** — an operator with one machine and no
  registry account is the ordinary case, not a misconfiguration. With no
  registry configured the image is built on the host the deployment targets
  under the `swarmops-local/` prefix, is never pushed, and the application is
  pinned to that node. Discovery states this as a warning on the plan before it
  is applied rather than blocking with "source builds require a configured
  allow-listed image prefix", and the registry screen offers "nowhere" as a
  real answer beside GHCR, Docker Hub and a custom host.
- **Endpoints the console served but never called are reachable** — what the
  edge actually carried, request by request, on Traffic → Overview; the digest,
  layers and platform behind an image; the containers attached to a network;
  the mountpoint, driver options and labels of a volume; a run older than the
  retained list, fetched by id instead of reported missing; a single node
  re-read after a membership change; and the Compose editor that shipped with
  no button able to open it. The dead `GET /api/v1/traefik/runtime` route is
  gone rather than left served and unused.
- **An empty cluster renders as empty, not as a crash** — a handler that
  returned no rows served the JSON literal `null`, and the console iterates
  every list it reads. Lists are now rendered as `[]`, and the screens that
  count what they receive tolerate either. "None" and "could not measure" stay
  distinct, carried by explicit fields as before.

## 0.16.1 — 2026-09-03

A scanned repository now reaches production on a cluster that was not already
prepared for it, and what a deployed application may read is narrower than the
engine it reads from.

- **Every application gets its own database account** — a user, a logical
  database, and exactly the grants that user needs, provisioned by a one-shot
  Swarm job that runs a reviewed, checked-in script on the managed engine's own
  image. Applications no longer receive the engine superuser URI, so a leaked
  connection string is a leak of one application's data rather than the whole
  engine. The URI is delivered under the variable names the repository actually
  reads, and a later deployment of the same application is handed the
  credential it already owns instead of having one rotated underneath it.
- **The console can publish itself** — choose an accepted zone and a label
  under it on Control → Core, and the A record, the resolver, the DNS proof and
  the public route are derived from state that already exists. It is the same
  publication order and the same `RouteSpec` every other service gets, so the
  published console appears in Traffic → Routes and is withdrawn the same way.
  A controller that is not a Swarm service on the selected cluster says so
  instead of offering the control.
- **A deployment installs the routing edge it needs** — a first deployment on a
  cluster without Traefik repairs only what the install preflight already
  treats as automatically repairable, rather than failing with "Traefik
  singleton service was not found" after the image was built and pushed.
  Anything that needs a human decision — the dashboard credential above all —
  still stops the deployment with the preflight's own recovery text.
- **A push registry is chosen, not spelled out** — GitHub Container Registry,
  Docker Hub, or another registry. Picking a hosted one asks for the account
  name alone and fills in both the image namespace and the credential server,
  so images can no longer be namespaced on one registry and authenticated
  against another. "Other registry" keeps the two free-text fields.
- **More of the repository is read, and shown before it is applied** — the
  deployment plan reports Dockerfile stages, base images, whether the container
  drops root, its start command and its declared ports, and names the variables
  each database attachment will be delivered under. Replicas, the resource
  ceiling and a declared route are taken from Compose when the operator did not
  state them; platform admission still checks them against the reviewed slot,
  so importing them can widen nothing.
- **Chart evidence keeps exact timestamps** — expandable data tables retain the
  full sample time while only visible ticks are thinned.

The sealed database credential record moves to version 2 to hold
per-application URIs; a version 1 file is read unchanged and simply has no
application credentials yet. This release adds no new remote command shape
beyond console publication and per-application database provisioning, and no
automatic infrastructure upgrade.

## 0.16.0 — 2026-09-03

The console adopts the next nim-ui console layer, with durable object routes,
readable operational charts, and explicit review before changing workloads.

- **One nested workspace** — all 22 destinations remain in the canonical
  six-area registry. The sidebar, breadcrumb, command palette and keyboard
  navigation share it. Application, machine, container and run URLs retain
  object selection; supported detail tabs survive reloads and browser history.
  Invalid addresses explain how to recover, and changing cluster scope clears
  loaded object state.
- **A shared console kit** — system typography, quiet bordered surfaces, flat
  insight strips, optional inspectors and responsive navigation are supplied
  by the vendored nim-ui layer, not duplicated in application CSS. The narrow
  sidebar is a native modal dialog with focus containment, Escape dismissal
  and focus return. Light, dark and RTL layouts keep health explicit in words.
- **Charts show evidence, not placeholders** — plots identify their object,
  period, source and unit; expandable data tables preserve complete timestamps.
  Missing samples break the line, unavailable sources draw nothing, and a new
  object or range cannot briefly display the previous reading. Refreshes are
  serialized and failures have a retry path.
- **Reviewed workload actions** — redeployment and container restart/stop open
  a review first. Application removal requires the shared typed confirmation.
  Deploying a pushed image requires a Compose preview matching the current
  fields, and editing the fields invalidates that preview. A new version starts
  from the current full specification rather than silently resetting limits.
  Release activity is limited to retained matching commands, not invented
  deployment history or per-replica health.
- **Smaller initial load** — screen modules load on navigation rather than all
  arriving in the initial bundle. Route, metric-grid, keyboard, focus and
  shared-component regressions have explicit coverage.

This release changes the console and its embedded assets. It does not add a
backend endpoint, database migration, new remote command shape, or automatic
infrastructure upgrade. The local review entry uses fixtures and is excluded
from production builds.

## 0.15.0 — 2026-09-03

Three unrelated things called "registry" stop sharing a screen, a Cloudflare
Global API Key is a supported credential, and the source scanner reports what
it read instead of a filename.

- **Registry mirror is a Control page, and the push registry belongs to Images
  & registries** — the console had piled three different questions onto two
  screens. Where every machine pulls PUBLIC images from is a fleet-wide fact
  that belongs to no cluster selection and no application, so it is now
  **Control → Registry mirror**, beside the other fleet-wide software controls,
  and it answers before the cluster gate rather than behind it. Where a built
  image is PUSHED to — the registry namespace, the sealed push credential,
  bounded builds — is now **Apps → Images & registries**, next to the images it
  produces. **Apps → Deploy → Set up source deployment** keeps only the
  provider boundary it is actually about. The three still write one sealed
  record, so each screen saves from what was last read and changes only its own
  fields rather than silently clearing another screen's.

- **Cloudflare Global API Key, and account-scoped zone lookup** — a DNS
  credential now carries two optional non-secret fields beside its sealed
  value. An account email switches both SwarmOps and the rendered Traefik stack
  from a scoped bearer token to that account's Global API Key — `X-Auth-Email`
  and `X-Auth-Key` on the provider calls, `CF_API_EMAIL` and `CF_API_KEY_FILE`
  in the stack — and is validated against the account it claims to belong to,
  because a global key cannot be introspected the way a scoped token can. An
  account identifier scopes the zone lookup, which is what an operator whose
  credential reaches more than one account needs in order to get a single
  unambiguous zone. Both are Cloudflare-only and rejected on any other
  provider; the scoped token remains the default and the recommendation.

- **The source scanner reads its evidence** (`swarmops-source-v2`) — it used to
  check that a Dockerfile existed and stop there. Every Dockerfile is now
  parsed once and its findings travel with whichever service builds it, so
  "this image runs as root" appears beside that service rather than as an
  unattached repository note, and a Compose service with no `ports:` inherits
  the port its own `EXPOSE` already named. A managed database is mapped to the
  environment variable NAMES the application actually reads, which is what
  stops an application that reads `DATABASE_URL` from being handed
  `POSTGRES_URL_FILE`, failing to connect, and restarting forever. Traefik
  labels already in the repository are read as the proposed route instead of
  being invented, declared replicas and CPU/memory limits are carried, and a
  build context with no `.dockerignore` is reported before it uploads the
  repository's history to the builder. The parser resolves no build argument,
  follows no base image, and executes nothing. Route hostnames are the single
  documented value the plan retains — a route cannot be approved without the
  name it serves — and environment values are still classified and discarded.

## 0.14.1 — 2026-09-03

The operator CIDR allowlist is optional in both directions: it can be left off
at installation and turned off afterwards.

- **`swarmops-core access disable`** — an operator whose address is not static
  had no supported way back out of the allowlist once it was on, because
  `access` only accepted `set-cidrs` and Core refused to start with an empty
  policy on a direct-TLS listener. The allowlist is now genuinely optional:
  empty means Core accepts every client network, `disable` writes that policy
  through the same transaction as `set-cidrs` — atomic write, restart, `/readyz`
  verification, and rollback to the previous policy if either fails — and the
  installer no longer requires `--allow-cidr`, prompting instead and saying what
  an empty answer means. Enabling the allowlist still preserves certificate-IP
  and loopback access automatically. This is a boundary an operator chooses,
  not one they can be trapped behind; a host or cloud firewall remains the
  right place to restrict the port when the client address is unpredictable.

## 0.14.0 — 2026-09-02

Source deployment is set up from the console, and setup no longer hides the
flow it is a prerequisite for.

- **Setup is a form, not a printout** — turning on source deployment, naming
  the registry namespace, sealing a registry push credential, allowing bounded
  builds, and allow-listing private provider hosts are all done in the console
  and take effect without restarting the controller. The screen previously
  could only print the environment variables it wanted, which is a dead end for
  the one person most likely to be reading it: an operator in a browser with no
  shell on the control host. The settings are AES-256-GCM sealed in
  `source-settings.sealed` beside the provider tokens, the registry password is
  write-only and never returned to the browser, and startup configuration
  remains the floor those settings sit on. Per-host build permission is
  untouched: each Docker host still enforces its own.
- **A missing registry no longer hides the provider and repository steps** —
  connecting GitHub, GitLab, Gitea, or Forgejo and scanning a repository need
  only the source boundary itself, so those steps are now open as soon as it is
  on. The build-time requirements are reported where they apply and enforced at
  release, and a service that ships an already-pinned image deploys without
  them. Deploy previously replaced its whole four-step flow with the settings
  panel whenever any one requirement was unset.

## 0.13.0 — 2026-09-02

A hostname is published in one order, the image mirror is a fleet-wide fact,
and the core updates itself the same way an agent does.

- **A domain is accepted before anything is published under it** — the gateway
  now holds a registry of accepted apex zones, and publication has exactly one
  order: accept the domain, create the subdomain record inside it, then assign
  that hostname to a service. A record cannot be created in a zone nobody
  accepted, and a route cannot claim a hostname that has no record — public and
  internal alike, host match and SNI alike. A name that has not been through
  the order gets no router at all rather than an unresolvable one. Withdrawing
  a domain is refused while any record or route still depends on it, so
  acceptance can never be revoked out from under something already published.
  A wildcard host is admitted only against its own apex record, because a
  wildcard covers subdomains that were never created one by one. State sealed
  before the registry existed adopts the zones its records already use, so an
  existing cluster keeps running while all new work goes through the gate.
- **The registry mirror belongs to the fleet, not to a machine** — a mirror set
  on four hosts out of five is worse than no mirror: the fifth still pulls from
  Docker Hub, and the service that lands there is the one that fails when Hub
  is slow or rate-limiting. Mirrors are now applied to every enrolled agent in
  one reviewed action from Core, and the read reports each machine's actual
  daemon configuration — from the engine itself, never from the file SwarmOps
  wrote — so a host that drifted is visible rather than assumed. An empty list
  is the explicit "go back to Docker Hub" request, so removing a mirror is as
  reviewable as adding one.
- **Core updates are no longer a weaker screen than agent updates** — both
  components now run the same Warden path: the console writes a request
  marker, the local Warden consumes it and records what it did, and the core
  reads that status back. Core update state could previously only ever say
  "Never checked". A marker may also name an exact release, which is how a
  component is rolled back.
- **A listed network is not a working network** — Traefik installation
  prerequisites now inspect the ingress and traefik overlays by name instead of
  trusting the cluster listing. A swarm-scoped network can remain listed after
  a node's local index has lost it, which used to pass preflight and then fail
  the deploy with "declared as external, but could not be found". Each stale
  case now says so and carries its own recovery.
- **The gateway dashboard and its settings are two destinations** — reading
  what the edge is carrying no longer puts a singleton-restarting settings form
  on the same screen.

## 0.12.0 — 2026-09-02

The agent measures, the console is six areas, and every reading sits beside the
object it describes. Ansible is gone.

- **Hosts and containers are measured, at last** — the agent on each host now
  reports CPU (busy, iowait and steal separately), load, memory, swap, every
  mounted filesystem, per-interface network and per-disk I/O, plus per-container
  CPU, memory against limit, network, block I/O and restarts. Nothing collected
  any of this before: `prometheus.yml` had four scrape jobs and not one of them
  was a host or a container, and the `node-exporter` in the agent stack was
  scraped by nobody.
- **The agent is the only collector** — no cAdvisor, no scraped node-exporter,
  no privileged extra container, and readings that arrive before Docker does.
  Agents hold no inbound port, so the controller terminates each scrape over
  the outbound channel that machine already holds open and serves it at
  `/metrics/machines/<id>`; discovery lists one entry per connected machine, so
  enrolling a host starts collection with no config to regenerate.
- **The agent sends numbers, the controller chooses the names** — machine
  metrics cross the trust boundary as a typed document that is sanitized before
  a byte of exposition is produced. A metric name or label in the cluster's
  Prometheus was never chosen by a machine agent.
- **Six areas instead of eight** — Deliver and Workloads were the same object at
  two points in its life, so an application and the service running it lived in
  different halves of the navigation. Home, Apps, Machines, Traffic, Activity
  and Control. Every one of the twenty-four retired hashes still resolves to
  the screen that took over its job.
- **A machine is a page** — `#machines/<id>` opens one host with its charts, its
  containers, its setup checklist and its agent on it. Host setup and connection
  diagnostics stopped being fleet-wide destinations, because readiness is a
  property of one host and was never a property of all of them.
- **There is no Observe area** — a fleet-wide chart cannot answer "for which
  node?", which is the question this rebuild started from. Metrics live on the
  machine, the container, the application and the gateway. Collectors and
  managed databases became **Platform services**, which is one idea: the
  cluster singletons every application is wired to.
- **Every chart states its provenance** — one component draws every reading in
  the product, and a range with no source draws nothing at all and says why. An
  empty plot and an idle machine look identical, and only one of them is a
  measurement.
- **Reading a metric is a closed vocabulary** — the browser names a series and
  an object; the query language is built on the machine from a fixed table.
  Selectors are validated against a pattern admitting no quote, brace or space,
  so a selector cannot close its own label matcher.
- **The controller can describe itself** — Core now states its version, the host
  it runs on, its state directory and free disk, the releases kept for a roll
  back, and offers the update. The updater shipped three releases ago with no
  route to it. The ten-row handoff timeline is still there, below the things you
  came for.
- **Agents & updates** — which version each machine runs, and the connection
  nobody could previously make: an agent that is behind does not merely run
  older code, it rejects commands added since it shipped.
- **Ansible is removed** — `deploy/ansible/`, `provision-swarmops.sh` and
  `setup-three-managers.sh` are gone. `bootstrap-swarm.sh` talks only to the
  controller: it mints enrolment codes, prints the one command to run on each
  machine, waits, then queues typed Docker and Swarm operations and follows each
  run to a terminal result. No SSH, no key for any host, no inventory.
- **Joining an existing Swarm is a typed operation** — it was not one, anywhere.
  `initializeSwarm` only ever ran `docker swarm init`, so multi-manager
  formation was possible only through the playbook now deleted. The join token
  is read from the manager by the command worker at execution time and is never
  written to the sealed ledger, the audit trail, or a browser response.
- **Kubernetes import is a way to start a deployment** — not a destination. Four
  ways into one flow rather than four products.
- **Fixes**: host provisioning deadlocked for forty-five minutes and then
  reported "invalid request" — the root helper reads to EOF to prove it received
  exactly one request and the agent never closed its write half, so install
  Docker, update OS, init Swarm and apply firewall all hung; Swarm advertise
  addresses were sorted as text, so `"172.17.0.1" < "192.168.1.5"` made any host
  on a 192.168 network advertise Docker's own bridge, which no peer can reach;
  container CPU was divided by the core count twice; mount paths begin with a
  slash and were being dropped as unnameable, costing every filesystem reading;
  Docker publishes no `task.slot` label so the replica number was always empty;
  `docker_available` reported 1 on hosts with no Docker because it tested
  whether a client was configured rather than whether Docker answered; and the
  breadcrumb repeated a name when an area and its landing screen share one.

## 0.11.0 — 2026-08-30

The console is rebuilt as modules, every screen is drawn in one frame, and the
keyboard is written down where an operator can find it.

- **The console is modules, not one file** — `app.tsx` was two and a half
  thousand lines holding the shell, the router, fourteen screens, five data
  hooks, and every formatting helper in the product. What lives where is now
  decided by directory: `data/` reads the controller, `lib/` computes,
  `navigation/` names screens and binds keys, `components/` composes the kit,
  `screens/<area>/` draws one destination each, and `shell/` holds them
  together. `app.tsx` is now the entry point and nothing else.
- **A screen is titled what its navigation item is called** — every top-level
  screen is drawn in one frame that reads its title and its one-line purpose
  from the information architecture. The nav item that read "Swarm & placement"
  opened a screen titled "Infrastructure"; that is no longer expressible.
- **Insights under every title** — two to four readings per screen: a figure,
  what it means, and where to act on it. A reading the controller does not have
  is stated as an absence rather than averaged into a number.
- **One keyboard, documented by the thing that installs it** — `?` opens a
  sheet generated from the same list that binds the chords. `⌘K` and `/` open
  the palette, `G` then an area letter jumps, `R` re-reads the screen, and `D`
  opens connection diagnostics. Bare letters never fire inside a text field.
- **The palette finds things, not only screens** — it now lists the servers,
  services, and stacks in the selected cluster alongside actions and
  destinations, and offers the screens you opened most recently first.
- **What needs a decision follows you** — the attention list is computed once
  and carried in the masthead, so an operator who went straight to Traffic
  still learns that a run has stopped. Every row opens the screen that can
  resolve it.
- **A first-run path that says what is missing** — the command centre shows the
  five steps between an empty controller and a served request, marks off the
  ones already done, and makes exactly one of them the next action. Operators
  deployed applications with no gateway and concluded the product was broken.
- **One confirmation control, one set of numbers** — eleven hand-rolled
  confirmation forms became one component that states the consequence, shows
  the phrase, and stays disabled until it matches; nine copies of `formatBytes`
  and `formatDateTime` became one each.
- **Screens can be pinned, and the theme can be switched** — pinned screens sit
  above the area's own list in the sidebar, and light/dark is an explicit
  choice in the operator menu.
- **Redeploy an application without retyping its spec** — one action on the
  applications list re-sends the spec the application is already running, which
  is what rolling a service after a base-image change actually requires.
- **Scale a service by one** — replica changes under load are "one more" or
  "one fewer", so those are buttons; the exact-count field remains beside them.
- **Fixes**: reclaiming disk and the Swarm task-history setting moved off the
  health screen to the objects they act on, so the screen an operator opens
  while worried carries no destructive control; the health screen's unreachable
  second implementation and its non-functional "Create alert" and filter
  buttons are gone; a failed source-capability read now explains itself instead
  of spinning forever; the gateway prerequisite panel no longer offers to "fix
  all 0 prerequisites"; the audit trail gained the actor, outcome, and text
  filters it needed to be usable past a hundred records; and the setup track
  marks exactly one step active instead of three.

## 0.10.4 — 2026-08-30

Traefik installation now owns its dashboard hostname in the console and the
command center has one evidence-backed owner instead of overlapping overview
surfaces.

- **Dashboard hostname lives in SwarmOps** — Gateway & ports collects and
  validates the public hostname during installation. The durable command stores
  it with the selected cluster's sealed Traefik settings, renders the protected
  router from that state, and derives the HTTPS dashboard URL without a Core
  `TRAEFIK_DASHBOARD_HOST` or `SWARMOPS_TRAEFIK_DASHBOARD_URL` environment
  variable.
- **Missing configuration fails before the run** — an empty or malformed
  hostname blocks admission with a specific recovery message. Legacy sealed
  records remain readable, while every new install or static-settings update
  must include a valid hostname.
- **One command center owns the verdict and evidence** — the obsolete duplicate
  overview surface is removed, the evidence ledger is available from the real
  command center, and its recommended next action is calculated from the same
  blockers shown beneath it without repeating the cluster-state heading.

## 0.10.3 — 2026-08-29

An in-place native Agent migration now restarts already-active systemd units,
so health validation observes the new release process rather than the legacy
process that happened to be running before the installer changed its symlink.

- **Running Agent activation is explicit** — the installer enables and then
  restarts the provisioning helper and Agent in dependency order. A fresh
  service still starts normally; an existing service cannot remain on its old
  mapped executable.
- **Health proves the candidate** — the loopback check now runs only after both
  units have received the restart, preserving the existing rollback path when
  the candidate cannot become healthy.
- **Migration regression coverage** — an executable shell test records the
  systemd calls and requires `enable`, `restart`, then `is-active` for an
  already-installed unit.

## 0.10.2 — 2026-08-29

Pinned native installs now continue past release selection under Bash
`errexit` instead of downloading the installer and then exiting silently.

- **Pinned Agent and Core installs execute** — the shared release resolver now
  returns success when `--release <tag>` already names the immutable version,
  so both native installers proceed to checksum and activate their bundle.
- **Explicitly disabled updates finish cleanly** — the Agent installer's final
  status writer returns success when `--no-auto-update` intentionally omits an
  update-status record.
- **Executable regression coverage** — installer tests run the release-resolver
  functions under `set -e` with an exact tag and require execution to reach the
  next command, protecting both Agent and Core release paths.

## 0.10.1 — 2026-08-29

Native Agent installation and automatic updates now consume the release
binaries SwarmOps already publishes instead of compiling source on the server.

- **No production Go or Git dependency** — the installer resolves an immutable
  GitHub release, downloads the platform-specific Agent/Warden bundle and
  `checksums.txt`, requires one exact SHA-256 entry, rejects unexpected archive
  members, and activates only the two expected executables.
- **Atomic activation with rollback** — Agent and its provisioning helper run
  through `releases/current`. Initial installation and each Warden update start
  the candidate, require the loopback health endpoint, and restore the previous
  known-good release when validation fails.
- **Existing machines upgrade in place** — re-running the installer migrates a
  legacy standalone binary into the release layout and preserves an existing
  outbound identity when the pinned Core URL is unchanged. A one-time
  enrollment code is consumed only for a genuinely new identity.
- **Automatic updates are installed, observable, and bounded** — the six-hour
  timer and Core-request path invoke the same fixed Warden. Updates defer during
  protected Agent mutations, publish the installed release and lifecycle state
  to diagnostics, retain three known-good releases, and accept no repository,
  tag, executable, or command from Core or the browser.

## 0.10.0 — 2026-08-29

SwarmOps can now answer why a service is not running, what a change will do
before it is applied, and whether a Kubernetes workload can come across.

- **Causal diagnosis** — a degraded service gets a chain of claims, each
  carrying the measurement behind it and where that measurement came from. It
  stops at the first thing SwarmOps can act on, because a chain ending in an
  explanation with no action has diagnosed nothing. Three rules:
  `constraint-unsatisfiable`, `node-cannot-hold-image`, `task-failing`.
- **The engine prefers silence to invention** — a rule that cannot obtain its
  measurements declines rather than degrading to a guess; an unrecognised
  placement-constraint form makes it decline rather than report "no node
  matches"; evidence older than 90 seconds cannot support a capacity claim; a
  host with no probe has unknown capacity, not zero. When nothing fires, the
  console shows a refusal listing what was measured and which failures the
  engine knows how to explain. An engine is trusted until its first confident
  wrong answer and never afterwards.
- **Change preview** — what a deploy will interrupt, in what order, and what
  happens when a step fails. Rollback behaviour is READ from the service's own
  failure action: a service configuring none is told Docker's real default is
  to pause, not roll back. "Serving during rollout" is only affirmative when
  capacity genuinely remains, so a single-replica service is told it cannot be
  replaced without a gap.
- **Kubernetes import** — reads manifests and reports what maps, what does not,
  and what was skipped. A two-container pod is a gap rather than a mapping,
  because Swarm has no pod and a sidecar sharing localhost would silently stop
  working. Every gap's options include staying on Kubernetes.
- **Placement constraints and update policy are now modelled.** Both were on
  the wire from Docker and unread, which is why an unschedulable service looked
  identical to a healthy one from everything SwarmOps could see.
- **Evidence is a console grammar, not decoration.** Diagnosis, preview and
  import use the shared causal-chain, caveat, command-list, decision, diff and
  evidence components from nim-ui. Unknown, unmeasured, unreported and
  unconfigured values are written explicitly instead of collapsing into an
  ambiguous dash.

## 0.9.3 — 2026-08-28

Traefik's four safe installation blockers can now be repaired from one button.

- **One reviewed repair** — Gateway & ports queues one durable action that
  creates the encrypted attachable `traefik` overlay, labels a deterministic
  ready manager `nim.edge=true`, creates the mounted reviewed dynamic config,
  and generates the dashboard-auth secret.
- **One-time dashboard login** — Core generates a random dashboard password,
  queues only its bcrypt htpasswd line inside the encrypted command payload,
  and shows the password once in the initiating panel. It never enters audit
  metadata or the public command record.
- **Retry-safe fixed vocabulary** — the repair re-reads every resource before
  acting and the agent accepts only the exact encrypted-network option,
  versioned dynamic-config name, and bcrypt dashboard-secret shape.
- **Honest agent gate without disconnection** — protocol 1 remains compatible
  for existing operations, while the repair button requires Agent v0.9.3 or
  newer. Core no longer claims an old agent can execute the new vocabulary.
- **HTTP-01 remains automatic** — DNS credentials are still optional for
  ordinary host certificates. Wildcards remain the only DNS-01 requirement.

## 0.9.2 — 2026-08-28

Traefik installation now explains its live prerequisites before queueing and
uses HTTP-01 automatically when no DNS provider credential exists.

- **Visible installation gate** — Gateway & ports reads the selected manager
  and lists the external encrypted `traefik` network, `nim.edge=true` manager,
  dynamic configuration, dashboard-auth secret, ACME email, and compatible
  agent protocol before enabling installation.
- **Automatic static configuration** — the checklist distinguishes resources
  an operator must provide from the immutable static configuration SwarmOps
  creates during the reviewed reconcile.
- **HTTP-01 without DNS secrets** — Cloudflare and ArvanCloud credentials are
  optional. Resolvers fall back to HTTP-01 when neither credential is usable;
  wildcard certificates remain blocked until DNS-01 credentials exist.
- **Actionable durable failures** — prerequisite races are rechecked before
  execution and become bounded, non-secret queue summaries instead of opaque
  failed runs.

## 0.9.1 — 2026-08-28

This hotfix restores the native Core command router removed during the 0.8.0
release bump.

- **Manual upgrades work again** — `swarmops-core upgrade` reaches the fixed
  Warden service instead of attempting to start a second API process without
  its systemd environment.
- **Fresh native installation works again** — the released Core binary once
  again provides the installer-only `password-hash` mode, so bootstrap creates
  the initial bcrypt credential without source code or a Go compiler.
- **Recovery and diagnostics stay reachable** — `--version` and
  `access set-cidrs` are routed before API configuration is loaded.
- **Executable contract coverage** — release tests now build the real Core
  binary and invoke every published command entry point, preventing ordinary
  package compilation from hiding a disconnected command implementation.

## 0.9.0 — 2026-08-28

The console's information architecture is rebuilt around what an operator is
trying to DO, and it now lives in one file rather than five.

- **One source for the IA** — `web/src/navigation.ts` holds the areas, the
  screens, their icons, their one-line purpose, and the retired hashes that must
  keep resolving. Both navigation tiers, the breadcrumb, the palette, and the
  cluster-gating rule are built from it, so they can no longer disagree. This is
  what makes Connection diagnostics reachable: it had a title and a section for
  three releases and appeared in no navigation tree at all.
- **Deploying is a first-class area** — source deployment, applications, images
  and builds, and the container registry were split between "Settings" and
  "Workloads", which filed the act of shipping under configuration. They are one
  area, Deliver, and it is the second thing in the rail.
- **Eight areas named for the job** — Overview, Deliver, Fleet, Workloads,
  Traffic, Observe, Activity, Control. Each opens on the screen that answers its
  first question, and each screen states the decision it serves under the area
  heading.
- **A command palette that acts** — ⌘K searches every screen AND runs the
  operations an operator reaches for under pressure: deploy from source, add a
  server, refresh, diagnose a connection, review runs, sign out, and switch the
  console to another cluster. The finder it replaces could only navigate.
- **The target and its evidence in one control** — the cluster selector carries
  the agent's connection state beside it. The two used to sit at opposite ends
  of the chrome, so answering one question meant looking in two places.
- **A command center that recommends** — the hero states the verdict and hands
  back the single next action, chosen in dependency order: authority, then a
  connected agent, then an open decision, then a selected cluster, then the
  edge, then a deployment.
- **A first-run screen that knows which run it is** — no server, no answering
  agent, a host that is not a manager, and a manager that is not selected are
  four different situations; each now has its own heading, reason, and button.
- **Observed scope in the chrome** — the sidebar footer names the controller's
  authority and when the current cluster snapshot was actually read, rather than
  restating a connection state shown elsewhere.
- **Kit corrections consumed** — nim-ui 0.15 (`CommandPalette`, `StatusHero`
  actions, un-underlined linked list rows, a wrapped console toolbar that starts
  at the reading edge).

## 0.8.0 — 2026-08-28

This release turns the console redesign into the product’s real information
architecture and corrects agent reachability reporting at the protocol edge.

- **Command-center shell** — a light, responsive masthead separates seven
  operator areas from their contextual workspaces, adds an environment-aware
  feature finder, and preserves the selected page while evidence refreshes.
- **Self-explaining operations** — Overview traces Controller → outbound Agent
  → Docker Engine → Swarm, needs-attention cards show retained failure evidence
  and recovery actions, Runs has working filters, and catalog operations open a
  review sheet immediately.
- **Clear ownership and vocabulary** — gateway ports, routes, DNS providers,
  TLS, source deployment, registry policy, Docker resources, Swarm services,
  stacks, applications, and managed databases each have one named owner and
  explain how they differ.
- **Truthful agent health** — outbound agents advertise the bounded log routes
  they can actually execute, and a feature-specific controller catalog error
  no longer becomes a false machine-unreachable status.

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
  [ADR-0005](docs/adr/ADR-0005-swarmops-rendered-applications.md).
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
