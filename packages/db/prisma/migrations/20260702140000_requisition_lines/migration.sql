-- Purchase requisition line items (PM material requests)
-- Idempotent: safe when table/constraints already exist

CREATE TABLE IF NOT EXISTS "PurchaseRequisitionLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "requisitionId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "estimatedUnitPrice" DECIMAL(18,4),
  CONSTRAINT "PurchaseRequisitionLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurchaseRequisitionLine_tenantId_idx" ON "PurchaseRequisitionLine"("tenantId");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionLine_requisitionId_idx" ON "PurchaseRequisitionLine"("requisitionId");
CREATE INDEX IF NOT EXISTS "PurchaseRequisitionLine_productId_idx" ON "PurchaseRequisitionLine"("productId");

DO $$ BEGIN
  ALTER TABLE "PurchaseRequisitionLine"
    ADD CONSTRAINT "PurchaseRequisitionLine_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseRequisitionLine"
    ADD CONSTRAINT "PurchaseRequisitionLine_requisitionId_fkey"
    FOREIGN KEY ("requisitionId") REFERENCES "PurchaseRequisition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseRequisitionLine"
    ADD CONSTRAINT "PurchaseRequisitionLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
