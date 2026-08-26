# Native release installation and updates

SwarmOps releases contain exactly three native programs:

- `swarmops-core` is the Docker-free control-plane API, embedded console, and
  reviewed deployment-assets process. Its encrypted state remains outside a
  release at `/var/lib/swarmops`.
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
Docker-group membership.

## Install Agent on a host

On Linux, download the release installer and run it with `sudo`. On macOS, run
it as the logged-in user without `sudo`:

```bash
curl --fail --location --remote-name \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh
# Linux:
sudo bash install-swarmops-agent.sh
# macOS:
bash install-swarmops-agent.sh
```

The agent installer defaults to `0.0.0.0:9180` and creates a P-256,
self-signed certificate and owner-only key itself. Their SwarmOps-owned paths
are `/etc/swarmops-agent/tls/agent.crt` and
`/etc/swarmops-agent/tls/agent.key` on Linux, or
`$HOME/.config/swarmops-agent/tls/agent.crt` and
`$HOME/.config/swarmops-agent/tls/agent.key` on macOS. The controller pins the
exact leaf certificate, so no external CA or operator-supplied certificate is
required. The installer prints the TLS fingerprint, port, certificate path,
and protected API-key file path—never the API key. In the Core console, add a
server with the HTTPS origin (without its port), port, fingerprint, and API key
through an approved secure channel. The listener must remain reachable only
from the controller through an explicit firewall rule. Advanced operators may
provide a certificate only with the paired `--tls-cert-file` and
`--tls-key-file` flags.

The agent service starts without a Docker CLI or live Docker socket. It reports
the host as connected but Docker-unavailable until Docker starts; Core blocks
Docker and Swarm operations during that state. This lets Warden supervise the
host agent and its pinned TLS health endpoint independently of Docker startup.

## Immediate upgrade and Agent key rotation

Installed hosts expose fixed local commands rather than accepting update
instructions from Core or a browser:

```bash
# Linux Agent host
sudo swarmops-agent upgrade
sudo swarmops-agent gen key

# Linux Core host
sudo swarmops-core upgrade
```

`upgrade` starts the matching local Warden service. Warden is the only process
that knows the fixed GitHub Release repository, verifies the checksum, switches
the `current` release symlink, health-checks the candidate, and rolls back a
failed update. The commands do not accept a repository, URL, branch, command,
or binary argument.

`swarmops-agent gen key` atomically replaces the existing protected machine API
key and restarts the Agent. If the restart fails, it restores the prior key and
attempts recovery. It prints the replacement key only after a successful
restart. Paste that value into **Servers → Reconnect**; the Core intentionally
does not persist machine API keys.

An older installed Agent has no `upgrade` command. Run the same one-line
bootstrap command once; it detects the native installation, downloads the
checksum-verified current release, preserves the API key/TLS/listener/service
configuration, switches the release, and restarts the local services:

```bash
curl -fsSL https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh | sudo bash
```

## Warden behavior

Linux timers check every 12 hours after an initial 15-minute delay:

```bash
sudo systemctl start swarmops-core-warden.service
sudo systemctl start swarmops-agent-warden.service
```

Only run the unit installed for that component. The CLI commands above are the
preferred manual path. On macOS, the agent updater is
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
