import 'dotenv/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';
import { RequisitionService } from '../src/scm/requisition/requisition.service';
import { PurchaseService } from '../src/scm/purchase/purchase.service';
import { ApService } from '../src/finance/ap/ap.service';
import { InvoiceMatchingService } from '../src/finance/ap/invoice-matching.service';
import { OcrService } from '../src/finance/ap/ocr.service';
import { GlService } from '../src/finance/gl/gl.service';

const prisma = new PrismaClient();

async function getTenantId() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'amdox-erp' } });
  if (!tenant) {
    throw new Error('Seed tenant amdox-erp not found. Run db seed first.');
  }
  return tenant.id;
}

async function verifyP2PFlow() {
  const tenantId = await getTenantId();
  const eventEmitter = new EventEmitter2();

  const invoiceMatching = new InvoiceMatchingService();
  const ocrService = new OcrService();
  const apService = new ApService(invoiceMatching, ocrService, eventEmitter);
  const glService = new GlService(eventEmitter);
  const requisitionService = new RequisitionService(eventEmitter);

  const noopQueue = { add: async () => undefined };
  const purchaseService = new PurchaseService(
    eventEmitter,
    noopQueue as any,
    { notifyVendorWebhook: async () => undefined } as any,
  );

  eventEmitter.on('goods.received', async (payload: {
    tenantId: string;
    purchaseOrderId: string;
    goodsReceiptId: string;
  }) => {
    await apService.createInvoiceFromGoodsReceipt(
      payload.tenantId,
      payload.purchaseOrderId,
      payload.goodsReceiptId,
    );
  });

  eventEmitter.on('invoice.approved', async (payload: {
    tenantId: string;
    invoiceId: string;
  }) => {
    await glService.handleInvoiceApproved(payload);
  });

  const lowStockProduct = await prisma.product.findFirst({
    where: { tenantId, sku: 'SKU-003' },
    include: { stockLevels: true },
  });
  if (!lowStockProduct?.defaultVendorId) {
    throw new Error('SKU-003 with default vendor required. Re-run db seed.');
  }

  const warehouse = await prisma.warehouse.findFirst({ where: { tenantId } });
  if (!warehouse) {
    throw new Error('Warehouse required. Re-run db seed.');
  }

  const totalStock = lowStockProduct.stockLevels.reduce(
    (sum, level) => sum + Number(level.quantity),
    0,
  );
  console.log(`Step 1 — Low stock: ${lowStockProduct.sku} at ${totalStock} units`);

  const requisition = await requisitionService.createFromLowStock(
    tenantId,
    lowStockProduct.id,
  );
  console.log(`Step 2 — PR created: ${requisition.id}`);

  const line = requisition.lines[0];
  const po = await purchaseService.createPurchaseOrder(tenantId, {
    vendorId: lowStockProduct.defaultVendorId,
    requisitionId: requisition.id,
    lines: [
      {
        productId: line.productId,
        quantity: Number(line.quantity),
        unitPrice: Number(line.estimatedUnitPrice ?? lowStockProduct.unitCost),
      },
    ],
  });
  console.log(`Step 3 — PO created: ${po.poNumber} (${po.status})`);

  await purchaseService.approvePurchaseOrder(tenantId, po.id);
  console.log('Step 4 — PO approved');

  const receipt = await purchaseService.receiveGoods(tenantId, po.id, {
    warehouseId: warehouse.id,
    notes: 'P2P integration verification',
  });
  console.log(`Step 5 — Goods received: ${receipt.id}`);

  await new Promise((resolve) => setTimeout(resolve, 300));

  const invoice = await prisma.invoice.findFirst({
    where: { tenantId, type: 'AP', purchaseOrderId: po.id },
  });
  if (!invoice || invoice.status !== 'APPROVED') {
    throw new Error(
      `Expected auto-approved AP invoice; got ${invoice?.status ?? 'none'}`,
    );
  }
  console.log(`Step 6 — 3-way match passed: ${invoice.invoiceNumber}`);

  const journal = await prisma.journalEntry.findFirst({
    where: {
      tenantId,
      sourceModule: 'AP',
      sourceId: invoice.id,
    },
    include: { lines: true },
  });
  if (!journal) {
    throw new Error('Expected GL journal entry for approved AP invoice');
  }

  const debits = journal.lines.reduce((sum, l) => sum + Number(l.debit), 0);
  const credits = journal.lines.reduce((sum, l) => sum + Number(l.credit), 0);
  if (Math.abs(debits - credits) > 0.01) {
    throw new Error(`Unbalanced journal: debit=${debits} credit=${credits}`);
  }

  console.log(`Step 7 — GL journal posted: ${journal.reference} (₹${debits})`);
  console.log('INT-01 Procure-to-Pay flow verified successfully.');
}

verifyP2PFlow()
  .catch((err) => {
    console.error('P2P verification failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
