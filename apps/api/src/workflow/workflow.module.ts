import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { ConditionEvaluator } from './condition-evaluator';
import { ActionExecutor } from './action-executor';
import { PrismaService } from '../prisma/prisma.service';
import { GlService } from '../finance/gl/gl.service';
import { NotificationService } from '../shared/services/notification.service';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [WorkflowController],
  providers: [WorkflowService, ConditionEvaluator, ActionExecutor, PrismaService, GlService, NotificationService],
  exports: [WorkflowService, ConditionEvaluator, ActionExecutor],
})
export class WorkflowModule {}
