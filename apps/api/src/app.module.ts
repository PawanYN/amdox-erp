import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { HrModule } from './hr/hr.module';
import { ScmModule } from './scm/scm.module';
import { PmModule } from './pm/pm.module';
import { TenantModule } from './tenant/tenant.module';
import { AuditModule } from './audit/audit.module';
import { AppController } from './app.controller';
import { RedisModule } from './common/redis/redis.module';
import { RedisService } from './common/redis/redis.service';
import { StorageModule } from './common/storage/storage.module';
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { UserAwareThrottlerGuard } from './common/throttler/user-aware-throttler.guard';
import { APP_INTERCEPTOR, APP_FILTER, APP_GUARD } from '@nestjs/core';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { BiModule } from './bi/bi.module';
import { ForecastModule } from './forecast/forecast.module';
import { SearchModule } from './search/search.module';
import { AppGraphqlModule } from './graphql/graphql.module';

import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        // HTTP request logs are handled by AmdoxHttpLoggingInterceptor — suppress Pino's default
        autoLogging: false,
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true, colorize: false } }
            : undefined,
      },
    }),
    RedisModule,
    StorageModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    // Redis-backed sliding-window rate limiting, applied globally via
    // UserAwareThrottlerGuard below. Two named limits: a "short" burst
    // window and a looser "medium" per-minute cap.
    //
    // Limits raised from the original 5 req/s + 100/min — found live under
    // the Day 21 k6 load test that those were far too tight for genuine
    // multi-XHR-per-page-load dashboard usage (a single BI page load alone
    // can fire 5+ concurrent requests). Paired with UserAwareThrottlerGuard
    // so the bucket is keyed per authenticated user, not per IP, so this
    // still meaningfully caps a single abusive caller.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [
          {
            name: 'short',
            ttl: parseInt(process.env.THROTTLE_SHORT_TTL_MS || '1000', 10),
            limit: parseInt(process.env.THROTTLE_SHORT_LIMIT || '20', 10),
          },
          {
            name: 'medium',
            ttl: parseInt(process.env.THROTTLE_MEDIUM_TTL_MS || '60000', 10),
            limit: parseInt(process.env.THROTTLE_MEDIUM_LIMIT || '600', 10),
          },
        ],
        storage: new ThrottlerStorageRedisService(redis),
      }),
    }),
    HealthModule,
    FinanceModule,
    HrModule,
    ScmModule,
    PmModule,
    TenantModule,
    AuditModule,
    AuthModule,
    NotificationModule,
    BiModule,
    ForecastModule,
    SearchModule,
    AppGraphqlModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: UserAwareThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}
