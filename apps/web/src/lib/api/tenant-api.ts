import { apiClient } from './client';

export const tenantApi = {
  checkExists: (slug: string) => apiClient(`/tenant/exists/${slug}`),
  createTenant: (body: Record<string, unknown>) =>
    apiClient('/tenant', { method: 'POST', body: JSON.stringify(body) }),
  getConfig: () => apiClient('/tenant/config'),
  getKeycloakConfig: () => apiClient('/tenant/keycloak-config'),
  updateKeycloakConfig: (body: Record<string, unknown>) =>
    apiClient('/tenant/keycloak-config', {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getRequiredActions: () => apiClient('/tenant/required-actions'),
  updateRequiredAction: (alias: string, body: Record<string, unknown>) =>
    apiClient(`/tenant/required-actions/${alias}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  getIdentityProviders: () => apiClient('/tenant/identity-providers'),
  createIdentityProvider: (body: Record<string, unknown>) =>
    apiClient('/tenant/identity-providers', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  deleteIdentityProvider: (alias: string) =>
    apiClient(`/tenant/identity-providers/${alias}`, { method: 'DELETE' }),
  getAuthenticationFlows: () => apiClient('/tenant/authentication-flows'),
};
