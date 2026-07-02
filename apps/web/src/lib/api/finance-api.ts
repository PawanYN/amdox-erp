import { apiClient, API_BASE_URL } from './client';
import { ensureFreshToken } from '../auth';

type JournalLineInput = { accountId: string; debit: number; credit: number };

export const financeApi = {
  getAccounts: () => apiClient('/finance/gl/accounts'),
  getJournalEntries: () => apiClient('/finance/gl/journal-entries'),
  getCurrentFiscalPeriod: () => apiClient('/finance/gl/fiscal-periods/current'),
  getFiscalPeriods: () => apiClient('/finance/gl/fiscal-periods'),
  openFiscalPeriod: (body: { name: string; startDate: string; endDate: string }) =>
    apiClient('/finance/gl/fiscal-periods/open', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  closeFiscalPeriod: (id: string) =>
    apiClient(`/finance/gl/fiscal-periods/${id}/close`, { method: 'POST' }),
  createJournalEntry: (body: {
    fiscalPeriodId: string;
    reference: string;
    description?: string;
    lines: JournalLineInput[];
  }) =>
    apiClient('/finance/gl/journal-entries', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getAgingReport: () => apiClient('/finance/ar/aging-report'),
  getArInvoices: () => apiClient('/finance/ar/invoices'),
  getArCustomers: () => apiClient('/finance/ar/customers'),
  createArCustomer: (body: { name: string; email?: string }) =>
    apiClient('/finance/ar/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  createArInvoice: (body: Record<string, unknown>) =>
    apiClient('/finance/ar/invoices', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  recordArPayment: (body: { invoiceId: string; amount: number; bankReference?: string }) =>
    apiClient('/finance/ar/payments', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getInvoices: () => apiClient('/finance/ap/invoices'),
  approveInvoice: (id: string) =>
    apiClient(`/finance/ap/invoices/${id}/approve`, { method: 'POST' }),
  uploadInvoice: async (file: File, goodsReceiptId?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (goodsReceiptId) form.append('goodsReceiptId', goodsReceiptId);

    const headers: Record<string, string> = {};
    const token = await ensureFreshToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE_URL}/finance/ap/invoices/upload`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Upload failed: ${res.status}`);
    }
    return res.json();
  },
};
