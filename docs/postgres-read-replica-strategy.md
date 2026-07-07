# Postgres Read-Replica Strategy for BI/Reporting

**Date:** 2026-07-07
**Purpose:** Day 21 of the 28-day plan calls for a "Postgres read replicas
strategy for BI/reporting queries." This is a written strategy only — no
replica infrastructure is stood up in this pass. It exists so the team can
build from a reviewed plan instead of re-deriving the architecture later.

---

## 1. The problem this solves

Every query in this app — transactional writes (payment runs, stock
movements, payroll runs) and BI/reporting reads (`BiService.getExecutiveKpis()`,
`BiDataService.getWidgetData()`, the AR aging / inventory / PO / project
charts) — goes through the same single Postgres instance and the same
Prisma connection pool (see `packages/db/src/client.ts`).

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
against it fails, by design. This is built into Postgres (`primary_conninfo`

- `pg_basebackup` for the initial copy, or a managed cloud provider's
  one-click read-replica feature) — no extra product is required.

## 3. Proposed architecture

```
                 ┌───────────────────────┐
  writes ───────►│  api-db (primary)      │
  (all modules)  │  postgres:17-alpine    │
                 └──────────┬────────────┘
                             │ streaming replication (WAL)
                             ▼
                 ┌───────────────────────┐
  BI/reporting  ◄│  api-db-replica        │
  reads only     │  postgres:17-alpine    │
                 └───────────────────────┘
```

### 3.1 Infrastructure (`infra/docker/docker-compose.prod.yml`)

The prod compose file is currently empty (tracked separately under Day 22's
`docker-compose.prod.yml` gap). When it's written, add a second Postgres
service alongside `api-db`:

```yaml
api-db-replica:
  image: postgres:17-alpine
  container_name: amdox-postgres-replica
  restart: unless-stopped
  environment:
    PGUSER: replicator
    POSTGRES_PASSWORD: ${DB_REPLICA_PASSWORD}
  command: >
    postgres -c hot_standby=on
             -c primary_conninfo='host=api-db port=5432 user=replicator password=${DB_REPLICA_PASSWORD}'
  depends_on:
    - api-db
  healthcheck:
    test: ['CMD-SHELL', 'pg_isready -U ${DB_USER:-amdox}']
  networks:
    - amdox-network
```

The primary needs a dedicated `replicator` role with `REPLICATION` privilege
and `pg_hba.conf` entry allowing that role to connect from the replica's
network — standard Postgres streaming-replication setup, not anything
Amdox-specific.

### 3.2 Application wiring (`packages/db`)

`packages/db/src/client.ts` currently exports one auto-scoping `prisma`
client bound to `DATABASE_URL`. Add a second, replica-bound client using the
same `$extends` tenant-scoping wrapper so BI queries stay tenant-isolated
exactly like every other query in the app:

```ts
// packages/db/src/replica-client.ts
const prismaReplicaRaw = new PrismaClient({
  datasourceUrl: process.env.DATABASE_REPLICA_URL,
});

export const prismaReplica = prismaReplicaRaw.$extends({
  query: {
    $allModels: {
      /* same tenant-scoping $allOperations as client.ts */
    },
  },
});
```

`BiService` and `BiDataService` (`apps/api/src/bi/*.service.ts`) import
`prismaReplica` instead of `prisma` for their read-only query paths. No
other module changes — writes everywhere else keep using the primary
`prisma` export unchanged.

### 3.3 Fallback if the replica is unavailable

Wrap the replica-bound queries so a connection failure falls back to the
primary rather than failing the BI endpoint outright:

```ts
async function queryReplicaOrPrimary<T>(fn: (client: PrismaClientLike) => Promise<T>): Promise<T> {
  try {
    return await fn(prismaReplica);
  } catch (err) {
    logger.warn(`Replica query failed, falling back to primary: ${(err as Error).message}`);
    return fn(prisma);
  }
}
```

This is the same "degrade gracefully instead of breaking" shape as the
`CacheService.wrap()` fallback added alongside this doc
(`apps/api/src/common/redis/cache.service.ts`) — a cache/replica outage
should make things slower, not make the endpoint 500.

### 3.4 Replication lag

Streaming replication is asynchronous by default — the replica can lag the
primary by anywhere from milliseconds to seconds depending on load. For
BI/reporting this is an acceptable tradeoff (the Redis cache layer already
accepts up to 30s of staleness on the same data). It would **not** be
acceptable for anything in the write-then-immediately-read path (e.g. a
payment-run confirmation screen that re-reads the invoice it just paid) —
those must keep reading from the primary. This is why replica routing is
scoped to the BI module specifically, not applied globally.

## 4. What this pass does NOT include

- No replica container is actually running — this is a design doc, not a
  deployed system, per the Day 21 task scope.
- No cloud-managed replica (RDS read replica, Cloud SQL replica, etc.) is
  provisioned; the docker-compose sketch above is for local/self-hosted
  parity with the existing dev stack in `infra/docker/docker-compose.yml`.
- Monitoring replication lag (e.g. alerting if lag exceeds N seconds) is not
  designed here — flagged as a follow-up once the replica actually exists.

## 5. Sequencing with other Day 21/22 work

This depends on `docker-compose.prod.yml` existing (Day 22 gap) and pairs
naturally with the k6 load test (`testing/K6_LOAD_TEST_LOG.md`) — the load
test's query-count/latency numbers for `/bi/kpis` and `/bi/data/:source` are
the evidence for whether the replica is worth building before other Week 4
work, or can wait.
