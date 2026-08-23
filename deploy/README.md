# Deploying SwarmOps

This directory contains the checked, operator-run Docker Swarm deployment
assets for SwarmOps. It is intentionally self-contained: source is built
locally, immutable images are pushed to a registry, and managers pull those
images when a reviewed stack is deployed.

```text
local source -> make build/push -> registry -> Docker Swarm -> Traefik HTTPS
```

SwarmOps is a high-trust control plane. It observes node and service state,
deploys a constrained image-only Compose stack, and performs bounded service
operations. It does not accept arbitrary Docker commands. Keep browser
mutations and local image builds disabled until the cluster is verified.

## Topology and network prerequisites

Use three manager nodes when production quorum is required. The example labels
place the singleton edge, API, and durable observability services on
`manager-01`; move those labels only after planning shared storage and recovery.

| Placement label | Purpose |
| --- | --- |
| `swarmops.edge=true` | Traefik edge proxy |
| `swarmops.control=true` | SwarmOps API |
| `swarmops.stateful=true` | Grafana, Prometheus, Jaeger, and Loki volumes |

Permit private node-to-node traffic on TCP 2377, TCP/UDP 7946, and UDP 4789.
Expose only TCP 80 and 443 publicly through Traefik. Do not publicly expose
the Docker socket, Swarm ports, node agent, Traefik metrics, Prometheus,
Jaeger, Loki, or Alloy.

## Bootstrap the managers

The Ansible playbook installs Docker, forms a three-manager Swarm, creates the
encrypted `traefik` overlay, and applies the labels above. It does not create
secrets, alter DNS/firewalls, push images, or deploy stacks.

```bash
cp deploy/ansible/inventory.example.yml deploy/ansible/inventory.yml
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml --apply
```

See [ansible/README.md](ansible/README.md) for the interactive password-safe
bootstrap wrapper and its complete prerequisites.

For the manual equivalent, create ignored host connection files, initialize the
first manager with its private address, join the other managers, then create
the overlay and placement labels:

```bash
cp deploy/hosts/example.env deploy/hosts/manager-01.env
make context HOST=manager-01
make swarm-init HOST=manager-01 ADVERTISE_ADDR=10.0.0.11
# Run the short-lived join command printed by Docker on manager-02 and manager-03.
make swarm-network HOST=manager-01
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=swarmops.edge VALUE=true
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=swarmops.control VALUE=true
make swarm-label HOST=manager-01 NODE=manager-01 LABEL=swarmops.stateful VALUE=true
```

Never commit real `deploy/hosts/*.env` files, inventories, join tokens, or
SSH credentials. They are deliberately ignored by Git.

## Create runtime secrets

Create every secret from a permission-restricted local file outside this
repository. Swarm secrets are immutable: rotate by creating a new versioned
name, updating the local host file, deploying the affected stack, verifying
tasks, and only then deleting the old name.

```bash
make secret-create HOST=manager-01 SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 SECRET=traefik_dashboard_auth_v1 FILE=/secure/traefik-dashboard.htpasswd
make secret-create HOST=manager-01 SECRET=swarmops_admin_password_hash_v1 FILE=/secure/swarmops-admin.bcrypt
make secret-create HOST=manager-01 SECRET=swarmops_session_key_v1 FILE=/secure/swarmops-session-key
make secret-create HOST=manager-01 SECRET=swarmops_agent_token_v1 FILE=/secure/swarmops-agent-token
make secret-create HOST=manager-01 SECRET=swarmops_registry_config_v1 FILE=/secure/swarmops-registry-config.json
make secret-create HOST=manager-01 SECRET=swarmops_grafana_admin_password_v1 FILE=/secure/grafana-admin-password
```

The registry configuration is optional only when every deployed workload uses
public images. Never put registry credentials, tokens, password hashes, or
session keys in a stack file, image layer, build argument, or host env file.

## Build, validate, and deploy

Set an immutable tag, authenticate to the registry interactively, then build
and push the API, agent, and CLI images. Docker never builds on a server.

```bash
make test
make web-build
make registry-login
make push TAG=<immutable-tag>

make stack-check STACK=traefik TAG=<immutable-tag>
make stack-check STACK=swarmops TAG=<immutable-tag>
make platform-deploy HOST=manager-01 TAG=<immutable-tag>
```

`platform-deploy` deploys Traefik first and then SwarmOps. It refuses a dirty
source tree and does not create secrets, change DNS, or open firewalls.

The optional observability and log stacks have their own lifecycle. Enable
them only after checking capacity, retention, and backup/recovery needs:

```bash
make stack-check STACK=swarmops-observability TAG=<immutable-tag>
make deploy STACK=swarmops-observability HOST=manager-01 TAG=<immutable-tag>

make stack-check STACK=swarmops-logs TAG=<immutable-tag>
make deploy STACK=swarmops-logs HOST=manager-01 TAG=<immutable-tag>
```

## Host settings and certificate issuance

Copy [hosts/example.env](hosts/example.env) to an ignored per-manager file and
set non-secret values such as `TRAEFIK_ACME_EMAIL`,
`SWARMOPS_HOST`, `GRAFANA_HOST`, `TRAEFIK_DASHBOARD_HOST`, and
`TRAEFIK_DASHBOARD_URL`. The committed hostnames use `.example.invalid` and
cannot accidentally target a live domain. Before deploying Traefik, make the
real hostnames resolve to the edge and ensure the selected ACME DNS provider
and its Swarm secret are correct.

## Verification boundary

After deployment, verify manager quorum, task placement, HTTPS certificate
issuance, login with the separately-created operator credential, node agent
reachability, Traefik metrics, Grafana authentication, Prometheus targets,
and Jaeger/Loki retention. Stack rendering and local tests do not prove DNS,
firewall reachability, certificate issuance, registry access, or authenticated
production behavior.
