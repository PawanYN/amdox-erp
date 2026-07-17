# Query Optimisation & the N+1 Problem — Full Walkthrough

This doc explains, from zero, the two performance problems fixed in the
Day 14 audit (`testing/QUERY_OPTIMISATION_AUDIT.md`), the exact steps taken to
find and fix them in this project, and a general checklist you can reuse on
**any** backend project, not just Amdox.

Written for someone who hasn't done this before — concepts first, then the
real walkthrough, then the reusable pattern.

---

## Part 1 — The concepts, explained simply

### What is a database index?

Think of a database table like a phone book with a million entries, and
you're asked "find everyone named Sharma." Without an index, the database
has to open the book at page 1 and read every single row to check — that's
called a **sequential scan** (or "Seq Scan"). It works, but it gets slower as
the book gets thicker.

An **index** is a separate, pre-sorted lookup structure — like the alphabetical
tabs on the side of a real phone book. With an index on the "name" column,
the database can jump almost straight to "Sharma" instead of reading every
row. That's an **Index Scan**.

The catch: an index only helps for the _exact columns it's built on_. An
index on `name` doesn't help you find everyone in "Mumbai" — you'd need a
separate index on `city`, or (better, if you always filter by both) one
**composite index** on `(city, name)` covering both at once.

### What is a composite index, and why does column order matter?

A composite index like `@@index([tenantId, createdAt])` is one index built
on two columns together, in that order. It's useful when your query does
**both**:

- Filter by the first column (`WHERE tenantId = ...`)
- Sort or further filter by the second column (`ORDER BY createdAt DESC`)

Order matters: `(tenantId, createdAt)` lets Postgres jump straight to one
tenant's rows _and_ have them already sorted by date — no extra sort step
needed. If you reversed it to `(createdAt, tenantId)`, filtering by tenant
first would be much less efficient, because tenant isn't the leading column.

**Real example from this project:** almost every list-style query in Amdox
looks like:

```ts
prisma.auditLog.findMany({
  where: { tenantId },
  orderBy: { createdAt: 'desc' },
  take: 50,
});
```

If `AuditLog` only has an index on `tenantId` alone, Postgres can use it to
narrow down to that tenant's rows — but then has to sort _all_ of those rows
by date in memory before it can return the top 50. As the table grows from
thousands to millions of rows, that sort step gets slower and slower. A
composite index `(tenantId, createdAt)` removes the sort entirely, because
the rows come out of the index already in date order.

### What is `EXPLAIN ANALYZE`?

It's a command you put in front of any SQL query to ask Postgres: "don't
just run this — tell me _how_ you ran it, and how long each step actually
took." Example:

```sql
EXPLAIN ANALYZE SELECT * FROM "AuditLog" WHERE "tenantId" = '...' ORDER BY "createdAt" DESC LIMIT 50;
```

The output shows a tree of steps like:

```
Sort  (actual time=6.1..6.2 rows=50)
  ->  Bitmap Heap Scan on "AuditLog"  (actual time=0.5..5.8 rows=20000)
        ->  Bitmap Index Scan on AuditLog_tenantId_idx
```

This is the **only trustworthy way** to know if a query is slow and _why_.
Guessing from the schema or "this table looks big" is not evidence — the
plan is. This project's audit found and fixed a case where a "reasonable"
first-attempt index turned out to make _zero_ difference (see Part 2, step 4) — something that would never have been caught without actually running
`EXPLAIN ANALYZE` before and after.

### What is the N+1 query problem?

This is a _different_ bug from missing indexes — it's not about how one
query runs, it's about **how many queries run**.

It happens when code loops over a list and fires one new database query
_per item in the loop_, instead of fetching everything it needs in a single
query up front.

```ts
// BAD — N+1 pattern
for (const invoiceId of invoiceIds) {
  const invoice = await prisma.invoice.findFirst({ where: { id: invoiceId } });
  // ...
}
```

If `invoiceIds` has 50 entries, this is 50 separate round-trips to the
database. Each one is individually fast (indexes don't help here — the
problem isn't _how_ each query runs, it's that there are 50 of them instead
of 1). The "N+1" name comes from: 1 query to get the list, then N more
queries — one per item.

The fix is almost always the same shape: pull everything you need in **one**
query using `WHERE id IN (...)`, then look items up from an in-memory `Map`
inside the loop:

```ts
// GOOD — one query total
const invoices = await prisma.invoice.findMany({
  where: { id: { in: invoiceIds } },
});
const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

for (const invoiceId of invoiceIds) {
  const invoice = invoiceById.get(invoiceId);
  // ...
}
```

