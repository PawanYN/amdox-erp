# Postgres Read-Replica Strategy for BI/Reporting

**Date:** 2026-07-07 (strategy written) / 2026-07-08 (implemented + verified live)
**Purpose:** Day 21 of the 28-day plan calls for a "Postgres read replicas
strategy for BI/reporting queries." Originally written as a design doc
only; this update implements it for real in the local dev stack and
verifies streaming replication, tenant-scoped query routing, and the
primary fallback all work live — not just on paper.

---

## 1. The problem this solves

Every query in this app — transactional writes (payment runs, stock
movements, payroll runs) and BI/reporting reads (`BiService.getExecutiveKpis()`,
`BiDataService.getWidgetData()`, the AR aging / inventory / PO / project
charts) — used to go through the same single Postgres instance and the
same Prisma connection pool (`packages/db/src/client.ts`).

Reporting queries are the wrong kind of neighbor for transactional writes:

- They scan wide date ranges across large tables (`Invoice`, `JournalEntry`,
  `StockMovement`, `AuditLog`) — exactly the "unbounded append-only" tables
  flagged in `testing/QUERY_OPTIMISATION_AUDIT.md`.
- They're read-only and tolerate a few seconds of staleness (the BI cache
  added alongside this doc already accepts a 30s staleness window for the
  same reason).
- Under load (see `testing/K6_LOAD_TEST_LOG.md`), a burst of dashboard loads
  competing for the same connection pool and IO as a payment run or payroll
  batch is a real risk to the write path finance/payroll correctness
  depends on.

A streaming read replica lets reporting reads run against a copy of the data
that can't block or slow down a write.

## 2. What a "streaming replica" is, briefly

Postgres can run a second instance (the _replica_ or _standby_) that
continuously receives the primary's write-ahead log (WAL) and replays it,
keeping its data a few milliseconds-to-seconds behind the primary. Clients
can connect to the replica for `SELECT`-only queries; any attempt to write
against it fails, by design.

---

## 3. Implementation (real, running in the local dev stack)

### 3.1 Infrastructure — `infra/docker/docker-compose.yml`

Added a second Postgres service, `api-db-replica`, alongside the existing
`api-db` primary:

```yaml
api-db-replica:
  image: postgres:17-alpine
  container_name: amdox-postgres-replica
  restart: unless-stopped
  ports:
    - '5433:5432'
  environment:
    PGDATA: /var/lib/postgresql/data
    PRIMARY_HOST: api-db
    PRIMARY_PORT: 5432
    REPLICATION_USER: replicator
    REPLICATION_PASSWORD: ${DB_REPLICATION_PASSWORD:-replica_dev_pass}
  volumes:
    - postgres_replica_data:/var/lib/postgresql/data
    - ./replica-entrypoint.sh:/replica-entrypoint.sh:ro
  entrypoint: ['/bin/sh', '/replica-entrypoint.sh']
  depends_on:
    - api-db
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-amdox} -d ${DB_NAME:-amdox_erp}']
```

`infra/docker/replica-entrypoint.sh` — on first start (empty data
directory), runs a real `pg_basebackup` against the primary, then hands
off to the normal postgres entrypoint. `pg_basebackup -R` writes
`standby.signal` and `primary_conninfo` automatically, so no manual
recovery config is needed:

```sh
if [ -z "$(ls -A "$PGDATA" 2>/dev/null)" ]; then
  until PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
      -h "$PRIMARY_HOST" -p "${PRIMARY_PORT:-5432}" \
      -U "$REPLICATION_USER" -D "$PGDATA" -Fp -Xs -P -R
  do sleep 2; done
  chmod 0700 "$PGDATA"
fi
exec docker-entrypoint.sh postgres
```

**Primary-side setup** (one-time, done live against the running
`amdox-postgres` container — not baked into the image, since the primary
was already running with real data):

```sql
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replica_dev_pass';
```

Plus a `pg_hba.conf` line to allow replication connections from the Docker
subnet (the existing `host all all all scram-sha-256` line does **not**
cover the special `replication` pseudo-database — needs its own line):

```
host replication replicator 172.18.0.0/16 scram-sha-256
```

### 3.2 Application wiring — `packages/db`

- **`tenant-scope-extension.ts`** — the tenant auto-scoping `$extends`
  logic (previously inline in `client.ts`) extracted into its own module,
  so it can't drift between the primary and replica clients.
- **`client.ts`** — unchanged behavior, now imports the shared extension
  and exports `ScopedPrismaClient` (the type both clients share).
