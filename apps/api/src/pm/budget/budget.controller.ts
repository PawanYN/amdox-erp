import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BudgetService } from './budget.service';
import { SetBudgetDto } from '../dto/set-budget.dto';

@ApiTags('Project Management - Budgets')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'))
@Controller('pm/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  setBudget(@Req() req: any, @Body() dto: SetBudgetDto) {
    const tenantId = req.tenantId || 'default-tenant-id'; 
    return this.budgetService.setBudget(tenantId, dto);
  }
}
