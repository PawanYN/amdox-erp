import { apiClient } from './client';

export const notificationApi = {
  list: () => apiClient('/notifications'),
  markRead: (id: string) =>
    apiClient(`/notifications/${id}/read`, { method: 'PATCH' }),
};
