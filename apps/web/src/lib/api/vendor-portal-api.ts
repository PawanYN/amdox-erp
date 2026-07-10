import { API_BASE_URL } from "./client";

export type VendorPortalSession = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  vendorId: string;
  vendorName: string;
  vendorEmail: string;
  accessKey: string;
};

const SESSION_KEY = "vendor_portal_session";

export function getVendorPortalSession(): VendorPortalSession | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VendorPortalSession;
  } catch {
    return null;
  }
}

export function setVendorPortalSession(session: VendorPortalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearVendorPortalSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

async function vendorPortalClient(
  endpoint: string,
  session: VendorPortalSession,
  options: RequestInit = {},
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Tenant-Id": session.tenantId,
    "X-Vendor-Key": session.accessKey,
    ...(options.headers as Record<string, string>),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

export const vendorPortalApi = {
  login: async (tenantSlug: string, email: string, accessKey: string) => {
    const response = await fetch(`${API_BASE_URL}/vendor-portal/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tenantSlug, email, accessKey }),
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || "Login failed");
    }
    return response.json() as Promise<VendorPortalSession>;
  },

  getProfile: (session: VendorPortalSession) => vendorPortalClient("/vendor-portal/me", session),

  getPurchaseOrders: (session: VendorPortalSession) =>
    vendorPortalClient("/vendor-portal/purchase-orders", session),

  acknowledgePurchaseOrder: (
    session: VendorPortalSession,
    poId: string,
    body: { expectedDeliveryAt?: string; notes?: string },
  ) =>
    vendorPortalClient(`/vendor-portal/purchase-orders/${poId}/acknowledge`, session, {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
