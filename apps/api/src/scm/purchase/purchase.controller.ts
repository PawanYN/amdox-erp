import { Controller, Get, Post, Body, Patch, Param, Req, UseGuards } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from '../dto/receive-goods.dto';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Purchase Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('scm/purchase-orders')
export class PurchaseController {
  constructor(private readonly purchaseService: PurchaseService) {}

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post()
  createPurchaseOrder(@Req() req: any, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseService.createPurchaseOrder(req.user.tenantId, dto);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get()
  getPurchaseOrders(@Req() req: any) {
    return this.purchaseService.getPurchaseOrders(req.user.tenantId);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager', 'Viewer')
  @Get(':id')
  getPurchaseOrder(@Req() req: any, @Param('id') id: string) {
    return this.purchaseService.getPurchaseOrder(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Patch(':id/approve')
  approvePurchaseOrder(@Req() req: any, @Param('id') id: string) {
    return this.purchaseService.approvePurchaseOrder(req.user.tenantId, id);
  }

  @Roles('SuperAdmin', 'TenantAdmin', 'Manager')
  @Post(':id/receive')
  receiveGoods(@Req() req: any, @Param('id') id: string, @Body() dto: ReceiveGoodsDto) {
    return this.purchaseService.receiveGoods(req.user.tenantId, id, dto);
  }
}