- **`replica-client.ts`** (new) — a second `PrismaClient` pointed at
  `DATABASE_REPLICA_URL`, wrapped in the same tenant-scoping extension.
  Exports `queryReplicaOrPrimary(fn)`: runs `fn` against the replica,
  falling back to the primary if `DATABASE_REPLICA_URL` isn't set or the
  replica query throws.

`BiService.computeExecutiveKpis()` and `BiDataService.computeWidgetData()`
(and its 6 chart-data sub-methods) now run through
`queryReplicaOrPrimary()` instead of the primary `prisma` client directly.
Every other BI operation (dashboard/widget CRUD) and every other module
in the app is untouched — still on the primary, as intended.

### 3.3 Fallback if the replica is unavailable

```ts
export async function queryReplicaOrPrimary<T>(
  fn: (client: ScopedPrismaClient) => Promise<T>,
): Promise<T> {
  const { prisma } = await import('./client.js');
  if (!prismaReplica) return fn(prisma);
  try {
    return await fn(prismaReplica);
  } catch (err) {
    console.warn(`[replica] query failed, falling back to primary: ${(err as Error).message}`);
    return fn(prisma);
  }
}
```

Verified live (§4.4 below): stopping the replica container mid-session,
BI endpoints kept returning 200 — served by the primary — instead of
failing.

---

## 4. Verification — real, not assumed

### 4.1 Base backup + streaming actually works

```
$ docker logs amdox-postgres-replica
[replica-entrypoint] Empty data directory — taking a base backup from primary (api-db)...
waiting for checkpoint
60380/60380 kB (100%), 1/1 tablespace
[replica-entrypoint] Base backup complete — standby.signal + primary_conninfo written by -R.
...
LOG:  entering standby mode
LOG:  consistent recovery state reached at 0/9000120
LOG:  database system is ready to accept read-only connections
LOG:  started streaming WAL from primary at 0/A000000 on timeline 1
```

`SELECT pg_is_in_recovery();` on the replica → `t`. Tenant row count
matched exactly between primary and replica (4 = 4).

### 4.2 Live write replication lag

Created a table and inserted a row on the **primary**, queried the
**replica** ~1 second later:

```
primary: INSERT INTO replica_probe (note) VALUES ('replica-test-1783432292') → 1 row
replica (1s later): SELECT * FROM replica_probe → same row, same timestamp
```

Dropped the table on the primary; confirmed it disappeared from the
replica too (`to_regclass('erp.replica_probe')` → `NULL`). Real DDL and
DML both replicate, as expected.

### 4.3 Definitive proof the app routes BI reads to the replica

Not inferred from code — enabled `log_statement = 'all'` on **both**
Postgres instances temporarily, hit `GET /bi/kpis?period=current&department=hr`
once, then diffed the logs:

```
replica log: all 7 KPI queries present — Invoice, PurchaseOrder, Employee,
             ReorderRule, Project, Department, StockLevel/Product — each
             correctly scoped with tenantId = '2b7999e6-...'
primary log: zero matches for any of those 7 queries in the same window
```

Reverted `log_statement` back to `none` on both afterward.

### 4.4 Fallback actually works when the replica is down

```
$ docker stop amdox-postgres-replica
$ curl .../bi/kpis?period=overdue&department=finance
→ 200 OK
```

API log: `Can't reach database server at localhost:5433` (the warning
from `queryReplicaOrPrimary`'s catch block), immediately followed by the
same request completing successfully — served by the primary. Restarted
the replica afterward; it resumed streaming from where it left off without
needing a fresh base backup (`standby.signal` + WAL position persisted in
the volume).

---

## 5. What's still open

- **`docker-compose.prod.yml` equivalent** — this implementation lives in
  the dev compose file (`infra/docker/docker-compose.yml`); the
  prod/deployment version of the same two services is still pending on
  the Day 22 "docker-compose.prod.yml is empty" gap.
- **No cloud-managed replica** (RDS/Cloud SQL read replica) — this is a
  self-hosted streaming replica matching the existing dev stack's own
  self-hosted primary; a managed cloud replica for a real deployment would
  use the provider's own replication feature instead of `pg_basebackup`,
  but the application-level routing (`queryReplicaOrPrimary`) would be
  identical either way.
- **No replication-lag monitoring/alerting** — not designed here; a
  follow-up once this is deployed somewhere lag actually needs watching
  (`pg_stat_replication` on the primary, or `pg_last_wal_receive_lsn()` vs.
  `pg_last_wal_replay_lsn()` on the replica, are the standard metrics).
