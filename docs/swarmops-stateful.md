# SwarmOps stateful workloads and recovery

**Status:** checked-in deployment contracts only. No database, backup, restore,
or failover has been run against a live cluster by this repository change.

SwarmOps also ships three single-instance managed databases —
`deploy/stacks/swarmops-postgres.yml`, `swarmops-mongo.yml`, and
`swarmops-redis.yml` — that the console can deploy directly. They are the same
kind of artefact as everything below: reviewed Git manifests rendered on the
controller, never browser-authored Compose. The console chooses only whether
one runs, their generated passwords are Swarm secrets, and removal needs the
exact `REMOVE_DATABASE_<ENGINE>` confirmation. They are single-replica and have
no tested backup or failover path; the replicated manifests below remain the
reference for anything that needs one. See
[ADR-0004](adr/ADR-0004-swarmops-enrollment-and-managed-databases.md).

`deploy/stacks/mongo-replicaset.yml` and
`deploy/stacks/postgres-primary-replica.yml` are reviewed Git manifests, not
browser Compose templates. Their local volumes are intentionally pinned to
unique labelled nodes. A node reconnect or service restart therefore returns a
task to the same local data; it must not silently reschedule onto another node
with an empty volume.

## Capacity and node layout

The small three-manager reference topology is not automatically a database
platform. Add measured capacity first, enroll a fresh Ubuntu agent, then use
typed Docker install, Swarm join, role, and label operations against that
explicit node. The agent refuses an unknown conflicting runtime, joins using
the reviewed private advertised address, and leaves an already-active different
Swarm untouched.

| Profile | Required distinct slots | What a second node enables |
| --- | --- | --- |
| PostgreSQL primary/replica | `nim.postgres.slot=primary` and `nim.postgres.slot=replica` on two different `nim.postgres=true` nodes | A primary/streaming-replica pair once one durable primary node and the second replica node have measured capacity. It is not automatic failover. |
| MongoDB replica set | `nim.mongo.slot=1`, `2`, and `3` on three different `nim.mongo=true` nodes | A second Mongo node is not enough for the checked-in three-member set; add a third distinct durable node before deployment. |

Refresh the non-secret platform manifest with the actual hostnames, capacity,
labels, namespace, domains, and reservation budget. The live admission check
fails closed if any declared node, slot label, memory/disk fact, or agent
snapshot is missing.

## Deploying a reviewed stateful stack

Use an immutable image tag and a checked-in stack, after the platform plan is
valid both locally and against the selected remote manager:

```bash
make swarmops-preflight MANIFEST=deploy/swarmops/platform.example.yml
make swarmops-checked-deploy \
  MANIFEST=deploy/swarmops/platform.example.yml \
  SWARMOPS_URL=https://swarmops.example.com \
  SWARMOPS_USERNAME=operator \
  SWARMOPS_SERVER_ID=<connected-manager-id> \
  STACK=postgres-primary-replica HOST=manager-01 TAG=<immutable-tag>
```

For Mongo, replace the stack name with `mongo-replicaset`. Before either
deployment, create the required versioned Swarm secrets from protected files:

| Stack | Required secret names (defaults) |
| --- | --- |
| MongoDB | `mongo_root_username_v1`, `mongo_root_password_v1`, `mongo_keyfile_v1` |
| PostgreSQL | `postgres_primary_password_v1`, `postgres_replication_password_v1` |

Only `mongo-1` performs Mongo's first-volume root-account bootstrap; the
other members receive just the replica-set keyfile and synchronize the admin
database from the initialized set. The Mongo initializer authenticates with
the root-account secrets and invokes `rs.initiate` only while the replica set
is uninitialized. PostgreSQL creates the replication account only when the
primary data directory is first
initialized; the replica seeds itself with `pg_basebackup` and then follows the
primary. Changing a database credential after initialization is a database
change, not just a Swarm-secret rotation: use that database's documented
credential rotation procedure before pointing a service at a new secret.

Neither stack publishes a host port. Give client workloads an explicit internal
overlay-network path and an application-specific credential, rather than
opening a database to the public edge.

## Reconnect and recovery protocol

After a node reboot, transient network loss, or operator reconnect, run the
node's catalogued read-only continuity diagnostic first.

It checks that Docker is active, Swarm membership is still active, the local
named-volume root exists, optional Restic timer state is visible, and the
primary manager can still list nodes. The check fails if an approved expected
volume disappeared without reading its data. It does **not** restore data,
contact S3, read backup credentials, delete
a volume, promote PostgreSQL, or reinitialize MongoDB.

Then inspect task placement from the control manager. A stateful task that is
pending because its labelled host is absent is safer than starting on an
unlabelled node with an empty local volume. Do not delete the named volume or
move its slot label during incident response. For a permanently lost node,
first choose a known-good, application-consistent backup, explicitly restore
into an empty replacement volume, validate the recovered database, and only
then move the slot label and converge the corresponding service.

The optional host-volume Restic timer protects the local volume files only. It
does not prove a transaction-consistent MongoDB or PostgreSQL recovery. Keep a
tested logical/physical database backup and restore procedure before calling a
stateful workload production-ready.
