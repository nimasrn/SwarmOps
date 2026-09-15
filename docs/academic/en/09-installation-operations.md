---
title: "SwarmOps Cloud"
subtitle: "Installation and Operations Guide"
author: "Nima Sarayan"
date: "September 2026"
abstract: |
  This guide tells a developer how to run SwarmOps Cloud locally and tells an operator how to install it, upgrade an existing SwarmOps installation to the relational database, back it up, restore it, and keep it healthy. Commands are given exactly as they are used in the repository. Where a step was not exercised in the verification environment — a production installation on Ubuntu, in particular — the guide says so.
---

# Components and prerequisites

| Component | Purpose | Version used in verification |
|---|---|---|
| SwarmOps Core (`cmd/api`) | Server: APIs, storefront, console, command worker, billing | Built from the branch with Go 1.26.6 |
| Machine agent (`cmd/agent`) | Performs Docker and Swarm operations on each node | Same source, stamped `v0.22.0` |
| MariaDB or MySQL | Controller database | MariaDB 11.4.13, MySQL 8.4.11 |
| Docker Engine in Swarm mode | Runs the gateway and customer applications | Docker 29.4.0, single node |
| Node.js and npm | Builds the web applications | Node.js 26.5.0 |
| Traefik | Gateway, installed by SwarmOps | v3.6.13 |

: Components

The database must be MariaDB 11.4 LTS or MySQL 8.4 LTS, or a later release of the same series. SwarmOps's own container images are built for `amd64`. On an `arm64` host, run Core and the agent as native binaries, as in the verification environment.

# Local development

## Database

```bash
make dev-db
```

This starts a MariaDB 11.4 container named `swarmops-mariadb` on `127.0.0.1:3307`, with root password `devroot`. It also creates the `swarmops` database with `utf8mb4`. Running it again restarts the existing container. To test against MySQL as well, start a second server, for example on port 3308:

```bash
docker run -d --name swarmops-mysql -e MYSQL_ROOT_PASSWORD=devroot -p 127.0.0.1:3308:3306 mysql:8.4
```

## Running everything

```bash
make local
```

`make local` prepares a loopback machine agent, starts Core with development authentication and connects it to the agent, and starts the Vite development server. Core listens on `127.0.0.1:8084` and the web server on `127.0.0.1:5284`. Development state lives under `$TMPDIR/swarmops-dev`; override this with `SWARMOPS_DEV_DIR`. The pieces can be run separately with `make dev-agent`, `make dev-api` and `make web-dev`.

Open the console at `http://127.0.0.1:5284/` and the storefront at `http://127.0.0.1:5284/store.html`.

## Development settings

| Variable | Meaning |
|---|---|
| `SWARMOPS_INSECURE_DEV_AUTH=true` | Enables development authentication. Never use in production. |
| `SWARMOPS_DEV_SESSION_KEY` | At least 32 bytes. The data-encryption key is derived from it, so keep it stable between restarts, or the database's secret columns become unreadable. |
| `SWARMOPS_DEV_PASSWORD_HASH` | Bcrypt hash of the development operator's password (user `SWARMOPS_ADMIN_USERNAME`, default `admin`). |
| `SWARMOPS_DEV_DATABASE_DSN` | Development DSN; defaults to `root:devroot@tcp(127.0.0.1:3307)/swarmops`. |
| `SWARMOPS_MUTATIONS_ENABLED=true` | Allows changes to servers and applications, including order confirmation. |
| `SWARMOPS_DEV_MACHINE_API_*` | Connection to the loopback machine agent (set by `make local`). |

: Development settings

Generate a password hash with, for example, `htpasswd -nbBC 10 admin 'your-password' | cut -d: -f2`.

## Tests

```bash
go vet ./...
SWARMOPS_TEST_DATABASE_DSN='root:devroot@tcp(127.0.0.1:3307)/' SWARMOPS_TEST_DATABASE_REQUIRED=1 go test ./...
SWARMOPS_TEST_DATABASE_DSN='root:devroot@tcp(127.0.0.1:3308)/' SWARMOPS_TEST_DATABASE_REQUIRED=1 go test ./...
npm --prefix web run typecheck
npm --prefix web test
npm --prefix web run build
make stack-check-all TAG=ci
make docs-check
```

