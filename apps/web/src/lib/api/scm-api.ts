import { apiClient } from './client';

export const scmApi = {
  getPurchaseOrders: () => apiClient('/scm/purchase-orders'),
  createPurchaseOrder: (body: {
    vendorId: string;
    requisitionId?: string;
    projectId?: string;
    lines: { productId: string; quantity: number; unitPrice: number }[];
  }) =>
    apiClient('/scm/purchase-orders', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getRequisitions: () => apiClient('/scm/requisitions'),
  approvePurchaseOrder: (id: string) => apiClient(`/scm/purchase-orders/${id}/approve`, { method: 'PATCH' }),
  receiveGoods: (id: string, payload: any) => apiClient(`/scm/purchase-orders/${id}/receive`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }),
  getProducts: () => apiClient('/scm/products'),
  getVendors: () => apiClient('/scm/vendors'),
};
