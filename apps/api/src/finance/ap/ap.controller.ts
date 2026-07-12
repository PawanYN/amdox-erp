import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ModuleGuard } from '../../auth/guards/module.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RequireModule } from '../../auth/decorators/require-module.decorator';
import { ApService } from './ap.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { RunPaymentBatchDto } from '../dto/run-payment-batch.dto';

/**
 * Controller for Accounts Payable (AP) operations.
 * Handles the creation, OCR processing, and approval of vendor invoices.
 */
@ApiTags('Accounts Payable')
@ApiBearerAuth()
@RequireModule('finance')
@UseGuards(AuthGuard('keycloak'), RolesGuard, ModuleGuard)
@Controller('finance/ap/invoices')
export class ApController {
  constructor(private readonly apService: ApService) {}

  @Roles('Manager', 'TenantAdmin', 'Viewer')
  @Get()
  @ApiOperation({ summary: 'Get all AP invoices' })
  async getInvoices(@Req() req: any) {
    return this.apService.getInvoices(req.user.tenantId);
  }

  /**
   * Manually creates an AP Invoice.
   * If a goodsReceiptId is provided, it will automatically attempt a 3-way match.
   */
  @Roles('Manager', 'TenantAdmin')
  @Post()
  @ApiOperation({ summary: 'Create a new AP Invoice' })
  async createInvoice(
    @Req() req: any,
    @Body() createInvoiceDto: CreateInvoiceDto,
    @Body('goodsReceiptId') goodsReceiptId?: string,
  ) {
    return this.apService.createInvoice(
      req.user.tenantId,
      createInvoiceDto,
      undefined,
      goodsReceiptId,
    );
  }

  /**
   * Uploads an invoice document (PDF/Image) for OCR extraction.
   * F-03 AP Automation: Extracts data and optionally attempts a 3-way match immediately.
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('upload')
  @ApiOperation({ summary: 'Upload an invoice document for OCR' })
  @UseInterceptors(FileInterceptor('document'))
  async uploadInvoice(
    @Req() req: any,
    @Body('goodsReceiptId') goodsReceiptId: string,
    @UploadedFile() document: any, // bypassed Express.Multer.File to avoid needing @types/multer
  ) {
    return this.apService.processInvoiceDocument(
      req.user.tenantId,
      document.buffer,
      goodsReceiptId,
      document.mimetype,
    );
  }

  /**
   * Downloads the original uploaded invoice document (Tech Stack "File
   * Storage" gap — the file used for OCR is now durably persisted, not
   * discarded after extraction).
   */
  @Roles('Manager', 'TenantAdmin', 'Viewer')
  @Get(':id/document')
  @ApiOperation({ summary: 'Download the original invoice document' })
  async downloadInvoiceDocument(
    @Req() req: any,
    @Param('id') invoiceId: string,
    @Res() res: Response,
  ) {
    const buffer = await this.apService.getInvoiceDocument(req.user.tenantId, invoiceId);
    res.setHeader('Content-Disposition', `attachment; filename="invoice-${invoiceId}"`);
    res.send(buffer);
  }

  /**
   * Manually approves an AP Invoice if the 3-way match failed or manual override is needed.
   * Triggers the 'invoice.approved' domain event for GL posting.
   */
  @Roles('Manager', 'TenantAdmin')
  @Post(':id/approve')
  @ApiOperation({ summary: 'Manually approve an AP invoice' })
  async manuallyApproveInvoice(@Param('id') invoiceId: string, @Req() req: any) {
    return this.apService.manuallyApproveInvoice(
      req.user.tenantId,
      invoiceId,
      req.user.id ?? req.user.sub,
    );
  }

  /**
   * Cancels/voids an AP invoice that hasn't been paid yet, so a wrongly-entered
   * invoice doesn't sit as PENDING_MATCH forever (users previously worked around
   * it by creating a duplicate).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel an unpaid AP invoice' })
  async cancelInvoice(
    @Param('id') invoiceId: string,
    @Req() req: any,
    @Body('reason') reason?: string,
  ) {
    return this.apService.cancelInvoice(
      req.user.tenantId,
      invoiceId,
      reason,
      req.user.id ?? req.user.sub,
    );
  }

  /**
   * Records a single disbursement against an approved AP invoice.
   * Triggers the 'payment.made' domain event for GL posting (Dr AP Payable / Cr Cash).
   */
  @Roles('Manager', 'TenantAdmin')
  @Post('payments')
  @ApiOperation({ summary: 'Record a payment against an approved AP invoice' })
  async recordPayment(@Req() req: any, @Body() recordPaymentDto: RecordPaymentDto) {
    return this.apService.recordPayment(
      req.user.tenantId,
      recordPaymentDto,
      req.user.id ?? req.user.sub,
    );
  }

  /**
   * Batch-pays a set of approved AP invoices in full — the actual "payment run".
   * Continues past individual failures; returns a per-invoice result summary.
   */
  @Roles('TenantAdmin')
  @Post('payment-runs')
  @ApiOperation({ summary: 'Run a batch payment against a set of approved AP invoices' })
  async runPaymentBatch(@Req() req: any, @Body() runPaymentBatchDto: RunPaymentBatchDto) {
    return this.apService.runPaymentBatch(
      req.user.tenantId,
      runPaymentBatchDto,
      req.user.id ?? req.user.sub,
    );
  }
}
