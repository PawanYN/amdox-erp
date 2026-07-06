-- Scope ForecastModel to a single Product instead of one shared "active model" per tenant.
-- Without this, retraining any one SKU overwrote the same tenant-wide model row, so a
-- high-volume SKU trained with LSTM and a low-volume SKU trained with Prophet could not
-- be told apart in the UI (they'd show whichever model was trained most recently).
-- Idempotent: safe when column/constraint already exist.

ALTER TABLE "ForecastModel" ADD COLUMN IF NOT EXISTS "productId" TEXT;

CREATE INDEX IF NOT EXISTS "ForecastModel_tenantId_productId_idx" ON "ForecastModel"("tenantId", "productId");

DO $$ BEGIN
  ALTER TABLE "ForecastModel"
    ADD CONSTRAINT "ForecastModel_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
