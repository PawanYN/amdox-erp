import { apiClient } from "./client";

export const pmApi = {
  getProjects: () => apiClient("/pm/projects"),
  /** SCM catalog for material requests — works with projects module only. */
  getMaterialProducts: () => apiClient("/pm/projects/material-products"),
  getProject: (projectId: string) => apiClient(`/pm/projects/${projectId}`),
  updateProject: (projectId: string, body: Record<string, unknown>) =>
    apiClient(`/pm/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  closeProject: (projectId: string) =>
    apiClient(`/pm/projects/${projectId}/close`, { method: "POST" }),
  deleteProject: (projectId: string) =>
    apiClient(`/pm/projects/${projectId}`, { method: "DELETE" }),
  getTasks: (projectId?: string) =>
    apiClient(projectId ? `/pm/projects/tasks?projectId=${projectId}` : "/pm/projects/tasks"),
  createProject: (body: object) =>
    apiClient("/pm/projects", { method: "POST", body: JSON.stringify(body) }),
  createTask: (body: object) =>
    apiClient("/pm/projects/tasks", { method: "POST", body: JSON.stringify(body) }),
  updateTaskStatus: (taskId: string, status: string) =>
    apiClient(`/pm/projects/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  updateTask: (
    taskId: string,
    body: { title?: string; status?: string; startDate?: string; dueDate?: string },
  ) =>
    apiClient(`/pm/projects/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTask: (taskId: string) => apiClient(`/pm/projects/tasks/${taskId}`, { method: "DELETE" }),
  requestMaterial: (
    projectId: string,
    body: {
      reason?: string;
      lines: { productId: string; quantity: number; estimatedUnitPrice?: number }[];
    },
  ) =>
    apiClient(`/pm/projects/${projectId}/material-requests`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getMaterialRequests: () => apiClient("/pm/projects/material-requests"),
  getMilestones: (projectId: string) => apiClient(`/pm/projects/${projectId}/milestones`),
  createMilestone: (projectId: string, body: { name: string; dueDate: string }) =>
    apiClient(`/pm/projects/${projectId}/milestones`, {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateMilestone: (
    projectId: string,
    milestoneId: string,
    body: { name?: string; dueDate?: string },
  ) =>
    apiClient(`/pm/projects/${projectId}/milestones/${milestoneId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  achieveMilestone: (projectId: string, milestoneId: string) =>
    apiClient(`/pm/projects/${projectId}/milestones/${milestoneId}/achieve`, {
      method: "PATCH",
    }),
  deleteMilestone: (projectId: string, milestoneId: string) =>
    apiClient(`/pm/projects/${projectId}/milestones/${milestoneId}`, {
      method: "DELETE",
    }),
  getBudgets: () => apiClient("/pm/budgets"),
  setBudget: (body: object) =>
    apiClient("/pm/budgets", { method: "POST", body: JSON.stringify(body) }),
  getBudgetLines: (budgetId: string) => apiClient(`/pm/budgets/${budgetId}/lines`),
  getResourceHeatmap: () => apiClient("/pm/resources/heatmap"),
  /** Active employees for allocation — works with projects module only (no HR access needed). */
  getAllocatableEmployees: () => apiClient("/pm/resources/employees"),
  getAllocations: () => apiClient("/pm/resources"),
  allocateResource: (body: {
    projectId: string;
    taskId?: string;
    employeeId: string;
    allocatedHours: number;
    startDate: string;
    endDate?: string;
  }) =>
    apiClient("/pm/resources/allocate", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAllocation: (allocationId: string) =>
    apiClient(`/pm/resources/${allocationId}`, { method: "DELETE" }),
};
