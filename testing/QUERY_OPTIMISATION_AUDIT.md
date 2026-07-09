# Amdox ERP — Database Query Optimisation Audit

**Date:** 2026-07-06
**Purpose:** Day 14 of the 28-day plan calls for "Database query optimisation
(EXPLAIN ANALYZE on critical queries)". This was marked ❌ in
`docs/team_assignment.md` — nobody had ever run `EXPLAIN ANALYZE` against this
app's queries. This log documents the audit done to close that gap.

---

## 0. Starting point — an honest correction

The first pass at this task named three tables as "the usual suspects" for
query problems — `JournalLine`, `StockMovement`, `AuditLog` — from memory,
without checking the schema or the actual query code first. That was a guess
dressed up as an answer, not a real audit. Recorded here so the actual
methodology (below) is the thing that gets trusted, not the initial guess.

### Why those three were picked (the reasoning, stated honestly)

They're all **append-only event-log tables** — rows are only ever inserted,
never updated or deleted, so they grow unboundedly over the life of a tenant.
That's _one_ real risk signal for future query problems. But growth alone
doesn't cause slow queries — **missing indexes on the columns actually used in
a query's `WHERE`/`JOIN`/`ORDER BY`** does. A table can grow to a million rows
and stay fast if every query against it hits an index; a table with 500 rows
can be slow if a query does a sequential scan with a bad filter. Table shape
is a hint about _where to look first_, not a substitute for reading the actual
queries.

### The schema has 58 models

A structural categorisation (by growth pattern alone) split them roughly as:

- **Unbounded append-only logs** (real risk if queried by date range/tenant
  without an index): `AuditLog`, `StockMovement`, `JournalLine`,
  `NotificationDelivery`, `WebhookDelivery`, `OutboxEvent`,
  `ForecastPrediction`, `InventoryCostLayer`, `AttendanceRecord`,
  `ExchangeRate`
- **Transactional tables that grow with business volume** but are mostly
  queried by ID or small filtered sets: `Invoice`, `SalesOrder`,
  `PurchaseOrder`, `Payment`, `Payslip`, `LeaveRequest`, `Task`,
  `ResourceAllocation`
- **Small, bounded reference tables** (rarely more than dozens of rows per
  tenant — low risk regardless): `Tenant`, `Role`, `Currency`,
  `FiscalPeriod`, `Department`, `Warehouse`, `Dashboard`, `ApiKey`, etc.

This categorisation is still a guess based on table _shape_. The only honest
way to answer "which tables need `EXPLAIN ANALYZE`" is to go read the actual
service code and find which queries filter/join/aggregate on non-indexed
columns — not infer it from the schema alone.

---

## 1. Methodology (what's actually being done, starting from here)

1. Enumerate every `@@index` (and `@id`/`@unique`, which Postgres also
   backs with an index) declared per model in `packages/db/prisma/schema.prisma`.
2. Go through every service file under `apps/api/src/**/*.service.ts` and
   extract every Prisma query (`findMany`, `findFirst`, `groupBy`, raw SQL,
   etc.), noting the `where`/`orderBy`/`include`/`_count` clauses used.
3. For each query, check whether every column in its `where`/`orderBy`/join
   condition is covered by an existing index on that model.
4. Flag queries where a filter/sort column has **no** backing index — these
   are the ones that will degrade as data grows and are the real candidates
   for `EXPLAIN ANALYZE` once there's realistic data volume.
5. Separately flag any query with a `.map()`/loop that issues further Prisma
   calls per iteration (N+1 pattern) — this is the other classic performance
   bug `EXPLAIN ANALYZE` alone won't show (each individual query looks fast;
   the problem is doing it 500 times in a request).
6. Where a real gap is found, propose the specific index (`@@index([...])`)
   or query restructuring (e.g. `include` instead of a loop) needed to fix it.

Findings from this pass are appended below.

---

## 2. Findings

