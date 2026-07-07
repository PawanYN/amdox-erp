import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

const KEY_PREFIX = 'cache';

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisService) {}

  /**
   * Get-or-set read-through cache. On a Redis error, logs and falls through
   * to `loader()` so a cache outage degrades to "always hit the DB", not
   * a broken endpoint.
   */
  async wrap<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
    const fullKey = `${KEY_PREFIX}:${key}`;
    try {
      const cached = await this.redis.get(fullKey);
      if (cached !== null) {
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      this.logger.warn(`Cache read failed for ${fullKey}: ${(err as Error).message}`);
    }

    const value = await loader();

    try {
      await this.redis.set(fullKey, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`Cache write failed for ${fullKey}: ${(err as Error).message}`);
    }

    return value;
  }

  /**
   * Delete every key under a prefix, e.g. `bi:kpis:<tenantId>:*` after a
   * write that invalidates them. Uses SCAN (cursor-based, non-blocking)
   * rather than KEYS, which blocks the single-threaded Redis event loop for
   * the duration of the scan on a large keyspace — the wrong tradeoff to
   * introduce in a performance pass.
   */
  async invalidatePrefix(prefix: string): Promise<void> {
    const pattern = `${KEY_PREFIX}:${prefix}*`;
    try {
      let cursor = '0';
      const keysToDelete: string[] = [];
      do {
        const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        keysToDelete.push(...keys);
      } while (cursor !== '0');

      if (keysToDelete.length > 0) {
        await this.redis.del(...keysToDelete);
      }
    } catch (err) {
      this.logger.warn(`Cache invalidation failed for ${pattern}: ${(err as Error).message}`);
    }
  }
}
