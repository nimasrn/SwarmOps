# ADR-0004: Enrollment tokens, sealed machine keys, and managed databases

**Status:** Accepted for repository implementation; production installation
remains an explicit operator action.

**Date:** 2026-08-25

**Deciders:** Nima Sarayan

## Context

Connecting a host to SwarmOps required three commands and manual TLS
preparation on the target, then hand-transcribing four values — HTTPS URL,
port, certificate fingerprint, and machine API key — into the console. The API
key had to travel to the operator through a separate secure channel, and
because keys lived only in controller memory, every restart required
retyping every one of them.

Separately, the deployment primitive was an image-only application stack.
Running a database meant authoring and reviewing a Git manifest by hand, so the
most common thing an operator wants on a fresh cluster — Postgres, MongoDB, or
Redis — was the slowest thing SwarmOps could give them.

Both gaps came from the same defensible instinct: never let a browser author
stateful Compose, and never hold a root-equivalent credential longer than
necessary. The instinct is right; the resulting onboarding was not.

## Decision

**One-command install.** `scripts/install-swarmops-agent.sh` runs with no
required flags. It generates the agent's P-256 leaf certificate, machine API
key, and a single-use enrollment secret, and installs the service.
`--install-docker` installs Docker Engine from Docker's own signed apt
repository on Debian/Ubuntu — never a piped convenience script — and
`--init-swarm` forms a single-node Swarm only when the host is in none.
Reviewed TLS material and a supplied API key remain accepted.

**One-paste enrollment.** The installer prints one `swarmops1.` token carrying
the origin, the pinned leaf fingerprint, and the one-time secret — never the
machine API key. The controller decodes it, dials the agent with the
fingerprint already pinned, and exchanges the secret for the key at
`POST /v1/enroll`. The agent accepts that exchange at most once, deletes its
on-disk secret, and closes the window permanently, including after a small
budget of failed attempts. A token in a clipboard is therefore worth one
race against the operator, not a standing credential.

**Sealed machine API keys.** An enrolled operator holds no key to retype, so
the received key is AES-256-GCM sealed in the controller's own encrypted
volume and machine-API profiles reconnect at startup. This is the one posture
change here and it is deliberate: memory-only keys plus enrollment would strand
every host on restart with nothing to type. The key is still never returned by
an endpoint, shown in the console, or written to the audit trail, and
disconnecting or removing a server deletes the sealed copy.
`SWARMOPS_RETAIN_MACHINE_KEYS=false` restores the previous behaviour.

**Managed databases.** PostgreSQL, MongoDB, and Redis ship as reviewed,
checked-in Compose assets mounted read-only into the API, exactly like the
Traefik and observability stacks. The console selects only whether one runs.
The password is generated on the controller and created as a Swarm secret; it
is never returned to a browser. Each engine is pinned to a `nim.stateful=true`
node and attached only to the internal `swarmops` overlay. Removal requires the
exact `REMOVE_DATABASE_<ENGINE>` confirmation and leaves the named volume in
place.

## Consequences

- A first install is one command and one paste. The operator never handles a
  machine API key or a certificate fingerprint.
- The agent command vocabulary grows by exactly two bounded shapes: listing
  Swarm secret names, and creating one secret whose name must start with
  `swarmops_`. Browser-authored stateful Compose remains impossible.
- The controller volume is now a higher-value target: it holds sealed machine
  API keys in addition to sealed profiles, audit history, and command state.
  Its encryption key and host access were already the control plane's root of
  trust, so the blast radius is unchanged in kind, larger in degree.
- Self-signed leaf certificates are the default. Pinning makes a CA
  unnecessary, but it also means fingerprint changes on agent reinstall; a
  reinstalled agent is re-enrolled rather than reconnected.
- Managed databases are one instance per engine per cluster, single-replica,
  and not published beyond the internal overlay. Multiple instances,
  replication, and backup/restore validation remain future work.
