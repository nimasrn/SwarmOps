# Native release installation and updates

SwarmOps native installations use exactly two executables on a host:

- `swarmops-core` is the Docker-free control-plane API, embedded console, and
  reviewed deployment-assets process. Core bundles include the agent, logging,
  observability, Traefik, PostgreSQL, MongoDB, and Redis stack assets. Encrypted
  state remains outside a release at `/var/lib/swarmops`.
- `swarmops-agent` is the constrained host-side machine API. It remains
  separate from Core so the controller never receives a Docker socket, and it
  stays healthy when Docker is not yet running.
- `swarmops-warden` is the shared local updater. A Core host has Core + Warden;
  an agent host has Agent + Warden. It has no network control endpoint.

The GitHub release workflow builds the following assets for every immutable
`v*` tag:

```text
swarmops-agent_<tag>_linux_amd64.tar.gz
swarmops-agent_<tag>_linux_arm64.tar.gz
swarmops-agent_<tag>_darwin_amd64.tar.gz
swarmops-agent_<tag>_darwin_arm64.tar.gz
swarmops-core_<tag>_linux_amd64.tar.gz
swarmops-core_<tag>_linux_arm64.tar.gz
checksums.txt
install-swarmops-agent.sh
install-swarmops-core.sh
```

The installer resolves `latest` by default, downloads only HTTPS GitHub release
assets, validates the matching SHA-256 entry in `checksums.txt`, rejects archive
contents other than the expected files, and never clones or compiles source on
the target. The GitHub repository and immutable release tag remain the trust
root; the checksum catches transfer corruption or an incomplete download but is
not an independently signed provenance statement.

## Install Core on the controller and data host

Download the release installer, then run it as root on a fresh Linux controller:

```bash
curl --fail --location --remote-name \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh
sudo bash install-swarmops-core.sh \
  --listen-ip <literal-server-ip> \
  --allow-cidr <operator-device-ip>/32
```

Core obtains a random high port, direct TLS certificate, independent session
and data-encryption keys, and a restricted `swarmops-control-plane.service`.
Its listener uses a wildcard bind so Warden can query its own loopback
`/readyz`; the direct-TLS CIDR gate still restricts browser/API clients to the
operator CIDRs supplied at installation. It does not receive a Docker socket or
Docker-group membership. Enrollment-based installations keep machine API keys
only in AES-256-GCM-sealed Core state so agents reconnect after a restart; set
`SWARMOPS_RETAIN_MACHINE_KEYS=false` for memory-only keys and manual reconnects.

## Install Agent on a host

On Linux, download the release installer and run it with `sudo`. On macOS, run
it as the logged-in user without `sudo`:

```bash
# Linux:
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash
# macOS:
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | bash
```

The agent installer defaults to `0.0.0.0:9180` and creates a P-256,
self-signed certificate and owner-only key itself. Their SwarmOps-owned paths
are `/etc/swarmops-agent/tls/agent.crt` and
`/etc/swarmops-agent/tls/agent.key` on Linux, or
`$HOME/.config/swarmops-agent/tls/agent.crt` and
`$HOME/.config/swarmops-agent/tls/agent.key` on macOS. The controller pins the
exact leaf certificate, so no external CA or operator-supplied certificate is
required. The installer prints the TLS fingerprint and one `swarmops1.…`
enrollment token—never the API key. Paste that token into **Servers → Add
server**. Core exchanges its one-time secret for the key over the pinned TLS
connection, and the agent burns the token after the successful exchange. The
listener must remain reachable only from the controller through an explicit
firewall rule. Advanced operators may provide a certificate only with the
paired `--tls-cert-file` and `--tls-key-file` flags, or use the console’s manual
connection fields for an existing installation.

The default installation does not change Docker or Swarm, and legacy
`--install-docker` / `--init-swarm` flags are rejected. After the token has
been enrolled, **Servers** can approve the fixed Debian/Ubuntu Docker setup,
initialize a new Swarm, or join the selected Swarm. For a join, the selected
manager issues Docker's short-lived credential directly to the enrolled
destination agent; it never enters the browser, a queued payload, audit event,
or command log.

For the reviewed local-volume handover workflow, source data remains until a
replacement completes sustained health burn-in and an administrator presses the
separate retirement action. SwarmOps rechecks the replacement on the exact
destination immediately before that cleanup. If a handover fails before source
cleanup starts, the console offers a typed-confirmation closure that only
releases its record after manual review; it never deletes data or changes
Docker. A record whose cleanup may have started stays open for recovery.

The agent service starts without a Docker CLI or live Docker socket. It reports
the host as connected but Docker-unavailable until Docker starts; Core blocks
Docker and Swarm operations during that state. This lets Warden supervise the
host agent and its pinned TLS health endpoint independently of Docker startup.

## Warden behavior

Linux timers check every 12 hours after an initial 15-minute delay:

```bash
sudo systemctl start swarmops-core-warden.service
sudo systemctl start swarmops-agent-warden.service
```

Only run the unit installed for that component. On macOS, the agent updater is
the `com.nimasrn.swarmops-warden` LaunchAgent.

For an update, Warden downloads and checksum-verifies the candidate before it
stops the local service. It atomically changes only the `current` symlink in
the component's release directory, starts the fixed service, and waits for the
local `/healthz` (Agent) or `/readyz` (Core) probe. A failed candidate is
stopped, the previous symlink is restored, the previous service is started and
checked, and the failed candidate directory is removed. A successful update
keeps the current release plus the two most recent prior known-good release
directories. It never deletes `/var/lib/swarmops`, `/etc/swarmops`, the agent
API key, or TLS material.

## Publishing a release

Creating and pushing a new immutable tag that matches `v*` is the only event
that triggers `.github/workflows/release.yml`. The action runs Go,
documentation, deployment-asset, and embedded-console checks; builds every
supported native bundle; then creates (or updates) the matching GitHub Release.
It does not run for branch pushes or manually dispatched workflows, and it
skips moved or deleted tags.