Went through every `@@index`/`@@unique`/`@id` in `packages/db/prisma/schema.prisma`
(58 models) and every `findMany`/`findFirst`/`groupBy` call across
`apps/api/src/**/*.service.ts` and `**/*.controller.ts`, cross-referencing each
query's `where`/`orderBy` columns against the indexes actually declared on
that model.

**The pattern that shows up over and over:** a query filters `where: { tenantId, ... }`
then sorts `orderBy: { createdAt: 'desc' }` (or similar), but the model only has
`@@index([tenantId])` — no composite index covering `(tenantId, createdAt)`.
Postgres can use the `tenantId` index to narrow to that tenant's rows, but then
has to sort all of them with no index to help, which gets more expensive as
each table grows. This is invisible right now because every table has only a
handful of seed rows — it will not stay invisible.

### High priority — unbounded, high-write-volume tables

| Table          | Query site(s)                                                                                                                                                                | Current indexes                                   | Gap                                                                                                                                                                                                                                                                                            |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AuditLog`     | `audit.service.ts:24-25, 64-66, 72-74` — all three `where: { tenantId }, orderBy: { createdAt }`                                                                             | `tenantId`, `(entityType, entityId)`              | No `(tenantId, createdAt)` composite. This is the single worst case: every mutation across the _entire system_ writes here (25+ event types, hash-chained, never deleted) — genuinely unbounded growth, and it's the audit trail listing endpoint most likely to be paged through by an admin. |
| `Invoice`      | `ap.service.ts:59-62` (`type:'AP'`), `ar.service.ts:201-204` (`type:'AR'`), `bi-data.service.ts:222-225` (aging report, `type:'AR', status: notIn[...]`, `orderBy: dueDate`) | `tenantId`, `vendorId`, `customerId`, `projectId` | AP and AR share one table, discriminated by `type` — and `type` has **zero** index support beyond the blanket `tenantId` index. Every AP or AR listing query, plus the aging report, filters on `type` with no index backing it at all.                                                        |
| `Notification` | `notification.service.ts:105-107` — `where: { tenantId }, orderBy: { createdAt }`                                                                                            | `tenantId`, `userId`                              | Same pattern as AuditLog. Fires on nearly every domain event (payroll, leave, employee, invoice, milestone...), unbounded growth.                                                                                                                                                              |
| `JournalEntry` | `gl.service.ts:182-188` — `where: { tenantId }, orderBy: { createdAt }`                                                                                                      | `tenantId`, `fiscalPeriodId`                      | Same pattern. Grows with every GL-posting transaction across Finance/HR/SCM/PM bridges.                                                                                                                                                                                                        |

### Medium priority — grows with business volume, real but lower-traffic

| Table                 | Query site(s)                                                                                                                                                                | Gap                                                                                                                                                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PurchaseOrder`       | `purchase.service.ts:93-101` — `where: { tenantId }, orderBy: { createdAt }`                                                                                                 | No `createdAt` index; grows with every reorder/requisition-to-PO conversion.                                                                                                                                                                                                                                                                       |
| `PurchaseRequisition` | `requisition.service.ts:25-32` — same pattern                                                                                                                                | Same gap.                                                                                                                                                                                                                                                                                                                                          |
| `InventoryCostLayer`  | `inventory.service.ts:196-203` — `where: { tenantId, productId, warehouseId, remainingQty: {gt:0} }, orderBy: { receivedAt: 'asc' }` (the FIFO consumption query from BE-05) | Indexed on `tenantId`, `productId`, `warehouseId` as three **separate** single-column indexes, not one composite — Postgres can only use one of them efficiently per lookup. Called on every outbound stock movement (ISSUE/TRANSFER), so this is a hot path for busy warehouses even though row count per product+warehouse is naturally bounded. |
| `StockMovement`       | `forecast.controller.ts:32-36` — `where: { tenantId, productId }, orderBy: { createdAt: 'asc' }, take: 365` (feeds Prophet ML training)                                      | Same "separate single-column indexes, no composite" gap as above. Runs every time a user clicks "Train forecast" on a SKU.                                                                                                                                                                                                                         |

