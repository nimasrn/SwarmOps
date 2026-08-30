# ADR-0003: Host SwarmOps on a Docker-free encrypted controller

**Status:** Accepted for repository implementation; production installation
remains an explicit operator action.

**Date:** 2026-08-24

**Deciders:** Nima Sarayan

## Context

The control plane must be able to run on a freshly installed server that is
separate from every Docker Swarm cluster. The host needs to serve the complete
SwarmOps web console and its API without Docker, a Docker socket, a local
Swarm, Traefik, or a cluster-manager role. An operator must be able to reach
that console using the host IP and a randomly chosen port.

The existing native path builds the embedded console but binds HTTP to loopback
for an external reverse proxy. It also kept safe server metadata and audit
records as protected but plaintext local files. That is insufficient for an
independent controller device and does not provide direct encrypted transport
or encrypted state at rest.

## Decision

Add a fresh-host bootstrap at scripts/bootstrap-swarmops-control-plane.sh. It
creates one server-local SwarmOps service with these boundaries:

- the Go API serves its compiled React/Nim console directly; no Vite process,
  local Docker daemon, Docker socket, or Swarm is installed or used;
- the bootstrap requires a literal local listener IP and at least one allowed
  operator CIDR, chooses and persists a random high TCP port, and binds only
  that IP;
- it generates an ECDSA certificate with that IP as a SAN and starts direct
  TLS 1.3. Before printing any panel login details, the bootstrap must obtain
  a successful local TLS `/readyz` response, proving the API's durable audit
  and command stores are writable. A failed readiness check reports the
  service issue and rolls back the partial installation; only then is the
  generated certificate fingerprint printed for an operator to verify before
  trusting the self-signed certificate;
- an interactive administrator password is bcrypt-hashed without being placed
  in an environment variable or command argument. Independent session and
  data-encryption keys are generated as protected files;
- the systemd service uses a dedicated account with no Docker-group membership,
  no Linux capabilities, a read-only runtime/configuration boundary, and write
  access only to its state directory. Mutations and remote image builds start
  disabled;
- server-profile metadata, audit history, command metadata/payload, and pending
  build contexts use AES-256-GCM with a distinct random nonce per write or
  stream chunk; an entire build context is authenticated before remote use. The
  data key is kept outside the encrypted state directory. SSH passwords, private
  keys, and passphrases remain memory-only and are never persisted.

The existing loopback native runner remains available for reviewed reverse-proxy
topologies, but now also requires the dedicated data-encryption key.

## Options considered

### Option A: Loopback API plus an operator-provided reverse proxy

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | Requires a separate proxy and certificate lifecycle |
| Scalability | One controller instance |
| Team familiarity | High |

**Pros:** Public certificate and routing can be managed at the edge.

**Cons:** Does not give a freshly installed standalone controller a direct
server-IP web view; adds another component and its own trust boundary.

### Option B: Docker-free direct-TLS controller host

| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Cost | One host and no runtime container dependency |
| Scalability | One controller instance |
| Team familiarity | High: Go, Bash, systemd, SSH |

**Pros:** Meets the standalone-host requirement; preserves the remote SSH
boundary; encrypts control-plane state; requires explicit client-network
access; starts with no cluster mutations.

**Cons:** A self-signed IP certificate requires fingerprint verification or
device trust-store installation; it is not highly available; its encryption
key must be backed up separately.

### Option C: Run SwarmOps on a Swarm manager

| Dimension | Assessment |
|-----------|------------|
| Complexity | Low initially |
| Cost | Reuses a cluster host |
| Scalability | Tied to manager availability |
| Team familiarity | Existing deployment model |

**Pros:** Existing stack and Traefik integrations can be reused.

**Cons:** Couples controller availability and attack surface to the managed
cluster, requires Docker/Swarm placement, and conflicts with the separate
device requirement.

## Trade-off analysis

Option B separates the high-trust controller from managed clusters while
retaining a small, fixed-shape SSH/Docker control surface. A random port is
only discovery friction, not an access control; TLS, a required application
CIDR allowlist, authentication, CSRF protection, and host hardening are the
security controls.

AES-GCM protects a copied state volume or backup when its independent key is
not present. It cannot protect against a running controller host compromised
as root because that host can read both the key and process memory. A future
hardware-backed key, external KMS, or operator-entered unlock secret would be
needed for that stronger threat model.

## Consequences

- A controller device can manage zero or more remote clusters without becoming
  a member of any of them.
- The browser receives only the embedded GUI and constrained API; it never
  receives a Docker socket, shell, remote file API, SSH credential, or
  unbounded command endpoint.
- Existing plaintext servers.json, audit.ndjson, and pending build-input files
  are migrated to sealed files on successful startup and removed. A controller
  fails closed if an obsolete plaintext file remains beside sealed state.
- A lost data-encryption key makes the stored controller state unrecoverable.
  Back up the key separately from encrypted state, with access controls
  appropriate for the controller.
- Direct-IP TLS needs an outer firewall/security-group rule that limits the
  selected random port to the same operator networks as the application
  allowlist.

## Action items

1. [x] Add the Docker-free bootstrap, systemd sandbox, direct TLS, and
   required client-network allowlist.
2. [x] Seal all persisted controller state, including pending build inputs,
   with AES-256-GCM.
3. [x] Keep remote SSH secrets in process memory only and leave build/mutation
   switches disabled by default.
4. [ ] Install on a designated controller host and verify its TLS fingerprint,
   login, client-network rejection, and no-local-Docker behavior.
5. [ ] Add an outer firewall/security-group allow rule for the selected port.
6. [ ] Store an encrypted-state backup and its separate data key in an
   operator-approved recovery location.
7. [ ] Decide whether a future hardware-backed key, external KMS, or
   passphrase-unlock mode is required for the controller threat model.
