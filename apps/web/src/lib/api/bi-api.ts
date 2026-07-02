import { apiClient } from './client';

export const biApi = {
  getKpis: () => apiClient('/bi/kpis'),
  getDashboards: () => apiClient('/bi/dashboards'),
  createDashboard: (name: string) =>
    apiClient('/bi/dashboards', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
};
