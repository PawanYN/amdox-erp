import { apiClient } from './client';

export const auditApi = {
  getLogs: () => apiClient('/audit/logs'),
  verifyChain: () => apiClient('/audit/verify'),
  getGdprRequests: () => apiClient('/gdpr/requests'),
  createGdprRequest: (subjectEmail: string, type: string) =>
    apiClient('/gdpr/requests', {
      method: 'POST',
      body: JSON.stringify({ subjectEmail, type }),
    }),
  fulfillGdprRequest: (id: string) =>
    apiClient(`/gdpr/requests/${id}/fulfill`, { method: 'PATCH' }),
};
