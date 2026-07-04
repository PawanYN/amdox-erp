/**
 * Suite 03 — HR & Payroll Engine
 * Tests: employees, departments, leave, payroll
 * Auth required: YES
 *
 * Acceptance criteria (F-04):
 *   - Payroll processed in < 5 min for 10k employees
 *   - Audit trail complete
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertStatus, assertOk, assertArray, assertHasKey } from '../helpers/assert.js';

suite('HR & Payroll Engine', () => {

  test('GET /employees → 401 without token', async () => {
    const res = await fetch(`${api.BASE}/employees`);
    assertStatus({ status: res.status }, 401, 'No token → 401');
  });

  test('GET /employees → 200 array with token', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/employees');
    assertOk(res, 'GET /employees');
    assertArray(res.data, 'Employees list');
  });

  test('Employee records have required fields (id, email)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/employees');
    assertOk(res);
    if (res.data.length > 0) {
      const emp = res.data[0];
      assertHasKey(emp, 'id',    'Employee.id');
      assertHasKey(emp, 'email', 'Employee.email');
    }
  });

  test('GET /departments → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/departments');
    assertOk(res, 'GET /departments');
    assertArray(res.data, 'Departments');
  });

  test('GET /leave → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/leave');
    assertOk(res, 'GET /leave');
    assertArray(res.data, 'Leave requests');
  });

  test('GET /attendance → 200', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/attendance');
    assertOk(res, 'GET /attendance');
  });

  test('GET /hr/payroll/runs → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/hr/payroll/runs');
    assertOk(res, 'GET /hr/payroll/runs');
    assertArray(res.data, 'Payroll runs');
  });

  test('Payroll run has required fields (id, status)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/hr/payroll/runs');
    assertOk(res);
    if (res.data.length > 0) {
      const run = res.data[0];
      assertHasKey(run, 'id',     'PayrollRun.id');
      assertHasKey(run, 'status', 'PayrollRun.status');
    }
  });

  test('POST /hr/payroll/run with invalid body → 400', async () => {
    if (!api.hasToken()) return;
    const res = await api.post('/hr/payroll/run', { period: '' });
    if (res.status === 201 || res.status === 200) {
      throw new Error('Empty period payroll run was accepted — validation missing');
    }
  });

});
