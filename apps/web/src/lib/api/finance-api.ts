import { apiClient } from './client';

export const financeApi = {
  getInvoices: () => apiClient('/finance/ap/invoices'),
  approveInvoice: (id: string) => apiClient(`/finance/ap/invoices/${id}/approve`, { method: 'POST' }),
};
