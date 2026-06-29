import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
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
import { TenantContextMiddleware } from './common/middleware/tenant-context.middleware';

import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { singleLine: true, colorize: true } }
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
    AuditModule
  ],
  controllers: [AppController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
