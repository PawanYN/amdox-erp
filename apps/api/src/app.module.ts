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
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TenantContextInterceptor } from './common/interceptors/tenant-context.interceptor';
import { AuthModule } from './auth/auth.module';
import { NotificationModule } from './notification/notification.module';
import { BiModule } from './bi/bi.module';
import { ForecastModule } from './forecast/forecast.module';

import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        serializers: {
          req(req) {
            let auth = req.headers.authorization;
            if (auth && auth.startsWith('Bearer ')) {
              const token = auth.replace('Bearer ', '');
              if (token.length > 10) {
                auth = `Bearer ${token.substring(0, 3)}...${token.substring(token.length - 3)}`;
              }
            }
            return {
              method: req.method,
              url: req.url,
              auth,
              tenantId: req.headers['x-tenant-id']
            };
          },
          res(res) {
            return { statusCode: res.statusCode };
          }
        },
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
      useClass: TenantContextInterceptor,
    }
  ]
})
export class AppModule {}