### Low priority — naturally bounded per tenant (same structural gap, low real-world risk)

`Project`, `Task`, `Milestone`, `ResourceAllocation`, `ProjectBudget`
(`pm/project.service.ts`), `IntercompanyTransfer` (`gl.service.ts:268-270`),
`ForecastModel` (`forecast.service.ts:41-42`). These have the identical
"tenantId indexed, sort column isn't" shape, but row counts are bounded by
human-scale activity (number of projects/tasks a company runs, number of
intercompany transfers) rather than transaction volume — low risk even at
full scale. Listed for completeness, not urgency.

### Not applicable — no read path exists yet

`WebhookDelivery`, `NotificationDelivery`, `ExchangeRate` are write-only right
now (created but never queried back anywhere in the codebase) — nothing to
optimise until a listing/monitoring endpoint is built for them.

### N+1 query pattern found

`finance/ap/ap.service.ts:401-403` — `createPaymentRun()` loops over
`dto.invoiceIds` and does a separate `findFirst` (with an `include`) **per
invoice ID** inside the loop, instead of one `findMany({ where: { id: { in:
dto.invoiceIds } } } })` upfront. For a payment run batching 50 invoices,
that's 50 sequential round-trips for the read alone. The per-invoice
`recordPayment()` write logic still has to run individually (each payment is
its own financial transaction needing its own audit/GL entry), but the read
side can be batched safely with no business-logic change.

---

## 3. Fixes applied and verified

Applied via migration `20260706120000_query_optimisation_indexes`:

```prisma
// High priority
model AuditLog     { @@index([tenantId, createdAt]) }
model Invoice      { @@index([tenantId, type, createdAt]) }  // see correction below
model Notification { @@index([tenantId, createdAt]) }
model JournalEntry { @@index([tenantId, createdAt]) }

// Medium priority
model PurchaseOrder        { @@index([tenantId, createdAt]) }
model PurchaseRequisition  { @@index([tenantId, createdAt]) }
model InventoryCostLayer   { @@index([tenantId, productId, warehouseId]) }
model StockMovement        { @@index([tenantId, productId, createdAt]) }
```

Plus the N+1 fix in `ap.service.ts`'s `createPaymentRun()`: the per-ID
`findFirst` loop was replaced with one upfront `findMany({ where: { id: {
in: dto.invoiceIds }, tenantId, type: 'AP' }, include: { payments: true }
})`, with each invoice then looked up from an in-memory `Map` inside the
loop that runs the (necessarily per-invoice) payment-writing logic.

### Correction made mid-verification — the Invoice index needed a third column

The original recommendation above was `@@index([tenantId, type])` — a
2-column index. After seeding data and testing, this index was **not used
by the planner at all**; `EXPLAIN ANALYZE` still showed a full sequential
scan + sort, identical to before the index existed. Ran `ANALYZE "Invoice"`
to rule out stale planner statistics — same plan. The real reason: a
2-column index on `(tenantId, type)` still requires a separate sort step
for `ORDER BY createdAt`, and with roughly half the seeded rows matching
`type = 'AP'` (a deliberately worst-case, non-selective split), Postgres
correctly decided a sequential scan was cheaper than an index scan that
still needed a full sort afterward. Adding `createdAt` as a third index
column (`@@index([tenantId, type, createdAt])`) let the planner satisfy the
filter _and_ the sort from the index directly, with no separate sort node
— fixed. This is why the fix was verified with `EXPLAIN ANALYZE` instead of
applied speculatively: the first version looked reasonable and would not
have helped in production.

### Verification method

1. Seeded ~80,000 rows (20k `AuditLog`, 20k `Notification`, 10k
   `JournalEntry`, 10k `Invoice`, 5k `PurchaseRequisition`, 5k
   `PurchaseOrder`, 10k `StockMovement`, 2k `InventoryCostLayer`) against the
   real `company-a` tenant via a one-off Prisma `createMany` script, tagged
   with a `PERF_SEED_TEST` marker (`action`/`eventType`/`description` field,
   or an `invoiceNumber`/`poNumber`/`reference` prefix, or an obviously-fake
   `unitCost` for `InventoryCostLayer`, since that model has no free-text
   field) for precise, safe cleanup.
