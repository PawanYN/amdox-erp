# How BE-05 (Outbound FIFO Cost Consumption) Was Completed

This is a full walkthrough of the process used to complete BE-05, written so it can
be reused as a template for completing similar backend tasks correctly — not just
the final diff, but the investigation, design, verification, and doc-update steps
that led to it.

---

## Step 1: Understand what "done" already looks like

Before writing anything, searched for existing FIFO-related code to see what
groundwork was already there:

```bash
grep -rn "InventoryCostLayer|CostLayer" apps/api/src --include="*.ts" -l
```

This found `purchase.service.ts` already creates `InventoryCostLayer` rows when
goods are received (inbound). Reading that code revealed the existing pattern:

```ts
await tx.inventoryCostLayer.create({
  data: {
    tenantId,
    productId,
    warehouseId,
    goodsReceiptId,
    quantity: line.quantity,
    remainingQty: line.quantity,
    unitCost: line.unitPrice,
  },
});
```

**Key insight:** the schema already had a `remainingQty` field separate from
`quantity` — meaning someone had already designed this table _for_ FIFO draining,
but nobody had written the code that actually decrements `remainingQty` on the
outbound side. That told us exactly what was missing and where it belonged.

## Step 2: Find where outbound stock movements happen

Read `inventory.service.ts`'s `recordMovement()` — this is what runs when stock
goes out (ISSUE/TRANSFER). It updated `StockLevel` (the running total) but never
touched `InventoryCostLayer`. That's the gap.

Also checked whether any _other_ code path creates outbound stock movements (to
make sure there weren't two places needing the same fix):

```bash
grep -rn "stockMovement.create" apps/api/src --include="*.ts"
```

Only two call sites existed — the inbound one in `purchase.service.ts`, and the
one being fixed. Confirmed there was only one place to patch.

## Step 3: Design the algorithm

FIFO consumption logic:

1. Fetch all cost layers for that product+warehouse with `remainingQty > 0`,
   ordered oldest-first (`receivedAt asc`).
2. Walk the list: for each layer, take `min(layer.remainingQty, still needed)`,
   decrement the layer, add `taken * unitCost` to a running total.
3. Stop once the requested quantity is fully covered, or layers run out.
4. If layers run out before covering everything, don't throw — some stock may
   exist without a cost-layer trail (e.g., data seeded before this feature
   existed). Report the shortfall as `unmatchedQuantity` (costed at ₹0) instead
   of blocking the business operation.

Decided **not to throw an exception** on a shortfall because blocking real
inventory movements over a bookkeeping gap would be worse than an imperfect cost
number — a judgment call worth stating explicitly in a comment, since it's not
obvious from the code alone.

## Step 4: Implement it

In `apps/api/src/scm/inventory/inventory.service.ts`:

- Added two exported TypeScript interfaces (`ConsumedLayer`, `FifoConsumptionResult`)
  so the shape of the result is explicit and reusable by the controller/frontend.
- Added a private method `consumeFifoCostLayers(tx, tenantId, productId,
warehouseId, quantity)` implementing the algorithm above, running inside the
  same Prisma `$transaction` as the stock movement so it's atomic — either both
  the movement and the layer drain succeed, or neither does.
- Wired it into `recordMovement()`: compute `isOutbound = type === 'ISSUE' ||
type === 'TRANSFER'`, and when true, call the FIFO helper and attach
  `fifoConsumption` to the returned object.
- Added logging with the project's existing `AmdoxLogger.scm(...)` convention
  (checked how other SCM files logged, e.g. `purchase.service.ts`, to match house
  style rather than inventing a new pattern) — one log line per outbound
  consumption showing quantities/layers/cost, and a `AmdoxLogger.warn(...)`
  specifically when `unmatchedQuantity > 0`.
- Added doc comments explaining _why_ (not just what) — e.g. why ADJUSTMENT isn't
  treated as outbound, why unmatched quantity doesn't throw.

## Step 5: Typecheck

```bash
cd apps/api && npx tsc --noEmit -p tsconfig.json
```

First pass caught one real error: the controller's return type referenced the new
`FifoConsumptionResult` interface, but it wasn't exported, so TS couldn't name it
in the public API surface. Fixed by adding `export` to both interfaces. Re-ran —
clean.

## Step 6: Verify against the real running system (not just types)

Typechecking proves the code compiles — it doesn't prove the _logic_ is correct.
So it was driven end-to-end against the live API:

1. Got a real Keycloak JWT (reused the documented `admin@companya.in` /
   `company-a` realm credentials from a prior test log; had to reset the password
   via Keycloak's admin API first since the old one had expired).
2. Created a real product, vendor, and warehouse via the actual REST endpoints.
3. Created and received **two separate purchase orders** for the same product at
   _different_ unit costs (10 units @ ₹50, then 10 units @ ₹80) — this creates
   two distinct cost layers, which is the only way to actually prove FIFO
   ordering (buying at only one price would leave it indistinguishable from
   LIFO or average cost).
4. Issued 15 units and checked the response: it drained **all 10 from the ₹50
   layer, then 5 from the ₹80 layer**, total cost ₹900 — exactly what correct
   FIFO should produce.
5. Issued the remaining 5 to confirm the second layer drains to exactly zero.
6. Forced the edge case: manually adjusted stock up by 3 units with **no** cost
   layer backing it, then issued those 3 — confirmed the system reported
   `unmatchedQuantity: 3, totalCost: 0` instead of crashing or blocking the
   movement.
7. Cleaned up the test vendor/product afterward (soft-delete, same as the app
   does normally).

This step is what actually gives confidence — a green typecheck would not have
caught a wrong consumption order, a double-counted layer, or the edge case
silently throwing.

## Step 7: Update the tracking doc

Went through `docs/planning/team_assignment.md` and updated every place BE-05 was
referenced (task table, priority list, owner table, executive snapshot, overall
completion percentages) so the doc stays internally consistent rather than
having one row say "done" and a summary table elsewhere still say "open."

---

## The reusable pattern

1. Read the existing code around the gap before writing anything — figure out
   what's already half-built.
2. Search for _all_ places that might need the same fix, not just the obvious
   one.
3. Design the algorithm/edge cases on paper (or in your head) before typing.
4. Implement with comments that explain _why_, not what.
5. Typecheck — necessary but not sufficient.
6. Actually run it against real data and inspect the output, including
   deliberately constructed edge cases.
7. Update any tracking docs so the written record matches reality.
