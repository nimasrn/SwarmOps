# ADR-0008: Keep SwarmOps controller state in MySQL or MariaDB

**Status:** Accepted; implemented on the `university/cloud-platform` branch.

**Date:** 2026-09-15

**Deciders:** Nima Sarayan

## Context

SwarmOps kept its controller state in eleven encrypted JSON snapshot files:
audit, applications, database credentials, routing, source connections,
source settings, servers, server keys, core topology, the agent registry and
the command queue. Each store loaded its whole snapshot into memory, changed it
under a mutex and rewrote the sealed file.

That design served a single operator, but SwarmOps Cloud adds customers,
orders, a wallet and billing, and three needs followed that snapshots cannot
meet:

- **Atomicity across kinds of data.** Confirming an order must charge a wallet
  and queue a deployment together. With two files there is no transaction
  spanning both, so a crash between the writes charges without deploying or
  deploys without charging.
- **Integrity enforced below the code.** Balances must never go negative,
  idempotency keys must be unique, and rows must reference existing parents,
  even when the code has a defect.
- **Querying and reporting.** Administrators need revenue by month, customer
  balances and order queues without loading every record into memory.

A second Core must also be able to share the state safely, with only the
active one acting.

## Decision

- Store every controller store in one relational database: **MariaDB 11.4 LTS
  or MySQL 8.4 LTS**, using only features both provide (InnoDB, `utf8mb4`,
  CHECK constraints, JSON columns, `SELECT … FOR UPDATE SKIP LOCKED`,
  `GET_LOCK`). Access it through `database/sql` and `go-sql-driver/mysql`.
- Add `internal/sqlstore`: a pool that forces UTC, `parseTime` and `utf8mb4`;
  `WithTx`, which runs READ COMMITTED transactions and retries the whole
  function after a deadlock (1213) or lock-wait timeout (1205); and an embedded
  migration runner that applies numbered SQL files in order, records their
  checksums in `schema_migrations`, and holds a named `GET_LOCK` while
  migrating.
- Keep each store's exported Go interface; change only its constructor to take
  the database. The rest of SwarmOps does not change.
- Keep secrets encrypted with the existing AES-GCM sealer. Bind each value to
  its table, column and key through associated data, so a ciphertext copied to
  another row cannot be opened. The data key is never stored in the database.
- Serialise work that must have one owner on singleton rows locked with
  `FOR UPDATE` (`core_authority`, `agent_ca`); only the active core recovers the
  command queue and runs billing.
- Let the command queue join a caller's transaction (`SubmitInTx`), so business
  changes and the commands they cause commit together (a transactional outbox).
- Keep large build-context artifacts as sealed files, recorded by digest in
  SQL, and keep the service log store file-based: neither is controller state.
- Provide `swarmops-core migrate-state`, which imports the existing snapshot
  files store by store and leaves the files as a backup.
- Read the DSN from `SWARMOPS_DATABASE_DSN_FILE` in production; development
  defaults to the MariaDB started by `make dev-db`.

## Consequences

- Confirming an order is one local transaction; no distributed protocol is
  needed.
- Constraints catch defects the code misses, and reports are SQL views.
- Every test that touches a store needs a database. `sqltest` creates a
  throwaway schema per test and skips when no server is reachable, unless
  `SWARMOPS_TEST_DATABASE_REQUIRED` is set; CI runs the suite on both engines.
- Backups become `mysqldump --single-transaction` plus the separately held
  data key; restoring one without the other yields unreadable secrets.
- The database is a new dependency whose availability Core now requires at
  start-up, and a new service to operate and secure.

## Alternatives considered

- **PostgreSQL.** Technically strong, but the project brief called for MySQL or
  MariaDB, which are also what the target hosting environments offer.
- **SQLite.** No second process could share the state, which rules out a
  standby core.
- **Keep snapshots and add a commerce database beside them.** Leaves the
  order-to-deployment step without a common transaction, the very problem this
  decision solves.