Each database test creates and removes its own schema, named `swarmops_test_…`. Without `SWARMOPS_TEST_DATABASE_REQUIRED`, tests that cannot reach the database are skipped rather than failed.

# Building

```bash
npm --prefix web ci
npm --prefix web run build     # writes the storefront and console into internal/web/static
go build -o swarmops-core ./cmd/api
go build -ldflags "-X main.version=v0.22.0" -o swarmops-agent ./cmd/agent
```

The web build must run before `go build`, because Core embeds `internal/web/static`. Release bundles are produced by `scripts/build-release-bundles.sh`, which stamps the version.

# Production installation

> The steps in this chapter follow the repository's installer and stack definitions. They were checked by rendering the stacks and syntax-checking the scripts. They were **not** carried out on an Ubuntu server during this project (Test Plan and Report, section 8).

## Prepare the database

On the database server:

```sql
CREATE DATABASE swarmops CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'swarmops'@'10.0.0.%' IDENTIFIED BY 'a-long-random-password';
GRANT ALL PRIVILEGES ON swarmops.* TO 'swarmops'@'10.0.0.%';
```

Core applies migrations when it starts, so the account it uses needs the right to create and alter tables. For a stricter separation, run the first start, and every upgrade, with a schema-owning account. Afterwards, restrict the everyday account to `SELECT`, `INSERT`, `UPDATE` and `DELETE`.

## Write the DSN file

The DSN uses the Go MySQL driver's format:

```text
swarmops:a-long-random-password@tcp(db.internal:3306)/swarmops?tls=true
```

Core always adds `parseTime=true`, UTC as its time zone (`time_zone='+00:00'`), the `utf8mb4_unicode_ci` collation and a 10-second connection timeout, so these need not be written. Store the DSN in a file that is:

- a regular file, not a symbolic link;
- readable only by its owner: no permissions for group or others, for example mode `0400` or `0600`.

Core refuses to start otherwise. The same rules apply to the data-encryption key file, which holds exactly 32 bytes in standard base64.

## Install the control plane

Run the bootstrap script with the DSN file:

```bash
sudo bash scripts/bootstrap-swarmops-control-plane.sh --database-dsn-file /root/swarmops-database-dsn
```

The script refuses to continue without a readable, non-empty DSN file. It installs the file as `database-dsn` in Core's configuration directory, and writes `SWARMOPS_DATABASE_DSN_FILE` into Core's environment. When Core runs as a Swarm service (`deploy/stacks/swarmops.yml`), the DSN is supplied as the Swarm secret `swarmops_database_dsn`, and `scripts/run-swarmops-api.sh` requires the secret file to exist.

## Connect servers and install the gateway

1. Enroll each node with the install command from **Connect a server** in the console.
2. Label the manager that will carry the gateway with `nim.edge=true`. The prerequisite repair does this for a single manager.
3. In *Traffic › Gateway settings*, set the ACME contact email and the dashboard hostname. In *Traffic › Gateway*, fix the prerequisites and install the gateway (User Manual, *Preparing the platform*).

The gateway repair requires machine agent v0.9.3 or newer. Released agents carry their version. An agent built from source without `-ldflags "-X main.version=…"` reports `dev` and is refused (Test Plan and Report, defect D-6).

## Check readiness

```bash
curl -fsS https://core.example.com/readyz
```

`/readyz` answers `{"status":"ready"}` when the audit ledger and command storage — both in the database — are available, and 503 otherwise. Use it as the health check of any load balancer or supervisor in front of Core.

# Upgrading an existing SwarmOps installation

Versions of SwarmOps before this project kept their state in encrypted `.sealed` files in the data directory. To move that state into the database:

