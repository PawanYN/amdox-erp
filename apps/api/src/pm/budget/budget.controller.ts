import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { BudgetService } from './budget.service';
import { SetBudgetDto } from '../dto/set-budget.dto';

@ApiTags('Project Management - Budgets')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('pm/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'List project budgets with variance' })
  listBudgets(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.tenantId || 'default-tenant-id';
    return this.budgetService.listBudgets(tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  setBudget(@Req() req: any, @Body() dto: SetBudgetDto) {
    const tenantId = req.user?.tenantId || req.tenantId || 'default-tenant-id';
    return this.budgetService.setBudget(tenantId, dto);
  }
}
