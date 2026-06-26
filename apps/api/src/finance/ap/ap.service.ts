import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient, InvoiceStatus } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateInvoiceDto, InvoiceType } from '../dto/create-invoice.dto';
import { InvoiceMatchingService } from './invoice-matching.service';
import { OcrService } from './ocr.service';

/**
 * Service to handle Accounts Payable (AP) operations.
 * 
 * WHAT: This service manages the lifecycle of vendor invoices, from creation/OCR extraction
 * to approval and outbox event publishing.
 * WHY: We need a centralized place to enforce AP business logic, ensure transactions are atomic,
 * and guarantee domain events are reliably published for downstream modules (GL/Notifications).
 */
@Injectable()
export class ApService {
  private readonly logger = new Logger(ApService.name);
  private prisma = new PrismaClient();

  constructor(
    private readonly invoiceMatchingService: InvoiceMatchingService,
    private readonly ocrService: OcrService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * WHAT: Processes an uploaded invoice document by extracting data via OCR and saving it.
   * WHY: Automates manual data entry (F-03 requirement) allowing for auto-approval if the
   * extracted data matches a Goods Receipt and Purchase Order perfectly.
   */
  async processInvoiceDocument(tenantId: string, documentBuffer: Buffer, goodsReceiptId?: string) {
    const { data: ocrData, confidenceScore } = await this.ocrService.extractInvoiceData(documentBuffer);
    
    // We will save it to the DB as pending match initially
    return this.createInvoice(tenantId, ocrData, confidenceScore, goodsReceiptId);
  }

  /**
   * WHAT: Creates an AP Invoice manually or from OCR.
   * WHY: Central creation logic that handles the 3-way match attempt within a database transaction.
   * If purchaseOrderId is present and goodsReceiptId is provided, it attempts a 3-way match.
   */
  async createInvoice(tenantId: string, dto: CreateInvoiceDto, ocrConfidence?: number, goodsReceiptId?: string) {
    if (dto.type !== InvoiceType.AP) {
      throw new Error('AP Service only handles AP invoices.');
    }

    // Wrap in a transaction to safely handle the Outbox pattern
    return this.prisma.$transaction(async (tx) => {
      let initialStatus: InvoiceStatus = 'PENDING_MATCH';

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          type: dto.type,
          invoiceNumber: dto.invoiceNumber,
          vendorId: dto.vendorId,
          purchaseOrderId: dto.purchaseOrderId,
          currencyId: dto.currencyId,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          totalAmount: dto.totalAmount,
          ocrConfidence: ocrConfidence,
          status: initialStatus,
          lines: {
            create: dto.lines.map(line => ({
              tenantId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal
            }))
          }
        },
        include: { lines: true }
      });

      // Attempt 3-way match if we have the necessary references
      if (dto.purchaseOrderId && goodsReceiptId) {
        const po = await tx.purchaseOrder.findFirst({ where: { id: dto.purchaseOrderId, tenantId }});
        const gr = await tx.goodsReceipt.findFirst({ where: { id: goodsReceiptId, tenantId }});
        
        if (po && gr && po.vendorId === dto.vendorId && gr.purchaseOrderId === po.id) {
          const invoiceTotal = invoice.totalAmount.toNumber();
          const poTotal = po.totalAmount?.toNumber() || 0;
          const diff = poTotal === 0 ? 1 : Math.abs(invoiceTotal - poTotal) / poTotal;
          
          if (diff <= 0.02) {
            // MATCH SUCCESSFUL -> Auto-approve
            this.logger.log(`Invoice ${invoice.id} matched successfully! Auto-approving.`);
            
            const approvedInvoice = await tx.invoice.update({
              where: { id: invoice.id },
              data: {
                status: 'APPROVED',
                matchedAt: new Date()
              }
            });

            // 1. Emit domain event (in-memory, for immediate GL processing if configured)
            this.eventEmitter.emit('invoice.approved', {
              tenantId,
              invoiceId: approvedInvoice.id
            });

            // 2. Outbox Pattern: durable event for BullMQ to process (audit, notifications)
            await tx.outboxEvent.create({
              data: {
                tenantId,
                eventType: 'invoice.approved',
                payload: { invoiceId: approvedInvoice.id, totalAmount: approvedInvoice.totalAmount },
                status: 'PENDING'
              }
            });

            return approvedInvoice;
          }
        }
      }

      return invoice;
    });
  }

  /**
   * WHAT: Manually approves an AP Invoice and emits approval events.
   * WHY: Fallback for when the automatic 3-way match fails (e.g., tolerance exceeded or missing GR).
   */
  async manuallyApproveInvoice(tenantId: string, invoiceId: string) {
    return this.prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({ where: { id: invoiceId, tenantId, type: 'AP' } });
      if (!invoice) throw new NotFoundException('Invoice not found');

      const approvedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'APPROVED', matchedAt: new Date() }
      });

      this.eventEmitter.emit('invoice.approved', { tenantId, invoiceId: approvedInvoice.id });

      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'invoice.approved',
          payload: { invoiceId: approvedInvoice.id, totalAmount: approvedInvoice.totalAmount },
          status: 'PENDING'
        }
      });

      return approvedInvoice;
    });
  }
}
