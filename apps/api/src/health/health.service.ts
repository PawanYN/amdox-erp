import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '@amdox/db';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

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

    // 3. Check Redis (Placeholder for future setup)
    try {
      // TODO: Connect redis client ping check here
      redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }

    // 4. Check Elasticsearch (Placeholder for future setup)
    try {
      // TODO: Connect elasticsearch client ping check here
      esStatus = 'connected';
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
