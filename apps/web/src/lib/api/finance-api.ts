import { apiClient } from './client';

export const financeApi = {
  getAccounts: () => apiClient('/finance/gl/accounts'),
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
    const keycloak = (await import('../keycloak')).default;
    if (keycloak?.token) {
      await keycloak.updateToken(30);
      headers['Authorization'] = `Bearer ${keycloak.token}`;
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
