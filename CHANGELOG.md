# Changelog

All notable SwarmOps changes are recorded here. Release tags are immutable and
the native installers resolve the latest published GitHub Release by default.

## [Unreleased]

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

[Unreleased]: https://github.com/nimasrn/SwarmOps/compare/v0.4.1...HEAD
[0.4.1]: https://github.com/nimasrn/SwarmOps/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/nimasrn/SwarmOps/compare/v0.3.3...v0.4.0
[0.3.3]: https://github.com/nimasrn/SwarmOps/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/nimasrn/SwarmOps/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/nimasrn/SwarmOps/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/nimasrn/SwarmOps/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/nimasrn/SwarmOps/compare/v0.1.0...v0.2.0
