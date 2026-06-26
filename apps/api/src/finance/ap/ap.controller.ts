import { Controller, Post, Body, Param, UseInterceptors, UploadedFile, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ApService } from './ap.service';
import { CreateInvoiceDto } from '../dto/create-invoice.dto';

/**
 * Controller for Accounts Payable (AP) operations.
 * Handles the creation, OCR processing, and approval of vendor invoices.
 */
@ApiTags('Accounts Payable')
@ApiBearerAuth()
@UseGuards(AuthGuard('keycloak'), RolesGuard)
@Controller('finance/ap/invoices')
export class ApController {
  constructor(private readonly apService: ApService) {}

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
    @Body('goodsReceiptId') goodsReceiptId?: string
  ) {
    return this.apService.createInvoice(req.user.tenantId, createInvoiceDto, undefined, goodsReceiptId);
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
    @UploadedFile() document: any // bypassed Express.Multer.File to avoid needing @types/multer
  ) {
    return this.apService.processInvoiceDocument(req.user.tenantId, document.buffer, goodsReceiptId);
  }

  /**
   * Manually approves an AP Invoice if the 3-way match failed or manual override is needed.
   * Triggers the 'invoice.approved' domain event for GL posting.
   */
  @Roles('Manager', 'TenantAdmin')
  @Post(':id/approve')
  @ApiOperation({ summary: 'Manually approve an AP invoice' })
  async manuallyApproveInvoice(
    @Param('id') invoiceId: string,
    @Req() req: any
  ) {
    return this.apService.manuallyApproveInvoice(req.user.tenantId, invoiceId);
  }
}
