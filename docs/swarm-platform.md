# Nim Swarm + SwarmOps system design

**Status:** target architecture encoded in the repository; no production
cutover is implied.

## Decision

Use one Docker Swarm with three manager nodes and a shared Traefik edge.
Build images locally or in CI, push immutable SHA tags to GHCR, and deploy
image-only manifests through each owning repository. Use SwarmOps for authenticated,
audited visibility and constrained operations, while Git remains the
configuration source of truth.

This replaces a mixture of per-project Docker Compose, direct host builds,
separate edge proxies, and provider-specific deployment paths with one
repeatable workflow.

## Goals

- Build an app locally without contacting a server.
- Push one immutable image to the registry.
- Deploy Traefik first, SwarmOps second, and any application independently.
- Keep runtime secrets out of source, image layers, stack files, and host files.
- Keep app routes explicit and preserve current domain/path behavior during
  staged migration.
- Give operators a small command surface for inspection, logs, scaling, and
  rollback through user-selected remote servers, while a local UI needs no
  local Docker, Swarm, or SwarmOps API process.
- Fit the initial design within three low-cost servers without pretending that
  8 GB total RAM is an HA database platform.

## Non-goals

- No production DNS change, database migration, data deletion, or provider
  cutover is performed by this design.
- No shared database, Redis, object storage, observability, or malware-scanning
  service is silently created in the cluster. Reviewed stateful and observability
  stacks remain explicit operator actions with their own capacity, retention,
  and recovery limits.
- SwarmOps does not replace Git-managed stack manifests or offer arbitrary
  Docker commands.
- The design does not make local ACME, audit, or observability volumes highly
  available.

## Node layout

| Node | Capacity | Swarm role | Labels | Responsibility |
| --- | --- | --- | --- | --- |
| `manager-01` | 4 CPU / 4 GB | manager | `nim.edge=true`, `nim.control=true`, `nim.stateful=true` | Traefik, authoritative SwarmOps control-plane state/assets, and planned singleton state |
| `manager-02` | 2 CPU / 2 GB | manager | none initially | lightweight replicas, quorum |
| `manager-03` | 2 CPU / 2 GB | manager | none initially | lightweight replicas, quorum |

Three managers are intentionally used instead of one manager plus workers:
the management plane can still maintain quorum after one manager becomes
unavailable. All three are small, so application resource reservations are
part of every manifest.

```text
                         Internet
                            │
                       TCP 80 / 443
                            │
                  Traefik on manager-01
                            │
                   encrypted overlay: traefik
          ┌─────────────────┼─────────────────┐
          │                 │                 │
    static web/API     static replicas     static replicas
    manager-01         manager-02          manager-03
          │
    external/managed data by default; reviewed stateful slots only after
    capacity, backup, and recovery admission
```

## Platform stacks

### Traefik

The `traefik` stack is deployed first. It is a single replica on the node with
`nim.edge=true` and exposes only HTTP 80 and HTTPS 443. It uses:

- the Swarm provider with labels under `deploy.labels`;
- an external encrypted `traefik` overlay network;
- an optional versioned DNS-token Swarm secret for ACME DNS-01, with HTTP-01
  rendered when no usable provider credential exists;
- an immutable file-provider config name;
- a local named ACME volume.

The Docker socket mount is read-only, but still high privilege. Restrict access
to the edge manager accordingly. The singleton placement is deliberate because
ACME state is local; introduce a tested shared store before making it highly
available.

### SwarmOps

The optional `swarmops` stack follows Traefik. It uses:

- a single Go API, served by a React console composed from `nim-ui` components;
- a local `swarmops_data` volume on the designated manager, holding
  AES-256-GCM-sealed server profiles, audit history, command metadata/payload,
  and pending build contexts; its API image and mounted Swarm configs hold the
  production console and reviewed deployment assets;
- a `node.role == manager` plus `nim.control=true` placement constraint, but
  no Docker-socket mount;
- Traefik HTTPS routing to its internal API port, a protected Traefik dashboard,
  and an un-published Prometheus metrics entrypoint; `/metrics` is scraped only
  over the internal overlay, and a high-priority edge router answers the public
  hostname's `/metrics` path with `noop@internal` so it is never served
  externally.

