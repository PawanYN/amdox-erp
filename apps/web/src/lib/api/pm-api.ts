import { apiClient } from './client';

export const pmApi = {
  getProjects: () => apiClient('/pm/projects'),
  getProject: (projectId: string) => apiClient(`/pm/projects/${projectId}`),
  getTasks: (projectId?: string) =>
    apiClient(projectId ? `/pm/projects/tasks?projectId=${projectId}` : '/pm/projects/tasks'),
  createProject: (body: object) =>
    apiClient('/pm/projects', { method: 'POST', body: JSON.stringify(body) }),
  createTask: (body: object) =>
    apiClient('/pm/projects/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTaskStatus: (taskId: string, status: string) =>
    apiClient(`/pm/projects/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  requestMaterial: (
    projectId: string,
    body: {
      reason?: string;
      lines: { productId: string; quantity: number; estimatedUnitPrice?: number }[];
    },
  ) =>
    apiClient(`/pm/projects/${projectId}/material-requests`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getMilestones: (projectId: string) =>
    apiClient(`/pm/projects/${projectId}/milestones`),
  createMilestone: (
    projectId: string,
    body: { name: string; dueDate: string },
  ) =>
    apiClient(`/pm/projects/${projectId}/milestones`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  updateMilestone: (
    projectId: string,
    milestoneId: string,
    body: { name?: string; dueDate?: string },
  ) =>
    apiClient(`/pm/projects/${projectId}/milestones/${milestoneId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  achieveMilestone: (projectId: string, milestoneId: string) =>
    apiClient(`/pm/projects/${projectId}/milestones/${milestoneId}/achieve`, {
      method: 'PATCH',
    }),
  getBudgets: () => apiClient('/pm/budgets'),
  setBudget: (body: object) =>
    apiClient('/pm/budgets', { method: 'POST', body: JSON.stringify(body) }),
  getResourceHeatmap: () => apiClient('/pm/resources/heatmap'),
  getAllocations: () => apiClient('/pm/resources'),
  allocateResource: (body: {
    projectId: string;
    taskId?: string;
    employeeId: string;
    allocatedHours: number;
    startDate: string;
    endDate?: string;
  }) =>
    apiClient('/pm/resources/allocate', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
