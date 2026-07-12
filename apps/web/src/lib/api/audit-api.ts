import { apiClient, apiBlobClient } from "./client";

export type ConsentRecord = {
  id: string;
  tenantId: string;
  subjectEmail: string;
  consentType: string;
  granted: boolean;
  recordedAt: string;
};

export type VerifyChainResponse = {
  valid: boolean;
  brokenAt?: number;
};

export const auditApi = {
  getLogs: () => apiClient("/audit/logs"),
  verifyChain: (): Promise<VerifyChainResponse> => apiClient("/audit/verify"),
  getGdprRequests: () => apiClient("/gdpr/requests"),
  createGdprRequest: (subjectEmail: string, type: string) =>
    apiClient("/gdpr/requests", {
      method: "POST",
      body: JSON.stringify({ subjectEmail, type }),
    }),
  fulfillGdprRequest: (id: string) =>
    apiClient(`/gdpr/requests/${id}/fulfill`, { method: "PATCH" }),
  downloadGdprExport: (id: string) => apiBlobClient(`/gdpr/requests/${id}/export`),
  listConsents: (subjectEmail?: string) => {
    const qs = subjectEmail ? `?subjectEmail=${encodeURIComponent(subjectEmail)}` : "";
    return apiClient(`/gdpr/consent${qs}`) as Promise<ConsentRecord[]>;
  },
  recordConsent: (subjectEmail: string, consentType: string, granted: boolean) =>
    apiClient("/gdpr/consent", {
      method: "POST",
      body: JSON.stringify({ subjectEmail, consentType, granted }),
    }) as Promise<ConsentRecord>,
};
