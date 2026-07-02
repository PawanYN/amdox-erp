-- PM ↔ SCM ↔ Finance integration: project linkage and cost dedup

ALTER TABLE "PurchaseRequisition" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "PurchaseRequisition_projectId_idx" ON "PurchaseRequisition"("projectId");
ALTER TABLE "PurchaseRequisition" ADD CONSTRAINT "PurchaseRequisition_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_projectId_idx" ON "PurchaseOrder"("projectId");
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
CREATE INDEX IF NOT EXISTS "Invoice_projectId_idx" ON "Invoice"("projectId");
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectBudgetLine" ADD COLUMN IF NOT EXISTS "sourceModule" TEXT;
ALTER TABLE "ProjectBudgetLine" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "ProjectBudgetLine_tenantId_sourceModule_sourceId_key"
  ON "ProjectBudgetLine"("tenantId", "sourceModule", "sourceId");
