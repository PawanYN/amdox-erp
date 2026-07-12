import { apiClient } from "./client";

export const tenantApi = {
  checkExists: (slug: string) => apiClient(`/tenant/exists/${slug}`),
  /** Email-first login: which tenant(s) does this email belong to? */
  discoverByEmail: (email: string) =>
    apiClient("/auth/discover", {
      method: "POST",
      body: JSON.stringify({ email }),
    }) as Promise<{ tenants: { slug: string; name: string }[] }>,
  createTenant: (body: Record<string, unknown>) =>
    apiClient("/tenant", { method: "POST", body: JSON.stringify(body) }),
  getConfig: () => apiClient("/tenant/config"),
  getKeycloakConfig: () => apiClient("/tenant/keycloak-config"),
  updateKeycloakConfig: (body: Record<string, unknown>) =>
    apiClient("/tenant/keycloak-config", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getRequiredActions: () => apiClient("/tenant/required-actions"),
  updateRequiredAction: (alias: string, body: Record<string, unknown>) =>
    apiClient(`/tenant/required-actions/${alias}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  getIdentityProviders: () => apiClient("/tenant/identity-providers"),
  createIdentityProvider: (body: Record<string, unknown>) =>
    apiClient("/tenant/identity-providers", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteIdentityProvider: (alias: string) =>
    apiClient(`/tenant/identity-providers/${alias}`, { method: "DELETE" }),
  getAuthenticationFlows: () => apiClient("/tenant/authentication-flows"),
  getMfaEnforcement: () => apiClient("/tenant/mfa") as Promise<{ enforced: boolean }>,
  setMfaEnforcement: (enforced: boolean) =>
    apiClient("/tenant/mfa", {
      method: "PUT",
      body: JSON.stringify({ enforced }),
    }) as Promise<{ success: boolean; enforced: boolean; usersFlagged: number }>,
};
