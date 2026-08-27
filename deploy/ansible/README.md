# Ansible host and Swarm bootstrap

This directory automates the part of a new environment that belongs on the
servers: Docker Engine installation, three-manager Swarm formation, the
encrypted traefik overlay, and placement labels. It deliberately does not
build or push images, deploy a stack, create a secret, modify DNS, or open a
firewall. Those operations have different credentials and rollback boundaries.

Git-managed files plus this repository's Makefile remain the deployment source of truth;
SwarmOps is the audited operator console for the resulting Swarm services.

## Preconditions

- Three supported Linux VMs: Debian or Ubuntu, each with Python 3, SSH access,
  and an existing sudo-capable user.
- A private, node-to-node network that permits TCP 2377, TCP/UDP 7946, and
  UDP 4789. Expose only TCP 80 and 443 publicly once Traefik is deployed;
  the SwarmOps node agent, Traefik metrics, Prometheus, Jaeger, and the isolated
  Fluentd Forward/query routes remain internal.
- A reviewed firewall/security-group configuration. This playbook does not
  invent cloud firewall policy because an incorrect private CIDR can cut off
  SSH or Swarm quorum.
- Local Ansible and an SSH key accepted by the user in ansible_user.

Use a baseline cloud image or provider bootstrap to establish SSH, sudo,
private networking, and firewall access first. Do not use this playbook to
replace a running Docker installation unless docker_remove_conflicting_packages
has been deliberately approved.

Every user in docker_users receives Docker socket access, which is effectively
root-equivalent on that host. Keep the list limited to trusted operators.

## Create the local inventory

~~~bash
cp deploy/ansible/inventory.example.yml deploy/ansible/inventory.yml
~~~

Set ansible_host to each server's administrative address and
swarm_advertise_addr to its private Swarm address. Keep
swarm_primary_manager as the inventory name of the first manager. The real
inventory is ignored by Git so server details and SSH settings remain local.

manager-01 receives the swarmops.edge, swarmops.control, and swarmops.stateful labels in the
example. Change that placement intentionally if a different node will hold
Traefik, SwarmOps, and their local volumes.

## One Bash command from three server addresses

The wrapper creates the ignored inventory and Docker-context files itself, then
runs the Ansible bootstrap. Supply private Swarm addresses whenever the servers
have them; the SSH addresses are used only as a fallback.

~~~bash
bash scripts/setup-three-managers.sh \
  --ssh-user root \
  --manager-01 203.0.113.11 \
  --manager-02 203.0.113.12 \
  --manager-03 203.0.113.13 \
  --advertise-01 10.0.0.11 \
  --advertise-02 10.0.0.12 \
  --advertise-03 10.0.0.13 \
  --password-auth \
  --apply
~~~

Do not put a password in an argument, environment variable, inventory, or
host file. With password authentication, Ansible prompts at the terminal and
the wrapper does not save the answer. This local machine needs sshpass for
Ansible password authentication; add --install-password-helper to explicitly
install it through Homebrew. A non-root user gets a separate sudo prompt by
default; use --no-sudo-password only when sudo truly needs no password.
Docker may prompt for the server password again later when a platform secret or
stack is sent through its SSH context; GHCR login is also intentionally
interactive.

Run the same command without --apply first to print a no-change plan. Existing
ignored files are protected from replacement; add --overwrite only after
reviewing their current contents.

To include the control plane in the same run, add the explicit platform inputs.
Every path below is a permission-restricted local file outside the repository;
the wrapper checks only that it exists and creates versioned Swarm secrets on
the primary manager. It never reads a value into an inventory or host file.

~~~bash
  --platform \
  --traefik-email ops@example.invalid \
  --swarmops-host swarmops.example.invalid \
  --traefik-dashboard-host traefik.example.invalid \
  --traefik-token-file /secure/traefik-cf-dns-token \
  --traefik-dashboard-auth-file /secure/traefik-dashboard.htpasswd \
  --swarmops-admin-password-hash-file /secure/swarmops-admin.bcrypt \
  --swarmops-session-key-file /secure/swarmops-session-key \
  --swarmops-agent-token-file /secure/swarmops-agent-token \
  --swarmops-registry-config-file /secure/swarmops-registry-config.json
