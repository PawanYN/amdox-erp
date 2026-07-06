-- Day 14 query optimisation audit (testing/QUERY_OPTIMISATION_AUDIT.md).
-- Every one of these queries filters by tenantId then sorts by a date column
-- (or productId+warehouseId) with no composite index to back it, forcing a
-- separate in-memory sort after the index scan. Verified with EXPLAIN ANALYZE
-- against ~80k seeded rows before/after.

CREATE INDEX IF NOT EXISTS "AuditLog_tenantId_createdAt_idx" ON "AuditLog"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_type_createdAt_idx" ON "Invoice"("tenantId", "type", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "JournalEntry_tenantId_createdAt_idx" ON "JournalEntry"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseRequisition_tenantId_createdAt_idx" ON "PurchaseRequisition"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_createdAt_idx" ON "PurchaseOrder"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "StockMovement_tenantId_productId_createdAt_idx" ON "StockMovement"("tenantId", "productId", "createdAt");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_tenantId_productId_warehouseId_idx" ON "InventoryCostLayer"("tenantId", "productId", "warehouseId");
