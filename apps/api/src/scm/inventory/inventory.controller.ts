import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { CreateStockMovementDto } from '../dto/stock-movement.dto';
import { UpsertReorderRuleDto } from '../dto/reorder-rule.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('scm/inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('warehouses')
  createWarehouse(@Req() req: any, @Body() dto: CreateWarehouseDto) {
    return this.inventoryService.createWarehouse(req.user.tenantId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('warehouses')
  getWarehouses(@Req() req: any) {
    return this.inventoryService.getWarehouses(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('warehouses/:id')
  getWarehouse(@Req() req: any, @Param('id') id: string) {
    return this.inventoryService.getWarehouse(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('movements')
  recordMovement(@Req() req: any, @Body() dto: CreateStockMovementDto) {
    return this.inventoryService.recordMovement(req.user.tenantId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('reorder-rules')
  upsertReorderRule(@Req() req: any, @Body() dto: UpsertReorderRuleDto) {
    return this.inventoryService.upsertReorderRule(req.user.tenantId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get('reorder-rules')
  getReorderRules(@Req() req: any) {
    return this.inventoryService.getReorderRules(req.user.tenantId);
  }
}
