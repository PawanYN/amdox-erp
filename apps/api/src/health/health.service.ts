import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@amdox/db';
import { RedisService } from '../common/redis/redis.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly redis: RedisService) {}

  async checkLiveness() {
    return { status: 'ok' };
  }

  async checkDb() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'connected' };
    } catch (error) {
      this.logger.error('API HealthCheck Prisma error:', error);
      return { status: 'disconnected', error: (error as Error).message };
    }
  }

  async checkReadiness() {
    let redisStatus = 'disconnected';
    let esStatus = 'disconnected';
    let keycloakStatus = 'disconnected';

    // 1. Check Database using our specific method
    const dbCheck = await this.checkDb();
    const dbStatus = dbCheck.status;

    // 2. Check Keycloak — /realms/master is a stable, auth-free endpoint
    try {
      const kcUrl = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8180';
      const response = await fetch(`${kcUrl}/realms/master`, { signal: AbortSignal.timeout(3000) });
      keycloakStatus = response.ok ? 'connected' : 'unreachable';
    } catch {
      keycloakStatus = 'disconnected';
    }

    // 3. Check Redis
    try {
      const pong = await this.redis.ping();
      redisStatus = pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
      redisStatus = 'disconnected';
    }

    // 4. Check Elasticsearch
    try {
      const esUrl = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
      const response = await fetch(`${esUrl}/_cluster/health`, {
        signal: AbortSignal.timeout(3000),
      });
      esStatus = response.ok ? 'connected' : 'unreachable';
    } catch {
      esStatus = 'disconnected';
    }

    // 5. Check ML forecast service
    let mlStatus = 'disconnected';
    try {
      const mlUrl = process.env.ML_SERVICE_URL || 'http://localhost:8091';
      const response = await fetch(`${mlUrl}/health`, { signal: AbortSignal.timeout(3000) });
      mlStatus = response.ok ? 'connected' : 'unreachable';
    } catch {
      mlStatus = 'disconnected';
    }

    return {
      status: dbStatus === 'connected' && keycloakStatus === 'connected' ? 'ready' : 'error',
      db: dbStatus,
      keycloak: keycloakStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
      mlService: mlStatus,
    };
  }
}
