-- BE-02: Sales Order (Order-to-Cash)
-- Idempotent: safe on re-run / partially applied databases

DO $$ BEGIN
  CREATE TYPE "SalesOrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'INVOICED', 'FULFILLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID';

CREATE TABLE IF NOT EXISTS "SalesOrder" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderNumber" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" "SalesOrderStatus" NOT NULL DEFAULT 'CONFIRMED',
  "totalAmount" DECIMAL(18,4) NOT NULL,
  "currencyId" TEXT,
  "orderDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesOrderLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "salesOrderId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "unitPrice" DECIMAL(18,4) NOT NULL,
  "lineTotal" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bankReference" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_tenantId_orderNumber_key" ON "SalesOrder"("tenantId", "orderNumber");
CREATE INDEX IF NOT EXISTS "SalesOrder_tenantId_idx" ON "SalesOrder"("tenantId");
CREATE INDEX IF NOT EXISTS "SalesOrder_customerId_idx" ON "SalesOrder"("customerId");
CREATE INDEX IF NOT EXISTS "SalesOrderLine_tenantId_idx" ON "SalesOrderLine"("tenantId");
CREATE INDEX IF NOT EXISTS "SalesOrderLine_salesOrderId_idx" ON "SalesOrderLine"("salesOrderId");

DO $$ BEGIN ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- BE-05: FIFO cost layers
CREATE TABLE IF NOT EXISTS "InventoryCostLayer" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "warehouseId" TEXT NOT NULL,
  "goodsReceiptId" TEXT,
  "quantity" DECIMAL(18,4) NOT NULL,
  "remainingQty" DECIMAL(18,4) NOT NULL,
  "unitCost" DECIMAL(18,4) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryCostLayer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "InventoryCostLayer_tenantId_idx" ON "InventoryCostLayer"("tenantId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_productId_idx" ON "InventoryCostLayer"("productId");
CREATE INDEX IF NOT EXISTS "InventoryCostLayer_warehouseId_idx" ON "InventoryCostLayer"("warehouseId");

DO $$ BEGIN ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "InventoryCostLayer" ADD CONSTRAINT "InventoryCostLayer_goodsReceiptId_fkey" FOREIGN KEY ("goodsReceiptId") REFERENCES "GoodsReceipt"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
