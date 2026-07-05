import { apiClient } from "./client";

export const scmApi = {
  getPurchaseOrders: () => apiClient("/scm/purchase-orders"),
  createPurchaseOrder: (body: {
    vendorId: string;
    requisitionId?: string;
    projectId?: string;
    lines: { productId: string; quantity: number; unitPrice: number }[];
  }) =>
    apiClient("/scm/purchase-orders", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  getRequisitions: () => apiClient("/scm/requisitions"),
  createRequisitionFromLowStock: (productId: string) =>
    apiClient("/scm/requisitions/from-low-stock", {
      method: "POST",
      body: JSON.stringify({ productId }),
    }),
  approvePurchaseOrder: (id: string) =>
    apiClient(`/scm/purchase-orders/${id}/approve`, { method: "PATCH" }),
  receiveGoods: (id: string, payload: { warehouseId: string; notes?: string }) =>
    apiClient(`/scm/purchase-orders/${id}/receive`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getProducts: () => apiClient("/scm/products"),
  createProduct: (body: {
    sku: string;
    name: string;
    unitCost?: number;
    defaultVendorId?: string;
    isActive?: boolean;
  }) => apiClient("/scm/products", { method: "POST", body: JSON.stringify(body) }),
  updateProduct: (
    id: string,
    body: Partial<{
      sku: string;
      name: string;
      unitCost?: number;
      defaultVendorId?: string;
      isActive?: boolean;
    }>,
  ) => apiClient(`/scm/products/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteProduct: (id: string) => apiClient(`/scm/products/${id}`, { method: "DELETE" }),
  getVendors: () => apiClient("/scm/vendors"),
  createVendor: (body: { name: string; email?: string; phone?: string; webhookUrl?: string }) =>
    apiClient("/scm/vendors", { method: "POST", body: JSON.stringify(body) }),
  updateVendor: (
    id: string,
    body: Partial<{
      name: string;
      email?: string;
      phone?: string;
      webhookUrl?: string;
      isActive?: boolean;
    }>,
  ) => apiClient(`/scm/vendors/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteVendor: (id: string) => apiClient(`/scm/vendors/${id}`, { method: "DELETE" }),
  getWarehouses: () => apiClient("/scm/inventory/warehouses"),
  createWarehouse: (body: { name: string; location?: string }) =>
    apiClient("/scm/inventory/warehouses", { method: "POST", body: JSON.stringify(body) }),
  recordStockMovement: (body: {
    productId: string;
    warehouseId: string;
    type: "RECEIPT" | "ISSUE" | "TRANSFER" | "ADJUSTMENT";
    quantity: number;
    reference?: string;
  }) => apiClient("/scm/inventory/movements", { method: "POST", body: JSON.stringify(body) }),
  getReorderRules: () => apiClient("/scm/inventory/reorder-rules"),
  upsertReorderRule: (body: {
    productId: string;
    thresholdQty: number;
    reorderQty: number;
    isActive?: boolean;
  }) => apiClient("/scm/inventory/reorder-rules", { method: "POST", body: JSON.stringify(body) }),
  runReorderAutomation: () => apiClient("/scm/automation/run-reorder", { method: "POST" }),
  issueVendorPortalKey: (vendorId: string) =>
    apiClient(`/scm/vendors/${vendorId}/portal-key`, { method: "POST" }),
};
