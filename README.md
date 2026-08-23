# SwarmOps

> A production-minded, manager-scoped Docker Swarm control plane for
> [nim.zone](https://nim.zone), maintained by Nima Sarayan.

SwarmOps is an open-source replacement path for Portainer on Docker Swarm. It
combines an auditable Go API, a React console, a read-only node agent, a
trusted-workstation build CLI, an Ansible bootstrap, and optional
Grafana/Prometheus/Jaeger/Loki observability stacks.

It does **not** make Docker's root-equivalent socket harmless. SwarmOps narrows
that access to reviewed, fixed-shape operations instead of forwarding arbitrary
Docker commands from a browser.

## Capabilities

| Area | Capability | Safety boundary |
| --- | --- | --- |
| Nodes | Docker role/state/availability, labels, task placement, and OS/kernel/Docker/cgroup/storage/CPU/memory/disk/uptime/load inventory | The global agent is read-only and token-authenticated on an internal overlay. |
| Stacks | Validate and deploy image-only Compose v3.9 stacks; optionally pin services to a selected node | No builds, host binds, direct ports, inline secret-like environment variables, or missing resource limits. |
| Services | Read a bounded service-log tail; restart, rollback, or scale with fixed Docker command shapes | Mutations are off by default and each request has CSRF protection and an audit record. |
| Images | Build a tarred local context with CPU/RAM caps and immutable image tags; optionally push | The browser accepts a tar archive only; `swarmopsctl` never exposes a manager filesystem path. |
| Edge / TLS | Reconcile the checked-in Traefik stack, protected dashboard, internal metrics, and ACME DNS challenge | Provider tokens and dashboard credentials remain external Swarm secrets. |
| Observability | One Grafana + Prometheus + Jaeger core; optionally collect Docker JSON logs to Loki | Deploying/removing the core or log collector requires explicit confirmation. |
| Provisioning | Ansible-guided Docker and three-manager Swarm bootstrap | Password-based SSH is prompted by Ansible on the trusted workstation, never sent through the web app. |

## Open-source release scope

This repository intentionally contains no production credentials, host
inventory, ACME state, Docker registry configuration, database dumps, or
service logs. Host files and Ansible inventories are ignored by Git; use the
tracked templates only as starting points.

The Apache-2.0 `NOTICE` file preserves attribution to Nima Sarayan when the
project or a derivative is redistributed. See [LICENSE](LICENSE),
[NOTICE](NOTICE), and [SECURITY.md](SECURITY.md).

## Architecture

```text
operator browser ── HTTPS / Traefik ──> SwarmOps API (manager + Docker socket)
                                           │
                    internal swarmops ─────┼────> global node agent (per node)
                                           │
                                           ├────> Grafana / Prometheus / Jaeger
                                           └────> on-demand Docker CLI actions

trusted workstation ─ swarmopsctl tar stream ─> API build endpoint ─> Docker Engine
```

- `cmd/api` serves the React build and authenticated API on port `8084`.
- `cmd/agent` serves node snapshots on port `9180`; the stack does not
  publish that port.
- `cmd/swarmopsctl` runs on the operator workstation and turns a local build
  directory into a filtered tar stream.
- `internal/ops` is the narrow mutation boundary: Compose policy, Docker CLI
  command shapes, selected-node placement, and audit calls live there.
- `web/vendor/nim-ui/` contains the Apache-2.0 UI kit used by the console, so the
  repository builds independently of any other repository.

## Local development

Prerequisites: Go 1.26+, Node 24+, npm, `htpasswd`, and `openssl`. Run the
API and Vite server in separate terminals.

```bash
# htpasswd prompts for the local-only password and prints only its bcrypt hash.
export SWARMOPS_DEV_PASSWORD_HASH="$(htpasswd -nBC 12 operator | cut -d: -f2)"
export SWARMOPS_DEV_SESSION_KEY="$(openssl rand -hex 32)"
export SWARMOPS_DEV_AGENT_TOKEN="$(openssl rand -hex 32)"

SWARMOPS_INSECURE_DEV_AUTH=true SWARMOPS_SECURE_COOKIES=false \
  SWARMOPS_DEV_PASSWORD_HASH="$SWARMOPS_DEV_PASSWORD_HASH" \
  SWARMOPS_DEV_SESSION_KEY="$SWARMOPS_DEV_SESSION_KEY" \
  SWARMOPS_DEV_AGENT_TOKEN="$SWARMOPS_DEV_AGENT_TOKEN" \
  SWARMOPS_DATA_DIR=/tmp/swarmops-dev go run ./cmd/api
```

```bash
cd web
npm ci
npm run dev
```

`SWARMOPS_INSECURE_DEV_AUTH` is for local development only. It requires the
explicit local bcrypt hash, session key, and agent token above and must never
be set in a host environment file or Swarm service. The development username
defaults to `operator`; the password is the one you chose at the prompt.

## Verification

```bash
make test
make web-build
make stack-check STACK=traefik TAG=local
make stack-check STACK=swarmops TAG=local
make stack-check STACK=swarmops-observability TAG=local
make stack-check STACK=swarmops-logs TAG=local
ansible-playbook --syntax-check -i deploy/ansible/inventory.example.yml deploy/ansible/site.yml
make docs-check
```

These checks validate local source and configuration only. They do not prove
DNS, ACME, Docker Swarm placement, registry access, login, or recovery in a
live environment.

## Build and deploy

Build immutable images locally, then push them to a registry you control:

```bash
make build TARGET=api TAG=<immutable-tag>
make build TARGET=agent TAG=<immutable-tag>
make build TARGET=cli TAG=<immutable-tag>
make registry-login
make push TARGET=api TAG=<immutable-tag>
make push TARGET=agent TAG=<immutable-tag>
```

Create a local host file from the tracked example. It is ignored by Git:

```bash
cp deploy/hosts/example.env deploy/hosts/manager-01.env
make context HOST=manager-01
```

Create versioned Swarm secrets from permission-restricted files **outside** this
repository, then validate and deploy Traefik before SwarmOps:

```bash
make secret-create HOST=manager-01 SECRET=swarmops_admin_password_hash_v1 FILE=/secure/swarmops-admin.bcrypt
make secret-create HOST=manager-01 SECRET=swarmops_session_key_v1 FILE=/secure/swarmops-session-key
make secret-create HOST=manager-01 SECRET=swarmops_agent_token_v1 FILE=/secure/swarmops-agent-token
make secret-create HOST=manager-01 SECRET=swarmops_registry_config_v1 FILE=/secure/swarmops-registry-config.json
make secret-create HOST=manager-01 SECRET=swarmops_grafana_admin_password_v1 FILE=/secure/grafana-admin-password
make stack-check STACK=traefik TAG=<immutable-tag>
make stack-check STACK=swarmops TAG=<immutable-tag>
make platform-deploy HOST=manager-01 TAG=<immutable-tag>
```

For a fresh cluster, use:

```bash
make swarmops-provision
```

The provisioning workflow forms the Swarm and prepares hosts. It does not
replace the secret-creation, image-push, DNS, firewall, or live-validation
steps. See [deploy/README.md](deploy/README.md) and
[deploy/ansible/README.md](deploy/ansible/README.md).

## Decision artifacts

- [System design](docs/SwarmOps-System-Design.docx)
- [Business review](docs/SwarmOps-Business-Review.pptx)
- [Operating review](docs/SwarmOps-Operating-Review.pptx)

## Important limitations

- The API is intentionally manager-scoped and single-replica because its audit
  volume and Docker socket are local. HA requires a separate shared-state
  design.
- The global agent and optional log collector mount high-trust host paths
  read-only. Treat their deployment as an explicit operator decision.
- Do not operate Portainer and SwarmOps as independent mutation control planes
  after you adopt SwarmOps. Keep Git and the project Makefile as the deployment
  source of truth.

## License and attribution

Copyright 2026 Nima Sarayan. SwarmOps is licensed under Apache-2.0.
Redistributions and derivative works must retain the applicable attribution in
[NOTICE](NOTICE), as required by Apache-2.0 section 4(d).
