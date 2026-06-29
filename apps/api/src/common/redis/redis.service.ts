import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    // Connect to the local Redis container from our docker-compose
    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  onModuleInit() {
    this.on('connect', () => this.logger.log('✅ Connected to Redis for Cache & Blacklisting'));
    this.on('error', (err) => this.logger.error('❌ Redis Connection Error:', err));
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
