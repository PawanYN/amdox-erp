import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Connect to the local Redis container from our docker-compose
    super({
      host: process.env.REDIS_HOST || 'localhost',
      port: Number(process.env.REDIS_PORT) || 6379,
    });
  }

  onModuleInit() {
    this.on('connect', () => console.log('✅ Connected to Redis for Cache & Blacklisting'));
    this.on('error', (err) => console.error('❌ Redis Connection Error:', err));
  }

  onModuleDestroy() {
    this.disconnect();
  }
}
