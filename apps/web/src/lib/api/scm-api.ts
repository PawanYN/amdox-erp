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
  createRequisitionFromLowStock: (productId: string) =>
    apiClient('/scm/requisitions/from-low-stock', {
      method: 'POST',
      body: JSON.stringify({ productId }),
    }),
  approvePurchaseOrder: (id: string) => apiClient(`/scm/purchase-orders/${id}/approve`, { method: 'PATCH' }),
  receiveGoods: (id: string, payload: { warehouseId: string; notes?: string }) =>
    apiClient(`/scm/purchase-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getProducts: () => apiClient('/scm/products'),
  getVendors: () => apiClient('/scm/vendors'),
  getWarehouses: () => apiClient('/scm/inventory/warehouses'),
  getReorderRules: () => apiClient('/scm/inventory/reorder-rules'),
  runReorderAutomation: () =>
    apiClient('/scm/automation/run-reorder', { method: 'POST' }),
  issueVendorPortalKey: (vendorId: string) =>
    apiClient(`/scm/vendors/${vendorId}/portal-key`, { method: 'POST' }),
};
