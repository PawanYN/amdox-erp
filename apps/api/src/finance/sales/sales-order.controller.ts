import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SalesOrderService } from './sales-order.service';
import { CreateSalesOrderDto } from '../dto/create-sales-order.dto';

@ApiTags('Sales Orders')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('finance/sales-orders')
export class SalesOrderController {
  constructor(private readonly salesOrderService: SalesOrderService) {}

  @Roles('Manager', 'TenantAdmin')
  @Post()
  @ApiOperation({ summary: 'Create a sales order (Order-to-Cash)' })
  create(@Req() req: any, @Body() dto: CreateSalesOrderDto) {
    return this.salesOrderService.createSalesOrder(req.user.tenantId, dto);
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get()
  @ApiOperation({ summary: 'List sales orders' })
  list(@Req() req: any) {
    return this.salesOrderService.listSalesOrders(req.user.tenantId);
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get(':id')
  @ApiOperation({ summary: 'Get sales order detail' })
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.salesOrderService.getSalesOrder(req.user.tenantId, id);
  }

  @Roles('Manager', 'TenantAdmin')
  @Post(':id/invoice')
  @ApiOperation({ summary: 'Generate AR invoice from sales order' })
  createInvoice(@Req() req: any, @Param('id') id: string) {
    return this.salesOrderService.createInvoiceFromOrder(req.user.tenantId, id);
  }

  @Roles('Manager', 'TenantAdmin', 'Viewer', 'SuperAdmin')
  @Get(':id/reconciliation')
  @ApiOperation({ summary: 'Payment reconciliation for sales order' })
  reconciliation(@Req() req: any, @Param('id') id: string) {
    return this.salesOrderService.getReconciliation(req.user.tenantId, id);
  }
}
