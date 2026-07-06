import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@amdox/db';
import { HashChainService } from './hash-chain.service';

export interface AuditLogInput {
  tenantId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  constructor(private readonly hashChain: HashChainService) {}

  async record(input: AuditLogInput) {
    const last = await prisma.auditLog.findFirst({
      where: { tenantId: input.tenantId },
      orderBy: { createdAt: 'desc' },
      select: { hash: true },
    });

    const createdAt = new Date().toISOString();
    const hashPayload = {
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      createdAt,
    };

    const hash = this.hashChain.computeHash(hashPayload, last?.hash ?? null);

    const log = await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId ?? undefined,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState as object | undefined,
        afterState: input.afterState as object | undefined,
        hash,
        previousHash: last?.hash ?? null,
      },
    });

    this.logger.log(
      `[AUDIT] ${input.action} ${input.entityType}:${input.entityId} hash=${hash.slice(0, 12)}…`,
    );
    return log;
  }

  async getLogs(tenantId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async verifyIntegrity(tenantId: string) {
    const logs = await prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      select: { hash: true, previousHash: true },
    });
    return this.hashChain.verifyChain(logs);
  }
}
