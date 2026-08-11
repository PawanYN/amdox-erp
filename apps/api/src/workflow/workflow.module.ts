import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { ConditionEvaluator } from './condition-evaluator';
import { ActionExecutor } from './action-executor';
import { FinanceModule } from '../finance/finance.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [FinanceModule, NotificationModule],
  controllers: [WorkflowController],
  providers: [WorkflowService, ConditionEvaluator, ActionExecutor],
  exports: [WorkflowService, ConditionEvaluator, ActionExecutor],
})
export class WorkflowModule {}
