import { apiClient } from './client';

export const pmApi = {
  getProjects: () => apiClient('/pm/projects'),
  getTasks: (projectId?: string) =>
    apiClient(projectId ? `/pm/projects/tasks?projectId=${projectId}` : '/pm/projects/tasks'),
  createProject: (body: object) =>
    apiClient('/pm/projects', { method: 'POST', body: JSON.stringify(body) }),
  createTask: (body: object) =>
    apiClient('/pm/projects/tasks', { method: 'POST', body: JSON.stringify(body) }),
  getBudgets: () => apiClient('/pm/budgets'),
  setBudget: (body: object) =>
    apiClient('/pm/budgets', { method: 'POST', body: JSON.stringify(body) }),
  getResourceHeatmap: () => apiClient('/pm/resources/heatmap'),
  getAllocations: () => apiClient('/pm/resources'),
};
