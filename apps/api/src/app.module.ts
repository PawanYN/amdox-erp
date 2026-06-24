import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { FinanceModule } from './finance/finance.module';
import { HrModule } from './hr/hr.module';
import { ScmModule } from './scm/scm.module';

@Module({
  imports: [HealthModule, FinanceModule, HrModule, ScmModule],
})
export class AppModule {}
