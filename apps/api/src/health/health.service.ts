import { Injectable } from '@nestjs/common';
import { prisma } from '@amdox/db';

@Injectable()
export class HealthService {
  async checkLiveness() {
    return { status: 'ok' };
  }

  async checkReadiness() {
    let dbStatus = 'disconnected';
    let redisStatus = 'disconnected';
    let esStatus = 'disconnected';

    // 1. Check Database using our shared @amdox/db client
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'disconnected';
    }

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
