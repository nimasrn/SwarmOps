# ADR-0007: Host-native SwarmOps Core and outbound agents

**Status:** Accepted; implementation and live acceptance are tracked separately.

**Date:** 2026-08-27

**Deciders:** Nima Sarayan

## Context

The prior control-plane design mixed Core placement, managed node identity,
inbound machine APIs, SSH bootstrap, and fleet automation. The result made it
hard to understand which machine was authoritative, required more network and
credential surface than the product needs, and fragmented operations across
unrelated pages.

SwarmOps needs one movable Docker-free authority, multiple intermittently
connected Ubuntu nodes, durable typed work, and a simple source-to-running-app
workflow. It must remain useful on a one-manager Swarm while explaining that
three managers are the resilient target.

## Decision

- Run exactly one active host-native `swarmops-core` on macOS or Ubuntu. Core
  never needs Docker and is never implicitly a managed node.
- Run `swarmops-agent` as a systemd service on Ubuntu 22.04 or 24.04. Agents
  initiate outbound HTTPS long polls; no inbound agent port, SSH stream,
  WebSocket, or Traefik dependency carries control traffic.
- Give dashboard-generated install commands and install-first claim codes equal
  product prominence. Both end in a locally generated private key, renewable
  client certificate, and pinned Core identity.
- Persist one monotonically increasing authority epoch. Agents retain the
  highest epoch they have accepted and reject an older or unknown authority.
- Persist commands before acknowledgement and model their full lifecycle as
  `uploading`, `queued`, `leased`, `preparing`, `running`,
  `retry_scheduled`, `succeeded`, `failed`, `needs_attention`, `superseded`,
  or `cancelled`.
- Permit only versioned, fixed-shape catalog operations. No arbitrary remote
  shell or Docker-socket proxy is a product capability.
- Make Core movement planned and fenced. Promotion increments the epoch;
  automatic failover is outside v1.
- Organize the interface into Home, Infrastructure, Applications, Deploy,
  Traffic, Observe, Operations, and Settings. Core status is always separate
  from cluster and agent status.
- Keep managed HTTP/TCP/UDP ingress in the singleton Traefik deployment while
  Docker overlay/control traffic and agent-to-Core HTTPS stay outside it.
- Keep one logical Prometheus, Jaeger, Fluentd aggregator, PostgreSQL, MongoDB, and Redis per
  cluster, with application-specific identities and explicit migration plans
  for existing state.

## Consequences

- A disconnected agent can resume ordered work without making Core wait on a
  live stream. Duplicate intent is resolved in the durable queue, not by
  replaying remote commands.
- Core certificate and authority changes become explicit operational events.
  Losing Core state or its encryption material is not hidden by an automatic
  failover claim.
- Host operations require local privileged helpers with narrow validation, but
  Core and the browser cannot turn user input into arbitrary execution.
- A local build, fixture, or renderer check cannot prove Docker, registry,
  DNS, ACME, network partition, update rollback, backup restoration, or Core
  movement behavior. Those remain named live-acceptance gates.

## Current implementation boundary

The repository implements the authority epoch, durable command leases and
states, outbound long-poll transport, both certificate enrollment flows,
closed agent request forwarding, and the eight-workspace console structure.
Signed three-slot supervisors, portable SQLite/Mongo repository migration,
continuous Core state transfer, host `auditd` ingestion, and the complete live
acceptance matrix are not established merely by this ADR and must not be
reported as complete without their tests and operator evidence.
