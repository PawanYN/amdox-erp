import { apiClient } from './client';

export const forecastApi = {
  train: (productId: string) =>
    apiClient(`/forecast/products/${productId}/train`, { method: 'POST' }),
  getPredictions: (productId: string) =>
    apiClient(`/forecast/products/${productId}`),
};