The deployed API is the sole production control plane. An operator can run only
the Vite UI locally with `SWARMOPS_API_URL=https://<swarmops-host> make
web-dev`; Vite proxies relative API calls to the manager, so the
workstation stores no cluster state or deployment assets and does not run a
local API. Operators add a fresh Ubuntu host, remote Docker host, or Swarm
manager with the one-time native agent installer. The agent generates its
private key locally, exchanges the short-lived code for a renewable client
certificate, pins Core identity, and initiates outbound HTTPS long polls.
Docker/Swarm operations remain gated until the typed readiness plan succeeds;
no SSH credential, inbound agent port, local Docker daemon, socket, or Swarm is
required by the UI workstation.

If the API host itself must remain Docker-free and separate from every cluster,
run `sudo make swarmops-native-bootstrap LISTEN_IP=<server-ip>
ALLOW_CIDR=<operator-cidr> INSTALL_DEPS=1` from a reviewed checkout there.
The command builds the embedded console and API on that controller host,
generates direct TLS for its explicit server IP, selects a random high port,
requires an application-level client CIDR allowlist, and creates a restricted
systemd service with no Docker socket or Docker-group membership. It stores
server-profile metadata, audit history, command metadata/payload, and pending
build contexts as AES-256-GCM sealed files under `/var/lib/swarmops`, with the
separate protected data key under
`/etc/swarmops`. It prints panel login details only after the local TLS
`/readyz` check confirms the Core audit and command stores are writable; a
failed health check reports the service issue and rolls back the partial native
installation. The printed self-signed certificate fingerprint must be verified
before browser trust, and an outer firewall/security group must allow the
selected port only from the same operator networks. This is an alternative
single control plane, not a second API next to the manager-bound Swarm service;
do not run both against separate data directories.

When a remote connection fails, the Servers panel presents a safe diagnostic
for common host-key, credential, SSH, tunnel, and Docker Engine failures along
with a request ID. For a host-key mismatch, it shows the saved and presented
public SHA256 fingerprints so the operator can verify the exact endpoint before
changing a pin. Raw remote error text and secret material remain confined to
protected server-side logs.

SSH may negotiate a different valid host-key type when a server publishes
ECDSA, ED25519, and RSA keys together. Operators must pin the fingerprint of
the key actually presented by the SSH service, after verifying it from a
trusted server console.

The API reads Docker node/service/task state from the selected remote manager.
It can validate and deploy only image-only Compose stacks with bounded resource
definitions, optional explicit selected-node placement, external secrets, and
no host binds/direct ports/build stanzas. Service actions, log tails, image
builds, and observability lifecycle actions are fixed-shape, CSRF-protected,
audited, capped, and disabled until an operator enables their corresponding
flags. It never exposes a Docker socket proxy, shell, arbitrary file read, or
arbitrary command endpoint.

The browser deployment endpoint additionally requires the API's immutable,
reviewed platform manifest and accepts only declared `application` workloads in
that namespace. It permits only namespaced `websecure` Traefik routers for the
workload's exact domain and resolver; TCP/UDP routing, shared middleware, and
unscoped external resources remain Git-reviewed. External secrets, configs,
and volumes must use the exact stack-name prefix, and `traefik` is the sole
external network available to browser stacks. Browser services must stay in
replicated mode, and their aggregate replicas/CPU/memory reservations cannot
exceed the reviewed workload budget. Stateful profiles cannot be replaced by a
browser Compose document; they remain dedicated Git-managed stacks.

`make local` is the complete local-development path. It runs a
source-built native machine agent directly on loopback, then Core and Vite;
Core automatically connects the agent with a pinned local certificate and a
private development API key. It creates no Docker container and still starts
when Docker is unavailable, exposing the local host as a connected bootstrap
target until the engine is ready. Its persistent local identity and Core state
live below `$TMPDIR/swarmops-dev` by default (override with
`SWARMOPS_DEV_DIR`), so restarts do not regenerate the encryption key or try to
read historic state sealed with a different key. `make dev-agent`, `make dev`,
and `make dev-api` run the individual pieces. Vite uses loopback port `5284`
when free and prints the next available port otherwise; set `SWARMOPS_WEB_PORT`
to choose another preferred port. This development flag is not present in the
Swarm manifest; deployed instances continue to require their external
password-hash and session/data-key secrets.

