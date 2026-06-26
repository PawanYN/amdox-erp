import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { HrModule } from './hr/hr.module';
import { ScmModule } from './scm/scm.module';
import { AppController } from './app.controller';
import { RedisModule } from './common/redis/redis.module';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [
    RedisModule,
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    HealthModule, 
    FinanceModule, 
    HrModule, 
    ScmModule
  ],
  controllers: [AppController],
})
export class AppModule {}