`EXPLAIN ANALYZE` will not show you this problem, because each individual
query looks totally fine in isolation. You find N+1 by **reading the code**
and looking for a database call sitting inside a loop.

---

## Part 2 — Exactly what was done in this project, step by step

### Step 1: Start from the actual claim, not a guess

The tracking doc (`docs/planning/team_assignment.md`) had "Database query optimisation
(EXPLAIN ANALYZE on critical queries)" marked ❌ — meaning nobody had ever
actually run `EXPLAIN ANALYZE` against this app's real queries.

The very first attempt at this task named three tables "the usual suspects"
from memory, without checking anything. That was caught and corrected —
it's recorded honestly in the audit doc (§0) as a lesson: **naming tables
that "sound risky" is a guess, not an audit.** The real methodology starts
at step 2.

### Step 2: Enumerate every index that already exists

```bash
# read every @@index / @unique / @id in the schema
```

Went through all 58 models in `packages/db/prisma/schema.prisma` and noted
every existing index per model. You can't tell what's _missing_ until you
know what's already there.

### Step 3: Read every real query in the codebase and check it against the indexes

Went through every `*.service.ts` and `*.controller.ts` file under
`apps/api/src`, pulled out every `findMany` / `findFirst` / `groupBy` /
raw SQL call, and for each one wrote down its `where` / `orderBy` / `include`
columns. Then, for each query, checked: _is every column in that where/sort
clause backed by an index on this model?_

