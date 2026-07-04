/**
 * Suite 06 — AI Demand Forecasting (F-06)
 * Tests: forecast status list, train, predict
 * Auth required: YES
 *
 * Acceptance criteria (F-06):
 *   - MAPE < 12% on 90-day horizon
 *   - Model retrain weekly
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertOk, assertArray, assertHasKey } from '../helpers/assert.js';

suite('AI Demand Forecasting', () => {

  test('GET /forecast/products → 200 array (all SKU forecast status)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/forecast/products');
    assertOk(res, 'GET /forecast/products');
    assertArray(res.data, 'Forecast status list');
  });

  test('Forecast status items have id, sku, name fields', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/forecast/products');
    assertOk(res);
    if (res.data.length > 0) {
      const item = res.data[0];
      assertHasKey(item, 'id',   'ForecastStatus.id');
      assertHasKey(item, 'sku',  'ForecastStatus.sku');
      assertHasKey(item, 'name', 'ForecastStatus.name');
    }
  });

  test('MAPE scores are ≤ 0.12 (12%) where present', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/forecast/products');
    assertOk(res);
    const withMape = res.data.filter((i) => i.mapeScore !== null);
    const violations = withMape.filter((i) => i.mapeScore > 0.12);
    if (violations.length > 0) {
      throw new Error(
        `${violations.length} SKU(s) have MAPE > 12%: ` +
        violations.map((i) => `${i.sku}=${(i.mapeScore * 100).toFixed(1)}%`).join(', '),
      );
    }
  });

  test('GET /forecast/products/:id → 200 predictions array', async () => {
    if (!api.hasToken()) return;
    // Get first product id
    const list = await api.get('/forecast/products');
    if (!list.ok || list.data.length === 0) return;
    const productId = list.data[0].id;
    const res = await api.get(`/forecast/products/${productId}`);
    assertOk(res, `GET /forecast/products/${productId}`);
    assertArray(res.data, 'Predictions');
  });

  test('POST /forecast/products/:id/train → 200 + mape field', async () => {
    if (!api.hasToken()) return;
    const list = await api.get('/forecast/products');
    if (!list.ok || list.data.length === 0) return;
    const productId = list.data[0].id;
    const res = await api.post(`/forecast/products/${productId}/train`, {});
    assertOk(res, `POST train for ${productId}`);
    assertHasKey(res.data, 'mape', 'Train response.mape');
  });

  test('ML service health → /health/live (port 8091)', async () => {
    try {
      const res = await fetch('http://localhost:8091/health');
      if (!res.ok) throw new Error(`ML service returned ${res.status}`);
    } catch (err) {
      // Not running in this env — log but don't fail the suite
      throw new Error(`ML service (port 8091) not reachable: ${err.message}`);
    }
  });

});
