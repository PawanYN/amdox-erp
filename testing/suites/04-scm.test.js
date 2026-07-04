/**
 * Suite 04 — Supply Chain & Inventory
 * Tests: vendors, purchase orders, goods receipt, inventory, AP invoices
 * Auth required: YES
 *
 * Acceptance criteria (F-05):
 *   - Reorder triggered at configurable threshold
 *   - Vendor notified via webhook
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertStatus, assertOk, assertArray, assertHasKey } from '../helpers/assert.js';

suite('Supply Chain & Inventory', () => {

  test('GET /scm/vendors → 401 without token', async () => {
    const res = await fetch(`${api.BASE}/scm/vendors`);
    assertStatus({ status: res.status }, 401, 'No token → 401');
  });

  test('GET /scm/vendors → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/vendors');
    assertOk(res, 'GET /scm/vendors');
    assertArray(res.data, 'Vendors list');
  });

  test('GET /scm/products → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/products');
    assertOk(res, 'GET /scm/products');
    assertArray(res.data, 'Products list');
  });

  test('Product records have required fields (id, sku, name)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/products');
    assertOk(res);
    if (res.data.length > 0) {
      const p = res.data[0];
      assertHasKey(p, 'id',   'Product.id');
      assertHasKey(p, 'sku',  'Product.sku');
      assertHasKey(p, 'name', 'Product.name');
    }
  });

  test('GET /scm/purchase-orders → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/purchase-orders');
    assertOk(res, 'GET /scm/purchase-orders');
    assertArray(res.data, 'Purchase orders');
  });

  test('GET /scm/inventory/warehouses → 200', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/inventory/warehouses');
    assertOk(res, 'GET /scm/inventory/warehouses');
  });

  test('GET /scm/inventory/reorder-rules → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/inventory/reorder-rules');
    assertOk(res, 'Reorder rules');
    assertArray(res.data, 'Reorder rules list');
  });

  test('GET /finance/ap/invoices → 200 array (AP)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/finance/ap/invoices');
    assertOk(res, 'GET /finance/ap/invoices');
    assertArray(res.data, 'AP invoices');
  });

  test('POST /scm/purchase-orders with missing vendorId → 400', async () => {
    if (!api.hasToken()) return;
    const res = await api.post('/scm/purchase-orders', {
      lines: [{ productId: 'fake', quantity: 1, unitPrice: 100 }],
      // vendorId intentionally missing
    });
    if (res.status === 200 || res.status === 201) {
      throw new Error('PO created without vendorId — validation missing');
    }
  });

});
