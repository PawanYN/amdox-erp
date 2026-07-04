/**
 * Suite 05 — Project Management
 * Tests: projects CRUD, budgets, tasks, milestones, resource allocation
 * Auth required: YES
 *
 * Acceptance criteria (F-07):
 *   - Overrun alert when actual > budget by 10%
 *   - Gantt renders < 1s
 */

import { suite, test } from '../helpers/runner.js';
import { api } from '../helpers/client.js';
import { assertOk, assertArray, assertHasKey } from '../helpers/assert.js';

suite('Project Management', () => {

  test('GET /pm/projects → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/projects');
    assertOk(res, 'GET /pm/projects');
    assertArray(res.data, 'Projects list');
  });

  test('Project records have required fields (id, name, status)', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/projects');
    assertOk(res);
    if (res.data.length > 0) {
      const p = res.data[0];
      assertHasKey(p, 'id',     'Project.id');
      assertHasKey(p, 'name',   'Project.name');
      assertHasKey(p, 'status', 'Project.status');
    }
  });

  test('GET /pm/tasks → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/tasks');
    assertOk(res, 'GET /pm/tasks');
    assertArray(res.data, 'Tasks');
  });

  test('GET /pm/milestones → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/milestones');
    assertOk(res, 'GET /pm/milestones');
    assertArray(res.data, 'Milestones');
  });

  test('GET /pm/resources/allocations → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/resources/allocations');
    assertOk(res, 'GET /pm/resources/allocations');
    assertArray(res.data, 'Resource allocations');
  });

  test('GET /pm/budgets → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/budgets');
    assertOk(res, 'GET /pm/budgets');
    assertArray(res.data, 'Budgets');
  });

  test('Budget entries have plannedAmount and actualAmount', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/budgets');
    assertOk(res);
    if (res.data.length > 0) {
      const b = res.data[0];
      assertHasKey(b, 'plannedAmount', 'Budget.plannedAmount');
      assertHasKey(b, 'actualAmount',  'Budget.actualAmount');
    }
  });

  test('Material requests endpoint exists → 200', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/material-requests');
    assertOk(res, 'GET /pm/material-requests');
  });

});