### Routed observability and logs

`swarmops-observability` provides one Prometheus, Alertmanager, and Jaeger
instance for the cluster. Each service uses its own encrypted service-and-
Traefik overlay, with typed aliases for scrapes and alert delivery. It includes
capacity/control-plane rules; the SwarmOps console exposes target health and
will own the few operator graphs directly. The committed
Alertmanager receiver intentionally discards notifications until an operator
replaces it with a reviewed receiver configuration and secret-backed
credentials. Jaeger uses a stateful Badger volume on a labelled node, so trace
retention and recovery are a deliberate operational decision—not a
high-availability claim.

`swarmops-agent` is a separate, explicitly confirmed global stack containing
the SwarmOps read-only host probe and node-exporter. Both remain private to the
overlay. The custom agent has a read-only Docker socket and host-root mount;
that high-trust visibility is never installed merely because the API is live.

`swarmops-logs` is a separate stack with a global Fluentd 1.19.3 forwarder, a
stateful singleton Fluentd aggregator, and a fixed Go query API. The forwarder
reads Docker JSON stdout/stderr and systemd journals through read-only host
mounts. Persistent cursors, acknowledged forwarding, bounded disk buffers and
blocking overflow avoid silent loss. The aggregator stores normalized,
redacted UTC JSONL in one-minute partitions. Query-side cleanup keeps at most
seven days and 20 GiB, deleting oldest partitions first and reporting shortened
retention. Forward and query traffic use separate encrypted internal routes;
no collector or query port is public. Existing historical log volumes are not
imported or deleted.

### Stateful profiles

`mongo-replicaset` uses three named local volumes pinned to exactly one
`nim.mongo.slot=1|2|3` node each. `postgres-primary-replica` uses separate
primary and replica volumes pinned to `nim.postgres.slot=primary|replica`.
The PostgreSQL replica follows the primary, but automatic promotion is not
implemented. A second node enables the PostgreSQL pair only after both slots
and a database-consistent recovery procedure are ready; it is not enough for
the three-member Mongo set.

After a reboot or reconnect, use the node's catalogued read-only continuity
diagnostic before changing placement or data. It verifies Docker, Swarm membership, local
volume continuity, optional backup timer state, and manager visibility; it
does not restore a volume, promote PostgreSQL, or reinitialize MongoDB. The
detailed deployment/recovery protocol is
[`swarmops-stateful.md`](swarmops-stateful.md).

### Application stacks

Each app family owns its manifest in its standalone repository and can be
deployed separately:

| Family | Stack(s) | Notes |
| --- | --- | --- |
| nim.zone | `nim` | two stateless replicas |
| AI gateway | `ai-gateway` | singleton scoped credential boundary |
| Vlora | `vlora-web`, `vlora-app`, `vlora-admin`, `vlora-backend` | backend includes API, worker, face-mesh, and product-image sidecars |
| Iranian Law Club | `iranianlawclub-web`, `iranianlawclub-backend` | API + worker only; data/scanner dependencies external |
| Reelforge | `reelforge` | API + worker only; hosted hostname/rendering/data dependencies supplied per environment |
| Fatemifar | `fatemifar-client`, `fatemifar-go` | staged migration only; Liara stays live until approved cutover |

The Vlora public manifest preserves the existing route split. It does not turn
`vlora.ir` into a catch-all authenticated-app origin.

## Build, registry, and deployment flow

```text
developer or CI, inside the owning app repository
     │
     ├── build the repository's immutable image(s)
     ├── authenticate to its registry
     └── push TAG=<sha>
                         │
                   GHCR or private immutable image
                         │
             docker stack config -c deploy/stacks/<stack>.yml
             docker --context <manager> stack deploy ...
                         │
                 Swarm pulls the exact tag
```

Each app repository documents its exact image stages and public build
arguments in `deploy/README.md`. Browser bundles and image metadata are not
secret stores. The standalone commands render `docker stack config` before
deployment, deploy with registry authentication, and leave pruning opt-in.

## Secret model

Secrets are Docker Swarm secrets, versioned in their *names*. A versioned
secret is created from a protected local file and mounted only into the
services that require it.

