import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../infrastructure/search/search.module';
import { ProjectController } from './project/project.controller';
import { ProjectService } from './project/project.service';
import { ResourceController } from './resource/resource.controller';
import { ResourceService } from './resource/resource.service';
import { BudgetController } from './budget/budget.controller';
import { BudgetService } from './budget/budget.service';
import { LaborCostBridgeListener } from './budget/labor-cost-bridge.listener';
import { MilestoneOverdueScheduler } from './milestone-overdue.scheduler';

@Module({
  imports: [AuthModule, SearchModule],
  controllers: [ProjectController, ResourceController, BudgetController],
  providers: [
    ProjectService,
    ResourceService,
    BudgetService,
    LaborCostBridgeListener,
    MilestoneOverdueScheduler,
  ],
  exports: [ProjectService, ResourceService, BudgetService],
})
export class PmModule {}
