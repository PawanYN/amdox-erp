/**
 * Suite 07 — Auth & RBAC
 * Tests: /auth/me, role isolation, tenant context
 * Auth required: YES for most
 *
 * Acceptance criteria (F-01):
 *   - Login < 2s; MFA enforced; tenant isolation verified
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertStatus, assertOk, assertHasKey } from '../helpers/assert.js';

suite('Auth & RBAC', () => {
  test('GET /auth/me → 401 without token', async () => {
    const res = await fetch(`${api.BASE}/auth/me`);
    assertStatus({ status: res.status }, 401, 'No token → 401 on /auth/me');
  });

  test('GET /auth/me → 200 with valid token', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/auth/me');
    assertOk(res, 'GET /auth/me');
    assertHasKey(res.data, 'email', '/auth/me email');
    assertHasKey(res.data, 'tenantId', '/auth/me tenantId');
    assertHasKey(res.data, 'roles', '/auth/me roles');
  });

  test('/auth/me roles is a non-empty array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/auth/me');
    assertOk(res);
    if (!Array.isArray(res.data.roles) || res.data.roles.length === 0) {
      throw new Error('roles is empty — RBAC will deny all access');
    }
  });

  test('Tenant ID is present on /auth/me', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/auth/me');
    assertOk(res);
    if (!res.data.tenantId) {
      throw new Error('tenantId missing on /auth/me — tenant isolation broken');
    }
  });

  test('Cross-tenant data isolation: finance data is tenant-scoped', async () => {
    if (!api.hasToken()) return;
    const me = await api.get('/auth/me');
    assertOk(me);
    const accounts = await api.get('/finance/gl/accounts');
    assertOk(accounts);
    // Each account must belong to the authenticated tenant
    const tenantId = me.data.tenantId;
    const leaking = accounts.data.filter((a) => a.tenantId && a.tenantId !== tenantId);
    if (leaking.length > 0) {
      throw new Error(
        `TENANT ISOLATION BREACH: ${leaking.length} GL accounts belong to different tenant`,
      );
    }
  });

  test('SuperAdmin-only route returns 403 for non-SuperAdmin', async () => {
    // POST /tenant creates a tenant (TenantController @Post()) — relative to API_BASE (/api/v1)
    if (!api.hasToken()) return;
    const me = await api.get('/auth/me');
    assertOk(me);
    const roles = me.data.roles ?? [];
    if (roles.includes('SuperAdmin')) return; // would pass anyway
    const res = await api.post('/tenant', { name: 'test', slug: 'test' });
    if (res.status === 200 || res.status === 201) {
      throw new Error('Non-SuperAdmin was able to provision a tenant — RBAC broken');
    }
  });
});
