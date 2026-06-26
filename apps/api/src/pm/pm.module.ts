import { Module } from '@nestjs/common';
import { ProjectController } from './project/project.controller';
import { ProjectService } from './project/project.service';
import { ResourceController } from './resource/resource.controller';
import { ResourceService } from './resource/resource.service';
import { BudgetController } from './budget/budget.controller';
import { BudgetService } from './budget/budget.service';

@Module({
  controllers: [
    ProjectController,
    ResourceController,
    BudgetController
  ],
  providers: [
    ProjectService,
    ResourceService,
    BudgetService
  ],
  exports: [
    ProjectService,
    ResourceService,
    BudgetService
  ]
})
export class PmModule {}
