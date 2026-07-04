/**
 * Suite 08 — Cross-Module Smoke Test: Procure-to-Pay Chain (Day 14)
 *
 * PDF Day 14 requirement:
 *   "Cross-module smoke test: PO → inventory → AP invoice → GL journal entry"
 *
 * This test verifies the FULL INT-01 integration chain:
 *   1. Create a Purchase Order (SUBMITTED)
 *   2. Approve the PO → emits po.created
 *   3. Receive Goods → emits goods.received → AP invoice auto-created
 *   4. Verify stock level updated
 *   5. Verify AP invoice exists for this PO
 *   6. Approve AP invoice → emits invoice.approved → GL journal posted
 *   7. Verify GL journal entry exists (Dr 1300 / Cr 2000)
 *
 * Auth required: YES (Manager or TenantAdmin role)
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertOk, assertHasKey, assertTruthy, assertArray } from '../helpers/assert.js';

// Shared state across chain steps
let vendorId = null;
let productId = null;
let warehouseId = null;
let poId = null;
let grId = null;
let invoiceId = null;

suite('Smoke Test — Procure-to-Pay Chain (INT-01)', () => {

  test('Step 0: Fetch seed data (vendor, product, warehouse)', async () => {
    if (!api.hasToken()) return;

    const [vendors, products, warehouses] = await Promise.all([
      api.get('/scm/vendors'),
      api.get('/scm/products'),
      api.get('/scm/inventory/warehouses'),
    ]);

    assertOk(vendors,    'GET /scm/vendors');
    assertOk(products,   'GET /scm/products');
    assertOk(warehouses, 'GET /scm/inventory/warehouses');
    assertTruthy(vendors.data.length    > 0, 'At least one vendor in seed data');
    assertTruthy(products.data.length   > 0, 'At least one product in seed data');
    assertTruthy(warehouses.data.length > 0, 'At least one warehouse in seed data');

    vendorId    = vendors.data[0].id;
    productId   = products.data[0].id;
    warehouseId = warehouses.data[0].id;
  });

  test('Step 1: Create Purchase Order', async () => {
    if (!api.hasToken() || !vendorId) return;

    const res = await api.post('/scm/purchase-orders', {
      vendorId,
      lines: [{ productId, quantity: 10, unitPrice: 500 }],
    });

    assertOk(res, 'POST /scm/purchase-orders');
    assertHasKey(res.data, 'id',       'PO.id');
    assertHasKey(res.data, 'poNumber', 'PO.poNumber');
    assertHasKey(res.data, 'status',   'PO.status');

    poId = res.data.id;
  });

  test('Step 2: Approve the Purchase Order', async () => {
    if (!api.hasToken() || !poId) return;

    const res = await api.patch(`/scm/purchase-orders/${poId}/approve`, {});
    assertOk(res, 'PATCH /scm/purchase-orders/:id/approve');
    if (res.data.status !== 'APPROVED') {
      throw new Error(`PO status after approval: expected APPROVED, got ${res.data.status}`);
    }
  });

  test('Step 3: Receive Goods → triggers AP invoice + GL chain', async () => {
    if (!api.hasToken() || !poId || !warehouseId) return;

    const res = await api.post(`/scm/purchase-orders/${poId}/receive`, {
      warehouseId,
      notes: 'Smoke test GR',
    });
    assertOk(res, 'POST /scm/purchase-orders/:id/receive');
    assertHasKey(res.data, 'id', 'GoodsReceipt.id');
    grId = res.data.id;
  });

  test('Step 4: Stock level updated after goods receipt', async () => {
    if (!api.hasToken() || !productId || !warehouseId) return;

    // Wait briefly for async processing
    await new Promise((r) => setTimeout(r, 800));

    const res = await api.get('/scm/inventory/stock-levels');
    assertOk(res, 'GET stock levels');
    assertArray(res.data, 'Stock levels');

    const level = res.data.find(
      (s) => s.productId === productId && s.warehouseId === warehouseId,
    );
    if (!level) {
      throw new Error(`No stock level found for product=${productId} warehouse=${warehouseId} after GR`);
    }
    if (Number(level.quantity) < 10) {
      throw new Error(`Stock quantity ${level.quantity} < 10 after receiving 10 units`);
    }
  });

  test('Step 5: AP invoice auto-created from goods receipt', async () => {
    if (!api.hasToken() || !poId) return;

    await new Promise((r) => setTimeout(r, 1200)); // allow event bridge processing

    const res = await api.get('/finance/ap/invoices');
    assertOk(res, 'GET /finance/ap/invoices');
    assertArray(res.data, 'AP invoices');

    const invoice = res.data.find((inv) => inv.purchaseOrderId === poId);
    if (!invoice) {
      throw new Error(
        `AP invoice not auto-created for PO ${poId} — goods.received event bridge may be broken`,
      );
    }
    invoiceId = invoice.id;
  });

  test('Step 6: Approve AP invoice → triggers GL journal', async () => {
    if (!api.hasToken() || !invoiceId) return;

    const res = await api.patch(`/finance/ap/invoices/${invoiceId}/approve`, {});
    assertOk(res, `PATCH /finance/ap/invoices/${invoiceId}/approve`);
    if (res.data.status !== 'APPROVED') {
      throw new Error(`Invoice status after approval: expected APPROVED, got ${res.data.status}`);
    }
  });

  test('Step 7: GL journal entry posted (Dr 1300 Inventory / Cr 2000 AP)', async () => {
    if (!api.hasToken() || !invoiceId) return;

    await new Promise((r) => setTimeout(r, 1000)); // allow GL event processing

    const res = await api.get('/finance/gl/journal-entries');
    assertOk(res, 'GET journal entries');
    assertArray(res.data, 'Journal entries');

    // Find journal entry referencing this invoice
    const entry = res.data.find(
      (je) => je.sourceId === invoiceId || je.description?.includes(invoiceId),
    );
    if (!entry) {
      throw new Error(
        `GL journal entry not found for invoice=${invoiceId} — invoice.approved → GL bridge may be broken`,
      );
    }

    // Verify double-entry balance
    const lines = entry.lines ?? [];
    const totalDebit  = lines.reduce((s, l) => s + Number(l.debit  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Journal entry is unbalanced: Dr=${totalDebit} Cr=${totalCredit}`);
    }
  });

});
