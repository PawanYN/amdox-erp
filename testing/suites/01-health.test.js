/**
 * Suite 01 — Health & API Gateway
 * Tests: /health/live, /health/ready, /health/db
 * Auth required: NO — runs against any environment immediately.
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertStatus, assertHasKey, assertEquals } from '../helpers/assert.js';

suite('Health & API Gateway', () => {
  test('GET /health/live → 200 OK', async () => {
    const res = await api.get('/health/live');
    assertStatus(res, 200, 'GET /health/live');
  });

  test('GET /health/ready → 200 OK', async () => {
    const res = await api.get('/health/ready');
    assertStatus(res, 200, 'GET /health/ready');
  });

  test('GET /health/db → 200 + status field', async () => {
    const res = await api.get('/health/db');
    assertStatus(res, 200, 'GET /health/db');
    assertHasKey(res.data, 'status', 'health/db response');
  });

  test('API base URL is reachable', async () => {
    const res = await api.get('/health/live');
    if (res.status === 0 || res.status === undefined) {
      throw new Error(`Cannot reach ${api.HEALTH_BASE} — is the API server running?`);
    }
  });

  test('Protected route returns 401 without token', async () => {
    // Temporarily clear token for this check
    const savedToken = process.env.TEST_TOKEN;
    delete process.env.TEST_TOKEN;
    const res = await fetch(`${api.BASE}/finance/gl/accounts`);
    if (savedToken) process.env.TEST_TOKEN = savedToken;
    assertStatus({ status: res.status }, 401, 'No-auth check on /finance/gl/accounts');
  });

  test('Unknown route returns 404', async () => {
    const res = await api.get('/this-route-does-not-exist-xyz');
    assertStatus(res, 404, 'Unknown route 404');
  });
});
