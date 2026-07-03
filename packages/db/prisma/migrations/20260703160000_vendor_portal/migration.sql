-- BE-08: Vendor external portal — portal access keys + PO vendor acknowledgement fields

ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalAccessKeyHash" TEXT;
ALTER TABLE "Vendor" ADD COLUMN IF NOT EXISTS "portalKeyIssuedAt" TIMESTAMP(3);

ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "vendorAcknowledgedAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "vendorExpectedDeliveryAt" TIMESTAMP(3);
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "vendorShipmentNotes" TEXT;
