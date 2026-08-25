# Changelog

All notable SwarmOps changes are recorded here. Release tags are immutable and
the native installers resolve the latest published GitHub Release by default.

## [Unreleased]

## [0.5.0] - 2026-08-25

### Added

- Controller-managed host setup after one-time enrollment: reviewed Docker
  installation on Debian/Ubuntu, Swarm initialization, and secure joining to
  the selected manager without exposing a join token to the browser, queue,
  audit ledger, or command logs.
- Encrypted durable command logs with bounded redaction and a per-command Logs
  panel. Fixed-operation evidence is retained beside the command while service
  logs, build output, source archives, payloads, and secrets remain excluded.
- Guarded stateful data mobility for the SwarmOps control plane, MongoDB,
  PostgreSQL, Redis, and reviewed monitoring stores. Each handover uses fixed
  service/volume catalog entries, quiesced checksum-verified transfer, target
  health burn-in, retained source data, and an explicit administrator-only
  source-retirement action. Cleanup rechecks the replacement's exact target;
  a failed pre-cleanup handover has an audited typed-confirmation closure that
  retains source data and makes no Docker change.

### Changed

- The one-command agent installer prints progress and an explicit completion
  summary with the enrollment token. It now rejects legacy Docker/Swarm setup
  flags; installer execution never modifies Docker or Swarm membership.
- The console documents the distinction between movable local-volume state and
  real database or control-plane replication, so a handover is not presented
  as high availability.

## [0.4.2] - 2026-08-25

### Fixed

- Fixed explicit `--release <tag>` installs exiting silently before the native
  agent, service, and enrollment-token summary were installed. The installer
  now returns success for an already-selected release and offers
  `--validate-only` for no-side-effect option checks.

## [0.4.1] - 2026-08-25

### Fixed

- Corrected the native machine-agent installer's safe-value validator so its
  default `0.0.0.0:9180` listener, loopback listeners, IPv6 listeners, and
  protected filesystem paths pass validation while unsafe shell characters
  remain rejected.

## [0.4.0] - 2026-08-25

### Added

- One-paste machine enrollment. The agent installer prints a single-use token;
  Core exchanges it over the pinned TLS connection without exposing the
  long-lived machine API key to the operator.
- Optional Docker Engine installation and single-node Swarm initialization in
  the Linux machine-agent installer.
- Reviewed PostgreSQL, MongoDB, and Redis stacks with generated Swarm secrets,
  encrypted controller-side connection records, and explicit removal phrases.
- Manifest-approved application deployment with rendered Compose, Traefik
  routing, health checks, backend links, database delivery, and durable status.
- Prometheus HTTP service discovery at `/metrics/targets` for approved rendered
  applications that expose metrics.

### Changed

- Enrollment-based Core installations retain machine API keys only as
  AES-256-GCM-sealed controller state so hosts reconnect after a restart.
  Operators can restore the memory-only posture with
  `SWARMOPS_RETAIN_MACHINE_KEYS=false`.
- Native Core release bundles now carry all reviewed managed-database stack
  assets alongside the agent, observability, logging, and Traefik assets.
- The console adds first-class Applications and Databases workflows while
  keeping mutations disabled unless explicitly enabled by the operator.

## [0.3.3] - 2026-08-24

- Added the one-command local workflow and allowed the host agent to start
  before Docker is available.

## [0.3.2] - 2026-08-24

- Added automatic local-development agent connection.

## [0.3.1] - 2026-08-24

- Generated agent TLS during installation and restricted native publishing to
  immutable new tags.

## [0.3.0] - 2026-08-24

- Added checksum-verified native bundles and rollback-safe Warden updates.

## [0.2.0] - 2026-08-24

- Released the standalone public repository and native installation path.

[Unreleased]: https://github.com/nimasrn/SwarmOps/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/nimasrn/SwarmOps/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/nimasrn/SwarmOps/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/nimasrn/SwarmOps/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/nimasrn/SwarmOps/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/nimasrn/SwarmOps/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/nimasrn/SwarmOps/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nimasrn/SwarmOps/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nimasrn/SwarmOps/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nimasrn/SwarmOps/compare/v0.1.0...v0.2.0