This is the part that can't be shortcut with a single grep — it means
actually opening each service file and reading the Prisma calls. The payoff
was a clear, evidenced list of gaps (see the audit doc's tables), split into
priority tiers based on **how the table grows**:

- **High priority**: unbounded, high-write tables everyone reads often
  (`AuditLog`, `Invoice`, `Notification`, `JournalEntry`) — every mutation in
  the system touches these, so they'll be the first to hurt.
- **Medium priority**: grows with real business volume but lower traffic
  (`PurchaseOrder`, `PurchaseRequisition`, `InventoryCostLayer`,
  `StockMovement`).
- **Low priority**: bounded by human-scale activity (`Project`, `Task`, ...)
  — technically the same gap shape, but row counts stay small regardless of
  scale, so it's not urgent.
- **Not applicable**: tables that are written to but never queried back yet
  (`WebhookDelivery`, `ExchangeRate`) — nothing to optimise until a read path
  exists.

This priority split matters generally: **not every missing index is worth
fixing immediately.** Prioritise by (rows the table will actually reach) ×
(how often the query runs), not by "this table looks important."

### Step 4: While reading, also watch for the _other_ bug — N+1

Same pass, different question: does any loop fire a Prisma call per
iteration? Found one: `ap.service.ts`'s `createPaymentRun()` did a
`findFirst` per invoice ID inside a `for` loop.

### Step 5: Seed realistic data — you can't measure a performance problem on 10 rows

Every table in the dev database had only a handful of seed rows — at that
size, missing indexes make _no visible difference_, because a sequential
scan over 10 rows is instant regardless. To get a real, honest measurement,
seeded ~80,000 rows across the affected tables (20k `AuditLog`, 10k
`Invoice`, etc.) against a real tenant, each row tagged with an obvious
marker (a `PERF_SEED_TEST` string, or a deliberately fake price like
`12345.6789`) so it could be deleted precisely afterward without touching
real data.

**Lesson: never trust a performance fix that wasn't measured at a realistic
data volume.** A "fix" that's never been run against enough rows to show a
difference is a guess with extra steps.

### Step 6: Measure "before" with real `EXPLAIN ANALYZE`

Ran the actual query each service issues (not a simplified version) through
`EXPLAIN ANALYZE`, and recorded the real plan and timing — e.g. AuditLog's
listing query took 6.26ms with a "Bitmap Heap Scan + Sort" plan.

### Step 7: Apply the proposed indexes, then measure "after"

Wrote a normal Prisma migration adding the composite indexes identified in
step 3 (`packages/db/prisma/migrations/20260706120000_query_optimisation_indexes/`),
applied it, then re-ran the _exact same_ `EXPLAIN ANALYZE` queries.

### Step 8: Catch and fix a wrong first attempt — this is the most important step

The original plan for `Invoice` was a 2-column index: `(tenantId, type)`.
After applying it and re-running `EXPLAIN ANALYZE`, the plan **hadn't
changed at all** — still a full sequential scan + sort, exactly like before
the index existed.

Instead of assuming the index was just "not helping much," the actual cause
was investigated:

1. First ruled out stale statistics by running `ANALYZE "Invoice"` (tells
   Postgres to refresh its internal row-count estimates) — same plan
   afterward, so that wasn't it.
2. The real reason: a 2-column index still requires Postgres to separately
   sort the results by `createdAt` after filtering — the index helped
   _filter_ but didn't help _sort_. With roughly half of all rows matching
   `type = 'AP'` in the seeded data (not very selective), Postgres correctly
   judged a sequential scan cheaper than an index scan that still needed a
   full sort afterward.
3. Fix: add `createdAt` as a **third** column — `(tenantId, type,
createdAt)`. Now the index satisfies both the filter _and_ the sort order
   directly, with nothing left for Postgres to sort afterward. Re-ran
   `EXPLAIN ANALYZE` — plan changed to a clean Index Scan, 2.56ms → 0.28ms.

**This is the single most important lesson from this whole task**: the
first index design looked completely reasonable on paper and would have
shipped as a no-op fix if it hadn't been verified with real
`EXPLAIN ANALYZE` output before and after. A code review reading the schema
diff alone would have approved it. Only actually running the query caught
that it did nothing.

### Step 9: Fix the N+1 separately (indexes don't fix this kind of bug)

In `ap.service.ts`, replaced the per-invoice-ID `findFirst` loop with one
`findMany({ where: { id: { in: invoiceIds } } })` up front, then looked each
invoice up from a `Map` inside the loop (full before/after code in Part 1
above — it's the identical fix, this is where it actually landed).

Verified this one differently, since `EXPLAIN ANALYZE` doesn't apply to "how
many queries ran" — wrote a tiny script that counted actual SQL statements
Prisma emitted (using Prisma's query-logging event), confirming: old code =
5 queries for 5 invoices, new code = 1 query for 5 invoices.

Then live-tested the real endpoint with a mix of one real and one fake
invoice ID, confirming the PAID/FAILED-per-invoice result was identical to
before the change — the fix changed _how many queries run_, not _what the
feature does_.

### Step 10: Clean up every trace of the test, precisely

Deleted every seeded row by matching the exact tag used to create them
(`PERF_SEED_TEST` marker / fake price), then confirmed the real tenant's
original data (7 real invoices) was untouched and no seed rows remained.
The one-off seed/cleanup scripts themselves were deliberately **not
committed** to the repo — bulk insert/delete scripts sitting around
permanently are a foot-gun (someone could run them against real data by
accident later).

### Step 11: Write down the evidence, not just the conclusion

The audit doc records the actual before/after numbers and plan changes in a
table, plus the exact `EXPLAIN ANALYZE` SQL used, so the result is
reproducible by anyone later without having to trust "trust me, it's
faster."

---

## Part 3 — The reusable checklist (for this project or any other)

**Finding missing indexes:**

1. List every index that already exists on the model.
2. Read every real query against that model — every `where`, `orderBy`,
   join condition.
3. For each query, check whether _all_ of its filter/sort columns are
   covered by one composite index, in the right order (filter columns
   first, sort column last).
4. Prioritise fixes by **(rows the table will realistically reach) × (how
   often the query runs)** — not by which table name sounds scary.
5. Never assume an index will help — measure it. If it's a composite index
   with a sort column, that sort column usually needs to be **in** the
   index, not just the filter columns.

**Finding N+1 queries:**

1. Search for any loop (`for`, `.map`, `.forEach`) that contains an `await`
   database call inside it.
2. Ask: could this be one `findMany({ where: { id: { in: [...] } } })`
   instead, with an in-memory `Map` lookup inside the loop for whatever
   still has to run per-item?
3. Verify by counting actual queries emitted (log/count them), not just by
   reading the diff and assuming it's fewer.

**Verifying any performance fix, in general:**

1. Never trust a fix that hasn't been measured against a realistic data
   volume — small dev datasets hide almost all indexing problems.
2. Measure **before**, apply the fix, measure **after**, using the real
   query and real tool (`EXPLAIN ANALYZE` for query plans, a query counter
   for N+1). Don't skip the "before" measurement — without it you can't
   tell if the "after" number is actually better or just normal variance.
3. If the "after" measurement doesn't show the change you expected, **stop
   and find out why** instead of shipping it anyway — that's exactly what
   caught the 2-column vs. 3-column Invoice index mistake in this project.
4. Clean up any test/seed data precisely (tag it on creation so you can
   delete exactly and only that), and don't leave one-off bulk data
   scripts committed to the repo.
5. Write down the actual before/after evidence somewhere durable, so the
   next person (or future you) doesn't have to take the result on faith.
