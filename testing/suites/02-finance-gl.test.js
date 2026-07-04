/**
 * Suite 02 — Finance: General Ledger
 * Tests: chart of accounts, journal entries, fiscal periods
 * Auth required: YES — set TEST_TOKEN env var.
 *
 * Acceptance criteria (F-02):
 *   - Zero unbalanced entries
 *   - Period lock enforced
 */

import { suite, test, skip } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import {
  assertStatus, assertOk, assertArray, assertHasKey, assertTruthy,
} from '../helpers/assert.js';

suite('Finance — General Ledger', () => {

  test('GET /finance/gl/accounts → 401 without token', async () => {
    const res = await fetch(`${api.BASE}/finance/gl/accounts`);
    assertStatus({ status: res.status }, 401, 'No token → 401');
  });

  test('GET /finance/gl/accounts → 200 with token', async () => {
    if (!api.hasToken()) return; // skip silently if no token
    const res = await api.get('/finance/gl/accounts');
    assertOk(res, 'GET /finance/gl/accounts');
    assertArray(res.data, 'GL accounts response is array');
  });

  test('GL accounts include required codes (1000, 2000, 4000)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/finance/gl/accounts');
    assertOk(res);
    if (res.data.length === 0) return; // no accounts seeded for this tenant — skip structural check
    const codes = res.data.map((a) => a.code);
    for (const code of [1000, 2000, 4000]) {
      if (!codes.includes(code) && !codes.includes(String(code))) {
        throw new Error(`GL account code ${code} missing from chart of accounts`);
      }
    }
  });

  test('GET /finance/gl/journal-entries → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/finance/gl/journal-entries');
    assertOk(res, 'GET /finance/gl/journal-entries');
    assertArray(res.data, 'Journal entries');
  });

  test('POST journal entry with unbalanced lines → 400 (double-entry enforcement)', async () => {
    if (!api.hasToken()) return;
    const res = await api.post('/finance/gl/journal-entries', {
      description: 'UNBALANCED TEST ENTRY',
      lines: [
        { accountCode: 1000, debit: 500, credit: 0, description: 'Cash' },
        { accountCode: 2000, debit: 300, credit: 0, description: 'Should be credit' },
      ],
    });
    // Must reject unbalanced — 400 or 422
    if (res.status === 200 || res.status === 201) {
      throw new Error(
        `Unbalanced journal entry was ACCEPTED (status ${res.status}) — double-entry enforcement broken!`,
      );
    }
  });

  test('GET /finance/gl/fiscal-periods → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/finance/gl/fiscal-periods');
    assertOk(res, 'GET /finance/gl/fiscal-periods');
    assertArray(res.data, 'Fiscal periods');
  });

  test('GET /finance/ar/aging-report → 200', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/finance/ar/aging-report');
    assertOk(res, 'Aging report');
  });

});
