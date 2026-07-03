import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private loggedReady = false;

  constructor() {
    super({
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: Number(process.env.REDIS_PORT) || 6379,
      enableReadyCheck: true,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 500, 5000),
    });

    this.on('ready', () => {
      if (!this.loggedReady) {
        this.logger.log('Connected to Redis for Cache & Blacklisting');
        this.loggedReady = true;
      }
    });

    this.on('reconnecting', () => {
      this.logger.warn('Redis connection lost — reconnecting (is amdox-redis running?)');
    });

    this.on('error', (err) => {
      this.logger.error(`Redis error: ${err.message}`);
    });
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
