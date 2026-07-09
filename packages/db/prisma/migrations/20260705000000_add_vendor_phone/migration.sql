-- BE-01: Vendor schema alignment — add phone field (PM decision D1: keep phone, remove rating)

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
