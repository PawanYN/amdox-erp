import { Controller, Post, Body, Get, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ArService } from './ar.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';

/**
 * Controller for Accounts Receivable (AR) operations.
 * Handles customer invoices, payments, and aging reports.
 */
@ApiTags('Accounts Receivable')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('finance/ar')
export class ArController {
  constructor(private readonly arService: ArService) {}

  /**
   * Generates a new receivable invoice for a customer.
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('invoices')
  @ApiOperation({ summary: 'Create a new AR Invoice' })
  async createInvoice(
    @Req() req: any, 
    @Body() createInvoiceDto: CreateInvoiceDto
  ) {
    return this.arService.createInvoice(req.user.tenantId, createInvoiceDto);
  }

  /**
   * Records a payment against an outstanding AR invoice.
   */
  @Roles('Manager', 'TenantAdmin', 'SuperAdmin')
  @Post('payments')
  @ApiOperation({ summary: 'Record a payment against an AR invoice' })
  async recordPayment(
    @Req() req: any,
    @Body() recordPaymentDto: RecordPaymentDto
  ) {
    return this.arService.recordPayment(req.user.tenantId, recordPaymentDto);
  }

  /**
   * Retrieves an aging report (0-30, 31-60, 61-90, 90+ days) for all outstanding AR invoices.
   */
  @Roles('Manager', 'TenantAdmin', 'SuperAdmin')
  @Get('aging-report')
  @ApiOperation({ summary: 'Retrieve AR Aging Report' })
  async getAgingReport(
    @Req() req: any
  ) {
    return this.arService.getAgingReport(req.user.tenantId);
  }
}
