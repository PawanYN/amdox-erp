import { Injectable } from '@nestjs/common';
import { prisma } from '@amdox/db';

@Injectable()
export class HealthService {
  async checkLiveness() {
    return { status: 'ok' };
  }

  async checkDb() {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { status: 'connected' };
    } catch (error) {
      console.error('API HealthCheck Prisma error:', error);
      return { status: 'disconnected', error: (error as Error).message };
    }
  }

  async checkReadiness() {
    let redisStatus = 'disconnected';
    let esStatus = 'disconnected';

    // 1. Check Database using our specific method
    const dbCheck = await this.checkDb();
    const dbStatus = dbCheck.status;

    // 2. Check Redis (Placeholder for future setup)
    try {
      // TODO: Connect redis client ping check here
      redisStatus = 'connected';
    } catch (error) {
      redisStatus = 'disconnected';
    }

    // 3. Check Elasticsearch (Placeholder for future setup)
    try {
      // TODO: Connect elasticsearch client ping check here
      esStatus = 'connected';
    } catch (error) {
      esStatus = 'disconnected';
    }

    return {
      status: dbStatus === 'connected' ? 'ready' : 'error',
      db: dbStatus,
      redis: redisStatus,
      elasticsearch: esStatus,
    };
  }
}