| Data | Owner | Delivery |
| --- | --- | --- |
| DNS API token | Traefik only | `traefik_cf_dns_token_vN` → `CF_DNS_API_TOKEN_FILE` |
| AI provider credentials and scoped caller tokens | ai-gateway config | `ai_gateway_config_vN` → `AI_GATEWAY_CONFIG_FILE` |
| product database / API / payment settings | each backend | runtime dotenv secret mounted at the app's existing `.env` path |
| frontend base URLs and release flags | image build | public `VITE_*` build arguments only |

Rotation is forward-only:

1. create a new secret name, such as `vlora_runtime_env_v2`;
2. set the non-secret stack override to the new name;
3. deploy and verify all tasks;
4. remove the unused old secret only after it has no consumers.

This design avoids both in-place mutation and secret values in Git. It does
not erase historical credentials that were already committed elsewhere; those
must be rotated with the affected providers.

## Capacity and scheduling

Static frontends reserve 64 MB and can run two replicas. General Go APIs
reserve 256 MB. Vlora's API and scan worker reserve 512 MB, while its image
sidecars reserve 256 MB each. Reelforge's worker gets the largest initial
limit because rendering is inherently resource-heavy.

These values express safe scheduling intent, not measured production capacity.
Before enabling all heavy workloads together, collect actual CPU/RAM use and
either increase capacity or schedule service families deliberately. Do not
add MongoDB, Postgres, Redis, ClamAV, and observability stacks into the same
small cluster merely because a Compose file previously bundled them.

## Operational checklist

### Before first platform deployment

1. Provision private network/firewall access for Swarm; expose only 80/443
   publicly.
2. Initialize `manager-01`, join `manager-02` and `manager-03` as managers,
   create the encrypted edge network, and set labels.
3. Deploy the SwarmOps singleton on `manager-01`, then use its hosted console
   or a local Vite UI proxy to add a remote manager with a pinned SSH host key
   and a password or private key.
4. Create versioned Traefik and SwarmOps secrets from protected local files,
   including the base64-encoded random 32-byte SwarmOps data-encryption key;
   validate the reviewed non-secret platform manifest, and create its immutable
   Swarm config.
5. Configure DNS/token permissions and non-secret hostnames/ACME email.
6. Build/push SwarmOps API and agent images; run `make stack-check
   STACK=traefik` and `make stack-check STACK=swarmops`.
7. Deploy `make platform-deploy HOST=manager-01` for the manager-hosted
   control-plane stack.
8. After the first deploy, a mutation-enabled SwarmOps console may reconcile
   only the checked-in Traefik asset when the operator types `DEPLOY_TRAEFIK`.
   It never accepts routes, ACME values, DNS tokens, or dashboard credentials
   from the browser.
9. Verify HTTPS issuance, SwarmOps login, the selected remote-manager
   inventory, Traefik dashboard protection, and service task placement before
   deploying products.
10. If capacity/retention/backups are approved, deploy the core observability
   stack, verify Prometheus targets, Alertmanager receiver delivery, and
   Jaeger storage, then separately decide
   whether to enable the host probe/node-exporter and host log collection.

### Before an application cutover

1. Build and push an exact Git SHA tag.
2. Create the backend's versioned runtime secret.
3. Validate the manifest and external dependency connectivity.
4. Confirm DNS, CORS, callbacks, data migration/backup, payment/SMS/OAuth
   behavior, and product-specific critical paths.
5. Deploy one stack without `PRUNE=1` and inspect the task state.
6. Verify HTTPS and health checks; for browser/native products, verify the
   real authenticated/device flow separately.
7. Keep the prior deployment usable until rollback is demonstrated.

### Rollback

Use the owning repository's documented service rollback command for a failed
Swarm update, or redeploy the previous immutable `TAG`. Do not
attempt a database rollback unless its migration plan, backup, and forward-fix
path were reviewed first.

## Evidence boundary

The repository validates stack rendering, shell syntax, Go contracts, and the
frontend build locally. It
does not prove remote node availability, Docker daemon compatibility, registry
permissions, DNS propagation, ACME issuance, SwarmOps
authentication, SSH host-key/credential acceptance, selected-server reachability,
data connectivity, browser flows, or mobile behavior. Those are explicit
operator and product verification steps after the infrastructure is provisioned.
