# ADR-0006: Import private Git source as evidence for closed deployments

**Status:** Accepted for repository implementation; provider, registry, DNS,
TLS, database, observability, and Swarm behaviour still require a non-production
live canary before production use.

**Date:** 2026-08-25

**Deciders:** Nima Sarayan

## Context

SwarmOps can render an approved application from an immutable image, attach its
managed data services, expose a reviewed domain, and register a metrics target.
The operator still has to inspect a repository manually, find the relevant
Compose file or Dockerfile, build and push its image elsewhere, translate its
database dependencies, and avoid deploying a second copy of a platform service
such as Prometheus or Jaeger.

That translation is especially costly in a monorepo with several Compose files
and build contexts. Deploying a discovered Compose document directly would be
easier, but would also let repository-controlled mounts, labels, networks,
commands, and secrets bypass the fixed-shape application and admission model.
Cloning arbitrary repositories on the controller would add subprocess,
credential-helper, filesystem-cleanup, protocol, and build-context risk to the
control plane.

The feature also needs private-source credentials. A provider token must be
usable after a controller restart without being returned to the browser,
included in an audit record, placed in a command payload, or written into a
build context.

## Decision

**Add an adapter-based source plane.** SwarmOps supports GitHub, GitLab, and
Gitea/Forgejo through bounded HTTP API adapters. Public providers have fixed
base endpoints. A self-hosted provider requires an HTTPS base URL whose exact
host is present in reviewed configuration; redirects must remain on that host.
The one exception is GitHub.com's fixed `codeload.github.com` archive host,
where authentication headers are stripped before the redirect is followed. An
unknown forge is unsupported until it has a reviewed adapter and protocol
fixtures. There is no arbitrary HTTP proxy.

**Seal provider tokens and return only metadata.** Creating a connection
verifies the token with the provider, then seals it with the controller data
key. API responses contain an opaque connection ID, provider kind, display
name, normalized base URL, account label, and timestamps, never the token.
Removal deletes the sealed credential. Read-only provider scopes are the
documented default.

**Treat repository content as evidence, not authority.** The adapter resolves
the selected ref to an immutable commit and reads a bounded tree. The scanner
finds `compose.yml`, `compose.yaml`, `docker-compose.yml`,
`docker-compose.yaml`, `Dockerfile`, and `Dockerfile.*` at any depth. It reads
only candidate metadata under entry, manifest, file, byte, page, and time
limits. Durable evidence stores paths, modes, sizes, digests, and the commit
SHA; it does not store source bodies, Compose bodies, or secret-like
environment values.

**Generate a reviewable import plan.** Every discovered service is classified
as an application, managed-data replacement, shared-platform replacement, or
unsupported. PostgreSQL, MongoDB, Redis, and Valkey map to SwarmOps-managed
data services. Prometheus, Alertmanager, Jaeger, Fluentd, and exporters map
to the reviewed platform stacks and are not deployed again. Dashboard
containers are unsupported.
Ambiguous ports, contexts, dependencies, images, or secret requirements become
explicit `needs_review` findings; a blocker makes the plan non-deployable.
Repeated analysis of the same provider, repository, commit, and scanner version
must produce the same digest.

**Keep execution closed and durable.** Source Compose is never sent to Docker.
The reviewed plan produces existing `ApplicationSpec` inputs and passes
`ValidateCompose`, platform admission, and live capacity admission. A source
build exports only regular files from the pinned context into the encrypted
artifact queue, then uses the existing capped build path. Every mutation keeps
the selected-manager, CSRF, idempotency, write-before-execute, audit, retry, and
`needs_attention` boundaries.

**Use isolated routed networks deliberately.** Every application and managed
dependency uses one encrypted service-and-Traefik overlay. Typed dependency
bindings add a derived Traefik alias to the caller overlay; Prometheus and the
telemetry clients never join a backend network. Repository-defined observability
services, scrape configuration, and privileged collectors are ignored or
blocked rather than deployed.

**Make domains mutable only inside reviewed policy.** Existing exact domains
remain valid application-slot policy. Reviewed configuration may additionally
declare domain suffixes. Assignment normalizes the hostname, verifies the
exact/suffix policy and runtime uniqueness, then queues a fixed-shape
application update. Removal queues the same application without a public route
and is reversible. Repository labels cannot claim domains, DNS records, or
certificate resolvers.

**Roll out in gates.** Connection, repository listing, and analysis ship as a
read-only gate first. Source-context export/build, managed-service attachment,
shared observability, and domain mutation each have separate enablement and
verification gates. Production expansion requires a non-production private
repository canary with token revocation, build/push, database reachability,
metrics/traces, DNS/TLS, domain removal, rollback, and recovery evidence.

## Options Considered

### Clone repositories with `git` on the controller

This provides universal Git semantics and efficient local tree access. It was
rejected because it adds subprocess execution, protocol handling, credential
helpers, temporary worktrees, cleanup, and symlink/special-file concerns to the
control plane. Provider APIs keep source access read-only and bounded.

### Deploy discovered Compose directly

This offers maximum compatibility with existing projects. It was rejected
because arbitrary labels, mounts, networks, commands, capabilities, and secrets
would bypass SwarmOps' closed renderer and admission rules. Compose remains
useful evidence, not an executable contract.

### Put provider-specific requests inside HTTP handlers

This is faster for one provider. It was rejected because pagination,
authentication, rate-limit, URL, and fixture behaviour would be duplicated and
private-forge support would be hard to review. Adapters keep provider mechanics
outside the API and planner.

### Require hosted CI or webhooks for every deployment

Hosted CI has mature checkout and build tooling and is a sensible later trigger.
It was rejected as the initial path because it adds external callbacks and
provider-specific setup before SwarmOps can offer one self-hosted, operator-led
deployment flow.

## Consequences

- A private monorepo becomes one guided flow: connect, select a repository and
  ref, review discovered candidates and substitutions, then explicitly build or
  deploy.
- The controller's sealed store becomes more valuable because it contains
  provider tokens in addition to machine keys and database connection material.
  Key handling, backup, host access, and revocation drills are launch gates.
- Provider API behaviour and rate limits are now production dependencies for
  analysis, but not for already-deployed workloads.
- Some valid Compose projects will stop at `needs_review`. This is intentional:
  unsupported features are surfaced rather than guessed or silently dropped.
- Mapping a database service does not migrate its existing data and never
  deletes repository-owned or managed volumes automatically.
- Domain assignment changes an application route, not authoritative DNS. Live
  DNS and certificate issuance remain independently verified operational steps.
- GitHub, GitLab, and Gitea/Forgejo are the initial compatibility surface;
  adding another private forge requires an adapter, bounded fixtures, and an
  explicit owner.

## Implementation Evidence and Remaining Gates

- Repository implementation includes sealed connection storage, verified
  provider identities, GitHub/GitLab/Gitea adapter fixtures, bounded monorepo
  discovery, source-value non-disclosure tests, regular-file archive export,
  and authenticated `/api/v1/sources` contracts.
- Reviewed plans feed one fixed-shape `source.deploy` command. It can reconcile
  mapped managed databases and global stacks, build one pinned context through
  the encrypted artifact queue, and deploy the existing `ApplicationSpec`;
  source Compose never becomes a command input.
- Dynamic-domain admission, runtime uniqueness, assignment/removal commands,
  shared metrics/tracing network rendering, and focused contract tests are in
  the repository implementation.
- Still required before production enablement: a non-production private-
  repository canary covering token revocation, registry build/push, database
  reachability, Prometheus scraping, Jaeger ingestion, DNS/TLS issuance, domain
  removal, rollback, command recovery, and controller-state restore.
