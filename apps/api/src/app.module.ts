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
import { BullModule } from '@nestjs/bullmq';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { HttpLoggingInterceptor } from './common/interceptors/http-logging.interceptor';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { BiModule } from './bi/bi.module';
import { ForecastModule } from './forecast/forecast.module';

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
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
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
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
})
export class AppModule {}
