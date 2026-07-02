import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

export interface HashPayload {
  tenantId: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  userId?: string | null;
  createdAt: string;
}

@Injectable()
export class HashChainService {
  computeHash(payload: HashPayload, previousHash: string | null): string {
    const canonical = JSON.stringify({
      ...payload,
      previousHash: previousHash ?? 'GENESIS',
    });
    return createHash('sha256').update(canonical).digest('hex');
  }

  verifyChain(
    logs: Array<{ hash: string; previousHash: string | null }>,
  ): { valid: boolean; brokenAt?: number } {
    for (let i = 0; i < logs.length; i++) {
      const expectedPrevious =
        i === 0 ? null : logs[i - 1].hash;
      if (logs[i].previousHash !== expectedPrevious) {
        return { valid: false, brokenAt: i };
      }
    }
    return { valid: true };
  }
}
