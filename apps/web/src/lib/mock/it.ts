export const mockTenantConfig = {
  id: 'default-tenant-id',
  name: 'Amdox Technologies',
  slug: 'amdox-tech',
  plan: 'ENTERPRISE',
  isActive: true,
  settings: {
    branding: {
      primaryColor: '#7a51c9',
      logoUrl: 'https://amdox.com/logo.png',
    },
    sso: {
      enabled: true,
      provider: 'KEYCLOAK',
      realmUrl: 'https://sso.amdox.com/auth/realms/amdox-tech',
      clientId: 'erp-frontend-client',
      clientSecret: 'mock-secret-do-not-expose',
      mfaEnforced: true,
    },
    security: {
      passwordPolicy: 'STRICT',
      sessionTimeoutMins: 30,
    }
  },
};

export const mockAuditLogs = [
  {
    id: 'log-1',
    action: 'TENANT_CONFIG_UPDATED',
    entityType: 'Tenant',
    entityId: 'default-tenant-id',
    beforeState: JSON.stringify({ plan: 'STANDARD' }),
    afterState: JSON.stringify({ plan: 'ENTERPRISE' }),
    userId: 'admin-user-id',
    hash: 'b1f82f8a42b1009e',
    previousHash: 'a0e93a1f94c20d77',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
  },
  {
    id: 'log-2',
    action: 'SSO_CONFIG_UPDATED',
    entityType: 'TenantSettings',
    entityId: 'default-tenant-id',
    beforeState: JSON.stringify({ sso: { enabled: false } }),
    afterState: JSON.stringify({ sso: { enabled: true } }),
    userId: 'admin-user-id',
    hash: 'c2e73f9d51a2118f',
    previousHash: 'b1f82f8a42b1009e',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
  {
    id: 'log-3',
    action: 'USER_ROLE_ASSIGNED',
    entityType: 'UserRole',
    entityId: 'user-789',
    beforeState: JSON.stringify({ role: 'VIEWER' }),
    afterState: JSON.stringify({ role: 'MANAGER' }),
    userId: 'admin-user-id',
    hash: 'd3f84g0e62b3229g',
    previousHash: 'c2e73f9d51a2118f',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  }
];

export const mockGdprRequests = [
  {
    id: 'dsr-1',
    subjectEmail: 'former.employee@amdox.com',
    type: 'ERASURE',
    status: 'IN_PROGRESS',
    requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    fulfilledAt: null,
  },
  {
    id: 'dsr-2',
    subjectEmail: 'customer@client.com',
    type: 'ACCESS',
    status: 'FULFILLED',
    requestedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    fulfilledAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
  }
];
