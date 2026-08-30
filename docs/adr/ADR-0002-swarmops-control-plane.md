# ADR-0002: Replace the active Portainer path with SwarmOps

**Status:** Superseded by ADR-0007. Retained as historical context only.

**Date:** 2026-08-23

**Deciders:** Nima Sarayan

## Context

The platform needs a Swarm-native control plane with the useful operational
surface of Portainer and the explicit resource/scheduling posture of Nomad,
without creating an arbitrary remote Docker shell. The existing three-manager
topology has limited capacity, a Traefik edge, image-only Git-managed stacks,
and no shared control-plane database. It must also support a trusted-workstation
Ansible bootstrap for hosts reached through SSH username/password prompts.

## Decision

Use the standalone SwarmOps repository as the active control-plane path:

- a remote SSH Go API with simple bcrypt-backed operator authentication, signed
  HTTP-only sessions, CSRF protection, login throttling, and append-only audit
  events. It has no Docker socket mount or local-Docker dependency;
- a React console using `nim-ui` where operators add remote Docker hosts or
  Swarm managers with a pinned SHA256 SSH host key and either a password or
  private key. Credentials remain in process memory only;
- a constrained Compose deployment policy, selected-node placement injection,
  bounded service operations/log tails, and resource-capped local build intake;
- a checked Traefik/ACME DNS-challenge stack with protected dashboard and
  internal metrics, reconcilable only from its trusted checked-in asset;
- one optional Prometheus/Alertmanager/Jaeger stack and a separately enabled
  Fluentd forwarder/aggregator/query log stack;
- Ansible preflight and a guided provisioning command that keep SSH passwords
  in terminal prompts and consume only external secret-file paths.

Git manifests and immutable GHCR or private-registry images remain the
configuration and release source of truth.
The legacy Portainer manifest is retained only for a reviewed
migration/rollback decision; it is no longer included in `platform-deploy`.

## Consequences

### Positive

- Operators get node, task, service, stack, metrics, and audit visibility in a
  product-owned interface without publishing Docker's socket or requiring a
  Docker daemon/Swarm on the SwarmOps host.
- Browser changes use fixed Docker command shapes, resource/payload caps,
  allow-lists, CSRF, typed confirmations for broad removal, and audit checks.
- The API never accepts cloud tokens, registry credentials, filesystem paths,
  arbitrary commands, host binds, direct application ports, or inline secrets.
- Observability and host log collection have explicit capacity, retention, and
  privileged-mount boundaries.

### Negative / trade-offs

- The initial API is intentionally a singleton because its local audit volume
  and in-memory SSH connections are not shared. It is not an HA control plane.
- Remote Docker access remains root-equivalent on the selected server. Pinned
  SSH host keys and constrained API endpoints reduce exposure but do not remove
  the host-trust boundary.
- Badger/Prometheus/Fluentd-log volumes are node-local and require a recovery
  plan before broader retention or high availability is claimed.
- Full Portainer/Nomad feature parity—RBAC/SSO, multi-cluster tenancy, build
  farms, workflow scheduling, policy engines, and distributed audit storage—is
  deliberately outside this initial single-operator design.

## Alternatives considered

### Keep Portainer as the active control plane

It provides broad functionality quickly, but its general management surface
and separate state/configuration encourage drift from Git-managed manifests.
It does not provide the intentionally narrow, auditable product contract.

### Expose Docker API directly to a custom web UI

This is rejected. Docker's API is root-equivalent and its unrestricted command
surface cannot be made safe by placing a browser in front of it.

### Adopt Nomad instead of Docker Swarm

Nomad offers stronger scheduling primitives, but replacing the existing Swarm,
Traefik, image, and operator topology is a separate platform migration. The
current decision preserves Docker Swarm and adds selected-node placement plus
mandatory resource limits first.

## Required production evidence

1. Three-manager Ansible apply and post-apply quorum/label checks.
2. Immutable API/agent image build and registry push where the optional stack
   is used.
3. Versioned secret creation outside Git, then stack render/deploy when the
   optional stack is used.
4. HTTPS/ACME issuance, protected dashboard, SwarmOps login, and a pinned SSH
   connection to the selected remote manager.
5. Prometheus target health, Alertmanager delivery, Jaeger persistence, and
   optional log-collector verification after deliberate enablement.
6. Backup/recovery test for every enabled local state volume before calling the
   corresponding service production-ready or highly available.