~~~

Build and push the immutable SwarmOps images before this phase.
The SwarmOps and Traefik dashboard hostnames must resolve to the Traefik edge
before certificate issuance can succeed. The wrapper can also release a
specific SwarmOps stack, for example `--release swarmops`. It invokes Docker's
interactive GHCR login only when an image build is needed and never deploys
more than the selected stack.

## Validate, then apply

From the repository root, the default command only checks inventory shape, SSH
and Python reachability, playbook syntax, and Ansible check mode:

~~~bash
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml
~~~

After reviewing that result and the network/firewall prerequisites, apply the
same plan:

~~~bash
bash scripts/bootstrap-swarm.sh --inventory deploy/ansible/inventory.yml --apply
~~~

The playbook installs Docker from Docker's official APT repository and joins
the non-primary hosts as **managers**. It does not log the short-lived join
token. Re-running it is safe: installed packages, an active Swarm, the overlay
network, and matching labels are left in place.

If a distribution-provided Docker or container runtime is already installed,
the playbook stops rather than removing it. Set
docker_remove_conflicting_packages: true in the local inventory only after
confirming that its workloads and local data can be removed or migrated.

## Deploy the control plane after bootstrap

Ansible intentionally stops at a ready Swarm. Continue with the existing
Git-and-Make deployment path:

~~~bash
cp deploy/hosts/example.env deploy/hosts/manager-01.env
# Fill SSH_TARGET, DOCKER_CONTEXT, TRAEFIK_ACME_EMAIL, SWARMOPS_HOST,
# TRAEFIK_DASHBOARD_HOST, and TRAEFIK_DASHBOARD_URL.

make context HOST=manager-01
make secret-create HOST=manager-01 \
  SECRET=traefik_cf_dns_token_v1 FILE=/secure/traefik-cf-dns-token
make secret-create HOST=manager-01 \
  SECRET=traefik_dashboard_auth_v1 FILE=/secure/traefik-dashboard.htpasswd
make secret-create HOST=manager-01 \
  SECRET=swarmops_admin_password_hash_v1 FILE=/secure/swarmops-admin.bcrypt
make secret-create HOST=manager-01 \
  SECRET=swarmops_session_key_v1 FILE=/secure/swarmops-session-key
make secret-create HOST=manager-01 \
  SECRET=swarmops_agent_token_v1 FILE=/secure/swarmops-agent-token
make secret-create HOST=manager-01 \
  SECRET=swarmops_registry_config_v1 FILE=/secure/swarmops-registry-config.json
make push TAG=<git-sha>
make stack-check STACK=traefik TAG=<git-sha>
make stack-check STACK=swarmops TAG=<git-sha>
make platform-deploy HOST=manager-01 TAG=<git-sha>
~~~

platform-deploy installs Traefik first and then the committed SwarmOps stack.
That stack deploys one read-only inventory agent per Linux node and one API on
the node labelled swarmops.control=true, behind Traefik HTTPS. The initial SwarmOps
operator password is a bcrypt hash secret, never a first-run browser setup;
the session key and agent token are separate secrets.

## Validation boundary

After an apply, verify manager membership with docker node ls on the primary
manager. After platform-deploy, use make ps HOST=manager-01 STACK=traefik,
make ps HOST=manager-01 STACK=swarmops, and an authenticated browser check of
the configured SwarmOps hostname. Then deliberately deploy the optional core
observability stack and verify the internal Prometheus targets, Jaeger storage,
and SwarmOps' own graphs and metrics. Ansible syntax and check-mode success do
not prove firewall reachability, DNS propagation, ACME issuance, SwarmOps
login, or agent reachability.
