import { apiClient } from "./client";

export type SearchVendorHit = { id: string; name: string; email?: string | null };
export type SearchProductHit = { id: string; name: string; sku?: string | null };
export type SearchEmployeeHit = {
  id: string;
  fullName: string;
  email?: string | null;
  designation?: string | null;
  department?: string | null;
  status?: string | null;
};
export type SearchPurchaseOrderHit = {
  id: string;
  poNumber: string;
  vendorName?: string | null;
  status?: string | null;
  totalAmount?: number | null;
};
export type SearchInvoiceHit = {
  id: string;
  invoiceNumber: string;
  type?: string | null;
  status?: string | null;
  vendorName?: string | null;
  customerName?: string | null;
  totalAmount?: number | null;
};
export type SearchCustomerHit = {
  id: string;
  name: string;
  email?: string | null;
  isActive?: boolean | null;
};
export type SearchProjectHit = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
};
export type SearchLeaveRequestHit = {
  id: string;
  employeeName?: string | null;
  status?: string | null;
  startDate?: string | null;
  endDate?: string | null;
};
export type SearchAuditLogHit = {
  id: string;
  action?: string | null;
  entityType?: string | null;
  description?: string | null;
};
export type SearchJournalEntryHit = {
  id: string;
  reference: string;
  description?: string | null;
  sourceModule?: string | null;
  status?: string | null;
};

export type SearchResponse = {
  vendors: SearchVendorHit[];
  products: SearchProductHit[];
  employees: SearchEmployeeHit[];
  purchaseOrders: SearchPurchaseOrderHit[];
  invoices: SearchInvoiceHit[];
  customers: SearchCustomerHit[];
  projects: SearchProjectHit[];
  leaveRequests: SearchLeaveRequestHit[];
  auditLogs: SearchAuditLogHit[];
  journalEntries: SearchJournalEntryHit[];
};

export const searchApi = {
  search: (q: string, limit = 20): Promise<SearchResponse> =>
    apiClient(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  reindex: () => apiClient("/search/reindex", { method: "POST" }),
};
