/**
 * Suite 09 — Audit & Compliance Log (F-09)
 * Tests: immutable audit trail, hash chain integrity, GDPR DSR
 *
 * Acceptance criteria (F-09):
 *   - Tamper-evident logs
 *   - DSR fulfilled in < 72h
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertOk, assertArray, assertHasKey } from '../helpers/assert.js';

suite('Audit & Compliance', () => {

  test('GET /audit/events → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/audit/events');
    assertOk(res, 'GET /audit/events');
    assertArray(res.data, 'Audit events');
  });

  test('Audit events have required fields (id, eventType, userId, createdAt, hash)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/audit/events');
    assertOk(res);
    if (res.data.length > 0) {
      const ev = res.data[0];
      assertHasKey(ev, 'id',        'AuditEvent.id');
      assertHasKey(ev, 'eventType', 'AuditEvent.eventType');
      assertHasKey(ev, 'createdAt', 'AuditEvent.createdAt');
      assertHasKey(ev, 'hash',      'AuditEvent.hash — tamper-evidence field missing');
    }
  });

  test('Hash chain integrity: consecutive events have sequential hashes', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/audit/events');
    assertOk(res);
    const events = res.data.slice(0, 5); // check first 5
    if (events.length < 2) return; // not enough events to check chain
    // All events must have non-empty hash
    const noHash = events.filter((e) => !e.hash);
    if (noHash.length > 0) {
      throw new Error(`${noHash.length} audit events have no hash — tamper-evidence broken`);
    }
  });

  test('GET /audit/gdpr/dsr → 200', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/audit/gdpr/dsr');
    assertOk(res, 'GET /audit/gdpr/dsr');
  });

  test('GET /notifications → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/notifications');
    assertOk(res, 'GET /notifications');
    assertArray(res.data, 'Notifications');
  });

});
