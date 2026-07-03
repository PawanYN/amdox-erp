import { apiClient } from './client';
import { ensureFreshToken } from '../auth';

export const financeApi = {
  getAccounts: () => apiClient('/finance/gl/accounts'),
  createAccount: (body: object) =>
    apiClient('/finance/gl/accounts', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getJournalEntries: () => apiClient('/finance/gl/journal-entries'),
  getAgingReport: () => apiClient('/finance/ar/aging-report'),
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

    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/finance/ap/invoices/upload`, {
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

