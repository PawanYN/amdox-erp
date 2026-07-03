import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { VendorPortalService } from './vendor-portal.service';
import { VendorPortalGuard } from './vendor-portal.guard';
import { VendorPortalLoginDto } from './dto/vendor-portal-login.dto';
import { AcknowledgePoDto } from './dto/acknowledge-po.dto';

@ApiTags('Vendor Portal (External)')
@Controller('vendor-portal')
export class VendorPortalController {
  constructor(private readonly vendorPortalService: VendorPortalService) {}

  @Post('auth/login')
  @ApiOperation({ summary: 'Supplier login with tenant slug, email, and portal access key' })
  login(@Body() dto: VendorPortalLoginDto) {
    return this.vendorPortalService.login(dto.tenantSlug, dto.email, dto.accessKey);
  }

  @UseGuards(VendorPortalGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get logged-in supplier profile' })
  getProfile(@Req() req: any) {
    return this.vendorPortalService.getProfile(req.vendor.id, req.user.tenantId);
  }

  @UseGuards(VendorPortalGuard)
  @Get('purchase-orders')
  @ApiOperation({ summary: 'List purchase orders sent to this supplier' })
  listPurchaseOrders(@Req() req: any) {
    return this.vendorPortalService.listPurchaseOrders(
      req.vendor.id,
      req.user.tenantId,
    );
  }

  @UseGuards(VendorPortalGuard)
  @Get('purchase-orders/:id')
  @ApiOperation({ summary: 'Get purchase order detail' })
  getPurchaseOrder(@Req() req: any, @Param('id') id: string) {
    return this.vendorPortalService.getPurchaseOrder(
      req.vendor.id,
      req.user.tenantId,
      id,
    );
  }

  @UseGuards(VendorPortalGuard)
  @Post('purchase-orders/:id/acknowledge')
  @ApiOperation({ summary: 'Supplier acknowledges PO and optionally sets expected delivery' })
  acknowledge(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: AcknowledgePoDto,
  ) {
    return this.vendorPortalService.acknowledgePurchaseOrder(
      req.vendor.id,
      req.user.tenantId,
      id,
      dto,
    );
  }
}
