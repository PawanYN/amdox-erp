import { Controller, Post, Body, Req } from '@nestjs/common';
import { BudgetService } from './budget.service';
import { SetBudgetDto } from '../dto/set-budget.dto';

@Controller('pm/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Post()
  setBudget(@Req() req: any, @Body() dto: SetBudgetDto) {
    const tenantId = req.tenantId || 'default-tenant-id'; 
    return this.budgetService.setBudget(tenantId, dto);
  }
}
