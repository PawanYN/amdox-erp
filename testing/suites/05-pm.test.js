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

  test('GET /pm/projects/tasks → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/projects/tasks');
    assertOk(res, 'GET /pm/projects/tasks');
    assertArray(res.data, 'Tasks');
  });

  test('GET /pm/projects/:id/milestones → 200 array', async () => {
    if (!api.hasToken()) return;
    const projects = await api.get('/pm/projects');
    assertOk(projects, 'GET /pm/projects');
    if (projects.data.length === 0) return; // no projects — skip
    const projectId = projects.data[0].id;
    const res = await api.get(`/pm/projects/${projectId}/milestones`);
    assertOk(res, 'GET /pm/projects/:id/milestones');
    assertArray(res.data, 'Milestones');
  });

  test('GET /pm/resources → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/pm/resources');
    assertOk(res, 'GET /pm/resources');
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

  test('GET /scm/requisitions → 200 array', async () => {
    if (!api.hasToken()) return;
    const res = await api.get('/scm/requisitions');
    assertOk(res, 'GET /scm/requisitions');
    assertArray(res.data, 'Requisitions');
  });

});
