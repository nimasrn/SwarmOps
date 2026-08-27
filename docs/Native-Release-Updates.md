# Native release installation and updates

SwarmOps native installations keep Core and Agent as separate host processes:

- `swarmops-core` is the Docker-free control-plane API, embedded console, and
  reviewed deployment-assets process. Core bundles include the agent, logging,
  observability, Traefik, PostgreSQL, MongoDB, and Redis stack assets. Encrypted
  state remains outside a release at `/var/lib/swarmops`.
- `swarmops-agent` is the constrained host-side machine API. It remains
  separate from Core so the controller never receives a Docker socket, and it
  stays healthy when Docker is not yet running.
- `swarmops-warden` supervises checksum-verified native release bundles. The
  Core installer activates it. Outbound Agent installations instead use a
  fixed local Git updater restricted to the standalone repository's `main`
  branch. Neither updater has a network control endpoint.

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

The Core installer resolves `latest` by default, downloads only HTTPS GitHub
release assets, validates the matching SHA-256 entry in `checksums.txt`, and
rejects archive contents other than the expected files. The outbound Agent
installer uses a shallow checkout of the standalone repository and builds the
agent locally so its enrollment identity is created on the host; its automatic
updater is restricted to that repository's `main` branch. The GitHub repository
and immutable release tag remain the trust root. Release checksums detect
transfer corruption or an incomplete download but are not an independently
signed provenance statement.

## Install Core on the controller and data host

Run the release installer as root on a fresh Linux controller. Keep
`pipefail` enabled so a failed download cannot turn into an empty successful
shell pipeline:

```bash
set -o pipefail
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh | sudo bash
```

For unattended installation:

```bash
set -o pipefail
curl --fail --silent --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-core.sh \
  | sudo bash -s -- \
      --listen-ip <literal-server-ip> \
      --allow-cidr <operator-device-ip>/32 \
      --generate-admin-password
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

For the supported production flow, generate an enrollment command in
**Infrastructure → Agents** and run it with `sudo` on Ubuntu. An install-first
host can omit the one-time code and print a short-lived approval code instead:

```bash
set -o pipefail
curl --fail --silent --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh \
  | sudo bash -s -- --core https://core.example.com --core-fingerprint 'SHA256:<64-hex>' --enrollment-code '<one-time-code>' --defer-docker
```

The console supplies Core's exact TLS leaf fingerprint in the generated command.
The installer clones or fast-forwards the standalone SwarmOps repository,
builds the agent locally, creates an owner-only private identity, verifies that Core pin,
and starts outbound mutual-TLS polling. It never prints the private key or
requires an inbound agent port. The agent burns a one-time enrollment grant
after successful certificate issuance. Legacy macOS and direct-listener
installations remain available with paired TLS file arguments, but are not the
production outbound path.

The default installation does not change Docker or Swarm. After the agent has
been enrolled, **Infrastructure → Readiness** can approve the fixed
Debian/Ubuntu Docker setup,
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
Docker and Swarm operations during that state. The fixed local updater can
supervise the agent independently of Docker startup.

## Updater behavior

Core's Warden checks GitHub releases every 12 hours after an initial 15-minute
delay:

```bash
sudo systemctl start swarmops-core-warden.service
```

For a Core update, Warden downloads and checksum-verifies the candidate before it
stops the local service. It atomically changes only the `current` symlink in
the release directory, starts the fixed service, and waits for the local
`/readyz` probe. A failed candidate is
stopped, the previous symlink is restored, the previous service is started and
checked, and the failed candidate directory is removed. A successful update
keeps the current release plus the two most recent prior known-good release
directories. It never deletes `/var/lib/swarmops`, `/etc/swarmops`, the agent
API key, or TLS material.

The outbound Agent's six-hour timer fast-forwards only the trusted standalone
checkout, rebuilds the agent with protected caches, and atomically replaces
the binary before restarting the service. Core can request that fixed local
check, but cannot supply a repository, branch, executable, or shell command.
When automatic updates were disabled at installation, that Core request
returns an explicit conflict and leaves the healthy connection state intact.

## Publishing a release

Creating and pushing a new immutable tag that matches `v*` is the only event
that triggers `.github/workflows/release.yml`. The action runs Go,
documentation, deployment-asset, and embedded-console checks; builds every
supported native bundle; then creates (or updates) the matching GitHub Release.
It does not run for branch pushes or manually dispatched workflows, and it
skips moved or deleted tags.