2. Ran the actual query each service issues, via `EXPLAIN ANALYZE` (not just
   `EXPLAIN`, so real execution time is measured) — captured as the
   **before** baseline. The exact statements, so this is reproducible
   without depending on any committed script:

   ```sql
   EXPLAIN ANALYZE SELECT * FROM "AuditLog" WHERE "tenantId" = '<tenantId>' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "Invoice" WHERE "tenantId" = '<tenantId>' AND "type" = 'AP' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "Notification" WHERE "tenantId" = '<tenantId>' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "JournalEntry" WHERE "tenantId" = '<tenantId>' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "PurchaseOrder" WHERE "tenantId" = '<tenantId>' ORDER BY "createdAt" DESC LIMIT 50;
   EXPLAIN ANALYZE SELECT * FROM "StockMovement" WHERE "tenantId" = '<tenantId>' AND "productId" = '<productId>' ORDER BY "createdAt" ASC LIMIT 365;
   ```

3. Applied the migration (`20260706120000_query_optimisation_indexes`).
4. Re-ran the identical queries — captured as **after**.
5. Found the Invoice gap during this pass (below), fixed the index, re-verified.
6. Deleted all seeded rows by matching the `PERF_SEED_TEST` marker (and the
   `12345.6789` fake-price marker for `InventoryCostLayer`) — confirmed 0
   leftover seeded rows and the tenant's real pre-existing data (7 invoices)
   untouched. Indexes stay; seed data doesn't. The seed/cleanup scripts
   themselves were one-off and deliberately not committed — they do bulk
   insert/delete and aren't something that should sit in the repo as
   permanent tooling that could be run against real data by accident.

### Results

| Table           | Before                                                                      | After   | Plan change                                                             |
| --------------- | --------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `AuditLog`      | 6.26 ms — Bitmap Heap Scan + Sort                                           | 0.22 ms | Sort eliminated; single Index Scan Backward                             |
| `Invoice`       | 2.56 ms — Seq Scan + Sort (after correction attempt still 1.97 ms Seq Scan) | 0.28 ms | Sort eliminated; single Index Scan Backward (needed the 3-column index) |
| `Notification`  | 4.99 ms — Bitmap Heap Scan + Sort                                           | 0.19 ms | Sort eliminated; single Index Scan Backward                             |
| `JournalEntry`  | 2.56 ms — Bitmap Heap Scan + Sort                                           | 0.17 ms | Sort eliminated; single Index Scan Backward                             |
| `PurchaseOrder` | 1.48 ms — Bitmap Heap Scan + Sort                                           | 0.16 ms | Sort eliminated; single Index Scan Backward                             |
| `StockMovement` | 3.04 ms — BitmapAnd (2 separate indexes) + Sort                             | 0.42 ms | Sort eliminated; single Index Scan using the new composite              |

Every query went from "index scan (or bitmap-AND of two indexes) followed by
an in-memory sort of the matching rows" to a single index scan that returns
rows pre-sorted, satisfying the `LIMIT` directly. The absolute numbers (7-29x
faster at ~10-20k rows) matter less than the _shape_ of the fix: before, cost
scaled with how many rows matched the tenant filter; after, cost is
dominated by the `LIMIT` and stays roughly flat regardless of table size.
That's the difference that will actually matter once these tables have
millions of rows instead of thousands.

Raw `EXPLAIN ANALYZE` output for both passes is not committed — the SQL in
§ "Verification method" above plus the summary table here is the durable,
reproducible record.

`InventoryCostLayer` (the BE-05 FIFO query) wasn't included in the timed
verification pass above — it's called mid-transaction with a small, bounded
per-product row count in practice, so a synthetic 2,000-row seed wouldn't
reflect a realistic single-product volume. The composite index was still
added since the three-separate-single-column-index gap is real regardless
of current volume; it just wasn't included in the timed verification pass.
