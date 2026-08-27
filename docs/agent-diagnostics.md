# Native agent diagnostics and automatic updates

## Purpose

The control plane must distinguish a cached connection from a live, usable
machine agent. A server is not eligible for Swarm operations merely because a
previous HTTP client is still held in memory.

Core probes every saved native agent while it is active. Each probe is bounded
and sequential, and verifies the authenticated status endpoint, the fixed
Docker facade, and the agent diagnostics endpoint. The result is saved with
the server profile so the console can still explain the last known failure
when the machine no longer responds.

## Safe evidence contract

`GET /api/v1/servers/{id}/diagnostics` returns the last safe health record and
attempts a fresh probe when Core is active. It retains only:

- agent version, protocol version, uptime, probe times, and update status;
- a bounded event vocabulary from Core and the native agent; and
- one reviewed summary and operator action for each failure class.

It never returns service logs, Docker output, command output, response bodies,
credentials, source content, or arbitrary host files. Those may contain
secrets and remain on the relevant trusted host.

The console renders these states:

| State | Meaning | Operator action |
| --- | --- | --- |
| Healthy | Authenticated agent, fixed Docker facade, and diagnostics route responded. | Select the server for Swarm work. |
| Degraded: agent update required | The pinned machine responded but one required fixed route returned `404`. | Run the current installer once. Future checks can then be automatic. |
| Degraded: Docker unavailable | The agent responded but cannot use its local Docker Engine. | Repair Docker or use Server readiness. |
| Unhealthy: machine API unreachable | Core cannot reach, authenticate, or verify the pinned machine API. | Check agent service, port, TLS pin, routing, and firewall. |

A degraded or unhealthy server is never silently selected as a manager for a
cluster operation.

## Update model

The native installer enables automatic updates only for its reviewed
`https://github.com/nimasrn/SwarmOps.git` `main` source. It installs a local
systemd timer/path unit on Linux or a LaunchAgent on macOS:

1. The host checks on its own every six hours, even if Core is unavailable.
2. When Core can reach a current agent, `POST /api/v1/servers/{id}/agent-update`
   asks the agent to create a fixed local marker.
3. The local updater verifies its own configured remote, fast-forwards its
   installer-owned checkout, builds the agent locally using its own protected
   build cache, atomically replaces the binary, writes a small status record,
   and restarts the agent.

The Core request has no body and cannot select a source, branch, commit,
binary, shell command, or restart target. The updater defers while a native
agent mutation is active. `--no-auto-update` disables and removes the installed
update triggers. A custom source or branch cannot become an unattended update
source.

## Rollout boundary

Agents installed before this protocol need one reviewed installer run before
they can expose safe diagnostics or accept an update request. The console
labels this explicitly as **Agent update required** rather than reporting the
old cached connection as healthy. No local test proves that a remote host has
actually installed the newer binary; verify that separately through its next
authenticated probe.

Generate the one-time enrollment command in **Infrastructure → Agents**, or
use the install-first form and approve the printed code within 15 minutes:

```sh
set -o pipefail
curl --fail --silent --show-error --location \
  https://github.com/nimasrn/SwarmOps/releases/latest/download/install-swarmops-agent.sh \
  | sudo bash -s -- --core https://core.example.com --defer-docker
```