1. **Back up** the data directory, including `commands/`, and the data-encryption key.
2. **Stop Core.** Two processes must not write the same state.
3. **Configure** the DSN file as in section 4.2.
4. **Import**, with the same environment Core uses (the same data directory and key):

   ```bash
   swarmops-core migrate-state
   ```

   The command creates or upgrades the schema, then imports each store in its own transaction. It prints one line per store:

   ```text
   imported core topology members                1
   imported enrolled outbound agents             0
   imported server profiles and retained keys    1 profiles, 1 keys
   imported audit events                         1
   imported applications                         0
   imported database credentials                 0
   imported source connections                   0
   imported source settings                      0
   imported routing clusters                     0
   imported commands                             0
   controller database is at schema version 9; the sealed files in … are unchanged
   ```

   This output is from the upgrade test (Test Plan and Report, section 4.4). A store without a file imports nothing.
5. **Verify** the counts against what the old installation showed: servers, applications, audit entries and runs.
6. **Start Core.** It now reads and writes only the database.

The import leaves the `.sealed` files unchanged, and running it again creates no duplicates. To roll back, stop Core and start the previous version with its untouched data directory.

# Operations

## Background work

On the **active** controller only:

- the command worker polls for due commands every 250 ms and runs one at a time;
- billing runs every five minutes, charging elapsed hours and issuing the previous month's invoices.

A standby controller serves reads, refuses changes with 409, and does neither.

## Backup

```bash
mysqldump --single-transaction --routines --triggers \
  --host=db.internal --user=swarmops --password swarmops > swarmops-$(date -u +%Y%m%dT%H%MZ).sql
```

`--single-transaction` takes a consistent snapshot of the InnoDB tables without stopping Core. Keep each backup with a separately protected copy of the data-encryption key. Secrets in the backup cannot be read without the key, and the key is not in the database. Also back up the data directory's `commands/` folder if build artifacts must survive.

## Restore

1. Stop Core.
2. Create an empty database and load the dump: `mysql swarmops < swarmops-….sql`.
3. Start Core with the **same** data-encryption key. The migration runner checks the recorded checksums, applies any newer migrations and refuses a database newer than the binary.

## Monitoring

- **Logs.** Core writes structured JSON logs to standard output. A failed command is logged as `command execution failed`, with its id, action, server, target, attempt and cause.
- **Runs.** *Activity › Runs* in the console shows every command's steps, attempts and failure summary.
- **Audit.** The audit log records who did what: every administrator decision and customer purchase event.
- **Money.** Run the ledger check periodically; it must return no rows:

  ```sql
  SELECT w.user_id, w.balance_rial, COALESCE(SUM(t.amount_rial), 0) AS ledger_sum
  FROM wallets w LEFT JOIN wallet_transactions t ON t.user_id = w.user_id
  GROUP BY w.user_id, w.balance_rial
  HAVING w.balance_rial <> COALESCE(SUM(t.amount_rial), 0);
  ```

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| Core exits: *… must be readable only by its owner* | The DSN or key file permissions are too open. | `chmod 0400` the file. |
| Core exits after a migration checksum error | An applied migration file was modified. | Never edit an applied migration; add a new one. |
| Core refuses a database *newer than the controller* | A newer version migrated this database. | Run that version, or restore a backup taken before the upgrade. |
| Every deployment fails with `gateway_required` | The managed gateway is not installed. | Install it (section 4.4). |
| A deployment stays *provisioning* for minutes, then fails | The application's health check never passes; the queue is blocked meanwhile. | Check the image answers `GET /healthz` on its port and contains `wget` or `curl`. |
| Order confirmation answers *not connected to a Swarm manager* | The chosen server is offline or not a manager. | Reconnect the agent; check `docker info` on the node. |
| Changes answer 409 *standby* | This controller is not the active one. | Use the active controller, or promote this one. |
| Changes answer 403 *Remote mutations are disabled* | Mutations are switched off. | Enable mutations in Core's configuration. |
| `/readyz` answers 503 | The database is unreachable or not writable. | Check the database server and the DSN. |

: Troubleshooting

# Security checklist

- DSN and key files are regular files readable only by Core's user.
- The database is reachable only from the control host, over TLS (`tls=true` in the DSN).
- `SWARMOPS_INSECURE_DEV_AUTH` is not set in production, and secure cookies are enabled (HTTPS).
- The data-encryption key is backed up separately from the database backups.
- The console is reachable only by administrators, and the storefront through HTTPS.
- Every administrator uses their own account, so the audit log names them.
