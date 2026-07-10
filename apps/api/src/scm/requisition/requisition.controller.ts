import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RequisitionService } from './requisition.service';
import { CreateLowStockRequisitionDto } from '../dto/create-low-stock-requisition.dto';

@ApiTags('Purchase Requisitions')
@ApiBearerAuth()
@RequireModule('scm')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('scm/requisitions')
export class RequisitionController {
  constructor(private readonly requisitionService: RequisitionService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'List purchase requisitions (including project-linked)' })
  listRequisitions(@Req() req: any) {
    return this.requisitionService.listRequisitions(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post('from-low-stock')
  @ApiOperation({ summary: 'Create purchase requisition when stock is below reorder threshold' })
  createFromLowStock(@Req() req: any, @Body() dto: CreateLowStockRequisitionDto) {
    return this.requisitionService.createFromLowStock(req.user.tenantId, dto.productId);
  }
}
