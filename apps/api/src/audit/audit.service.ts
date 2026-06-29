/**
 * SERVICE: audit.service.ts
 * 
 * This file is the "Brain" of the operation. All business logic, calculations, and 
 * database queries belong here. The Controller calls this service to do the actual heavy lifting.
 */
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  getDummyAuditLogs(tenantId: string) {
    return [
      {
        id: 'log-1',
        action: 'TENANT_CONFIG_UPDATED',
        entityType: 'Tenant',
        entityId: tenantId,
        beforeState: { plan: 'STANDARD' },
        afterState: { plan: 'ENTERPRISE' },
        userId: 'admin-user-id',
        hash: 'b1f82f8...',
        previousHash: 'a0e93a1...',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      },
      {
        id: 'log-2',
        action: 'SSO_CONFIG_UPDATED',
        entityType: 'TenantSettings',
        entityId: tenantId,
        beforeState: { sso: { enabled: false } },
        afterState: { sso: { enabled: true } },
        userId: 'admin-user-id',
        hash: 'c2e73f9...',
        previousHash: 'b1f82f8...',
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
      }
    ];
  }
}
