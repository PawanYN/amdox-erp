import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { prisma, InvoiceStatus } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateInvoiceDto, InvoiceType } from '../dto/create-invoice.dto';
import { RecordPaymentDto } from '../dto/record-payment.dto';
import { RunPaymentBatchDto } from '../dto/run-payment-batch.dto';
import { InvoiceMatchingService } from './invoice-matching.service';
import { OcrService } from './ocr.service';
import { StorageService } from '../../infrastructure/common/storage/storage.service';
import { SearchService } from '../../infrastructure/search/search.service';
import { QUEUE_NAMES } from '../../infrastructure/queues/queue-names';

interface InvoiceApprovedEvent {
  tenantId: string;
  invoiceId: string;
  projectId?: string | null;
  totalAmount?: number;
  invoiceNumber?: string;
  userId?: string;
}

interface PaymentMadeEvent {
  tenantId: string;
  paymentId: string;
  invoiceId: string;
  amount: number;
  bankReference?: string;
  userId?: string;
}

export interface PaymentRunResult {
  invoiceId: string;
  status: 'PAID' | 'FAILED';
  amount?: number;
  paymentId?: string;
  error?: string;
}

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
  constructor(
    private readonly invoiceMatchingService: InvoiceMatchingService,
    private readonly ocrService: OcrService,
    private readonly eventEmitter: EventEmitter2,
    private readonly storageService: StorageService,
    private readonly searchService: SearchService,
    @InjectQueue(QUEUE_NAMES.FINANCE_OUTBOX) private readonly outboxQueue: Queue,
  ) {}

  /**
   * Retrieves all AP invoices for a tenant.
   */
  async getInvoices(tenantId: string) {
    return prisma.invoice.findMany({
      where: { tenantId, type: 'AP' },
      include: { lines: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * WHAT: Processes an uploaded invoice document by extracting data via OCR and saving it.
   * WHY: Automates manual data entry (F-03 requirement) allowing for auto-approval if the
   * extracted data matches a Goods Receipt and Purchase Order perfectly.
   */
  async processInvoiceDocument(
    tenantId: string,
    documentBuffer: Buffer,
    goodsReceiptId?: string,
    contentType = 'application/octet-stream',
  ) {
    const { data: ocrData, confidenceScore } =
      await this.ocrService.extractInvoiceData(documentBuffer);

    // We will save it to the DB as pending match initially
    const invoice = await this.createInvoice(tenantId, ocrData, confidenceScore, goodsReceiptId);

    // Persist the original document so it can be retrieved later — the
    // invoice's own ID makes a natural, collision-proof object key.
    const documentKey = `invoices/${tenantId}/${invoice.id}/original`;
    await this.storageService.upload(documentKey, documentBuffer, contentType);
    await prisma.invoice.update({ where: { id: invoice.id }, data: { documentKey } });

    return { ...invoice, documentKey };
  }

  /**
   * Streams the original uploaded document for an AP invoice back out of
   * storage. Tenant-scoped: the invoice lookup (not just the storage key)
   * enforces that a caller can only ever fetch their own tenant's document.
   */
  async getInvoiceDocument(tenantId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, type: 'AP' },
      select: { documentKey: true },
    });
    if (!invoice?.documentKey) {
      throw new NotFoundException('No document stored for this invoice.');
    }
    return this.storageService.download(invoice.documentKey);
  }

  /**
   * WHAT: Creates an AP Invoice manually or from OCR.
   * WHY: Central creation logic that handles the 3-way match attempt within a database transaction.
   * If purchaseOrderId is present and goodsReceiptId is provided, it attempts a 3-way match.
   */
  async createInvoice(
    tenantId: string,
    dto: CreateInvoiceDto,
    ocrConfidence?: number,
    goodsReceiptId?: string,
  ) {
    if (dto.type !== InvoiceType.AP) {
      throw new Error('AP Service only handles AP invoices.');
    }

    // Wrap in a transaction to safely handle the Outbox pattern
    let approvalEvent: InvoiceApprovedEvent | null = null;
    let outboxEventId: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      const initialStatus: InvoiceStatus = 'PENDING_MATCH';
      let projectId: string | undefined;

      if (dto.purchaseOrderId) {
        const poForProject = await tx.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, tenantId },
          select: { projectId: true },
        });
        projectId = poForProject?.projectId ?? undefined;
      }

      const invoice = await tx.invoice.create({
        data: {
          tenantId,
          type: dto.type,
          invoiceNumber: dto.invoiceNumber,
          vendorId: dto.vendorId,
          purchaseOrderId: dto.purchaseOrderId,
          projectId,
          currencyId: dto.currencyId,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          totalAmount: dto.totalAmount,
          ocrConfidence: ocrConfidence,
          status: initialStatus,
          lines: {
            create: dto.lines.map((line) => ({
              tenantId,
              description: line.description,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              lineTotal: line.lineTotal,
              productId: line.productId,
            })),
          },
        },
        include: { lines: true },
      });

      // Attempt 3-way match if we have the necessary references. Fetched via
      // `tx` (not the global `prisma`) so this sees `invoice`, created earlier
      // in this same still-open transaction.
      if (dto.purchaseOrderId && goodsReceiptId) {
        const po = await tx.purchaseOrder.findFirst({
          where: { id: dto.purchaseOrderId, tenantId },
          include: { lines: true },
        });
        const gr = await tx.goodsReceipt.findFirst({ where: { id: goodsReceiptId, tenantId } });

        const matchResult = this.invoiceMatchingService.performThreeWayMatch({
          invoiceVendorId: dto.vendorId,
          invoiceTotal: invoice.totalAmount.toNumber(),
          invoiceLines: invoice.lines.map((l) => ({
            productId: l.productId,
            quantity: l.quantity.toNumber(),
            unitPrice: l.unitPrice.toNumber(),
          })),
          po: po
            ? {
                id: po.id,
                vendorId: po.vendorId,
                totalAmount: po.totalAmount?.toNumber() ?? 0,
                lines: po.lines.map((l) => ({
                  productId: l.productId,
                  quantity: l.quantity.toNumber(),
                  unitPrice: l.unitPrice.toNumber(),
                  receivedQuantity: l.receivedQuantity.toNumber(),
                })),
              }
            : null,
          gr: gr ? { purchaseOrderId: gr.purchaseOrderId } : null,
        });

        if (matchResult.matched) {
          // MATCH SUCCESSFUL -> Auto-approve
          this.logger.log(
            `Invoice ${invoice.id} matched successfully (${matchResult.mode})! Auto-approving.`,
          );

          // tenant-scope-ok: `invoice` was created earlier in this same transaction, scoped to `tenantId`.
          const approvedInvoice = await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'APPROVED',
              matchedAt: new Date(),
            },
          });

          approvalEvent = {
            tenantId,
            invoiceId: approvedInvoice.id,
            projectId: invoice.projectId,
            totalAmount: Number(approvedInvoice.totalAmount),
            invoiceNumber: invoice.invoiceNumber,
          };

          // Outbox Pattern: durable event for BullMQ to process (audit, notifications)
          const outboxEvent = await tx.outboxEvent.create({
            data: {
              tenantId,
              eventType: 'invoice.approved',
              payload: {
                invoiceId: approvedInvoice.id,
                totalAmount: approvedInvoice.totalAmount,
              },
              status: 'PENDING',
            },
          });
          outboxEventId = outboxEvent.id;

          return approvedInvoice;
        } else {
          this.logger.log(`Invoice ${invoice.id} did not auto-approve: ${matchResult.reason}`);
        }
      }

      return invoice;
    });

    if (approvalEvent) {
      this.eventEmitter.emit('invoice.approved', approvalEvent);
    }
    if (outboxEventId) {
      await this.outboxQueue.add('process', { id: outboxEventId });
    }

    this.searchService.indexInvoice(result);
    return result;
  }

  /**
   * WHAT: Auto-generates an AP invoice from a goods receipt and attempts 3-way match.
   * WHY: Shared entry point for sync event bridge and async BullMQ worker (idempotent).
   */
  async createInvoiceFromGoodsReceipt(
    tenantId: string,
    purchaseOrderId: string,
    goodsReceiptId: string,
  ) {
    const existing = await prisma.invoice.findFirst({
      where: { tenantId, type: 'AP', purchaseOrderId },
    });
    if (existing) {
      this.logger.log(
        `AP invoice already exists for PO ${purchaseOrderId}; skipping auto-generation`,
      );
      return existing;
    }

    const po = await prisma.purchaseOrder.findFirst({
      where: { id: purchaseOrderId, tenantId },
      include: { lines: { include: { product: true } } },
    });
    if (!po) {
      throw new NotFoundException(`Purchase order ${purchaseOrderId} not found`);
    }

    // Invoice only what has actually arrived so far — for a partial receipt,
    // lines with nothing received yet don't belong on this invoice. Carrying
    // productId through (known here, unlike free-text OCR lines) is what lets
    // the 3-way match below check quantity/price per product instead of just
    // comparing two grand totals.
    const receivedLines = po.lines.filter((line) => Number(line.receivedQuantity) > 0);

    return this.createInvoice(
      tenantId,
      {
        type: InvoiceType.AP,
        invoiceNumber: `INV-AUTO-${Date.now()}`,
        vendorId: po.vendorId,
        purchaseOrderId: po.id,
        issueDate: new Date(),
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount: receivedLines.reduce(
          (sum, line) => sum + Number(line.receivedQuantity) * Number(line.unitPrice),
          0,
        ),
        lines: receivedLines.map((line) => ({
          description: `${line.product?.name ?? 'Product'} (${line.product?.sku ?? line.productId})`,
          productId: line.productId,
          quantity: Number(line.receivedQuantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Number(line.receivedQuantity) * Number(line.unitPrice),
        })),
      },
      undefined,
      goodsReceiptId,
    );
  }

  /**
   * WHAT: Manually approves an AP Invoice and emits approval events.
   * WHY: Fallback for when the automatic 3-way match fails (e.g., tolerance exceeded or missing GR).
   */
  async manuallyApproveInvoice(tenantId: string, invoiceId: string, actingUserId?: string) {
    let approvalEvent: InvoiceApprovedEvent | null = null;
    let outboxEventId: string | null = null;

    const approvedInvoice = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: invoiceId, tenantId, type: 'AP' },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');

      // tenant-scope-ok: `invoice` was just found via a tenantId-scoped findFirst above.
      const updated = await tx.invoice.update({
        where: { id: invoice.id },
        data: { status: 'APPROVED', matchedAt: new Date() },
      });

      approvalEvent = {
        tenantId,
        invoiceId: updated.id,
        projectId: invoice.projectId,
        totalAmount: Number(updated.totalAmount),
        invoiceNumber: invoice.invoiceNumber,
        userId: actingUserId,
      };

      const outboxEvent = await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'invoice.approved',
          payload: { invoiceId: updated.id, totalAmount: updated.totalAmount },
          status: 'PENDING',
        },
      });
      outboxEventId = outboxEvent.id;

      return updated;
    });

    if (approvalEvent) {
      this.eventEmitter.emit('invoice.approved', approvalEvent);
    }
    if (outboxEventId) {
      await this.outboxQueue.add('process', { id: outboxEventId });
    }

    this.searchService.indexInvoice(approvedInvoice);
    return approvedInvoice;
  }

  /**
   * WHAT: Cancels/voids an AP invoice that hasn't entered the books yet.
   * WHY: A typo'd or duplicate invoice previously sat as PENDING_MATCH forever.
   * Only pre-approval invoices can be cancelled — an APPROVED invoice has
   * already posted Dr Inventory / Cr AP to the GL, so voiding it silently
   * would desync the ledger (it needs a reversal entry instead).
   */
  async cancelInvoice(tenantId: string, invoiceId: string, reason?: string, actingUserId?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, tenantId, type: 'AP' },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    if (invoice.status === 'CANCELLED') {
      throw new BadRequestException('This invoice is already cancelled.');
    }
    if (invoice.status !== 'DRAFT' && invoice.status !== 'PENDING_MATCH') {
      throw new BadRequestException(
        `Cannot cancel an invoice in status ${invoice.status} — it is already in the ledger. ` +
          'Post a reversal journal entry instead.',
      );
    }

    // tenant-scope-ok: `invoice` was just found via a tenantId-scoped findFirst above.
    const cancelled = await prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: 'CANCELLED' },
    });

    this.eventEmitter.emit('invoice.cancelled', {
      tenantId,
      invoiceId,
      invoiceNumber: invoice.invoiceNumber,
      reason,
      userId: actingUserId,
    });
    this.logger.log(`AP invoice ${invoice.invoiceNumber} cancelled${reason ? ` (${reason})` : ''}`);

    return cancelled;
  }

  /**
   * WHAT: Records a disbursement against an outstanding AP invoice.
   * WHY: Approval alone never moved money — this is the step that actually pays a
   * vendor, reduces the payable balance, and triggers the GL event to debit
   * Accounts Payable and credit Cash.
   */
  async recordPayment(
    tenantId: string,
    dto: RecordPaymentDto,
    actingUserId?: string,
    paymentRunId?: string,
  ) {
    let paymentEvent: PaymentMadeEvent | null = null;
    let outboxEventId: string | null = null;

    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: dto.invoiceId, tenantId, type: 'AP' },
        include: { payments: true },
      });
      if (!invoice) throw new NotFoundException('AP Invoice not found.');
      if (invoice.status !== 'APPROVED' && invoice.status !== 'PARTIALLY_PAID') {
        throw new BadRequestException(
          `Invoice must be APPROVED before payment (current status: ${invoice.status}).`,
        );
      }

      const payment = await tx.payment.create({
        data: {
          tenantId,
          invoiceId: dto.invoiceId,
          paymentRunId,
          amount: dto.amount,
          bankReference: dto.bankReference,
          status: 'COMPLETED',
          paidAt: new Date(),
        },
      });

      const priorPaid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
      const totalPaid = priorPaid + dto.amount;
      const invoiceTotal = invoice.totalAmount.toNumber();

      let newStatus: InvoiceStatus = invoice.status;
      if (totalPaid >= invoiceTotal) {
        newStatus = 'PAID';
      } else if (totalPaid > 0) {
        newStatus = 'PARTIALLY_PAID';
      }

      // tenant-scope-ok: `invoice` was just found via a tenantId-scoped findFirst above.
      await tx.invoice.update({ where: { id: invoice.id }, data: { status: newStatus } });

      paymentEvent = {
        tenantId,
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: dto.amount,
        bankReference: dto.bankReference,
        userId: actingUserId,
      };

      const outboxEvent = await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'payment.made',
          payload: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            amount: payment.amount,
            bankReference: dto.bankReference,
          },
          status: 'PENDING',
        },
      });
      outboxEventId = outboxEvent.id;

      return {
        payment,
        reconciliation: {
          invoiceTotal,
          totalPaid,
          balanceDue: Math.max(invoiceTotal - totalPaid, 0),
          status: newStatus,
        },
      };
    });

    if (paymentEvent) {
      this.eventEmitter.emit('payment.made', paymentEvent);
    }
    if (outboxEventId) {
      await this.outboxQueue.add('process', { id: outboxEventId });
    }

    return result;
  }

  /**
   * WHAT: Batch-pays a set of approved AP invoices in full (the actual "payment run").
   * WHY: `approve()` only ever authorized an invoice for payment — nothing previously
   * moved it to PAID or disbursed cash. This settles each selected invoice's remaining
   * balance in one call, continuing past individual failures so one bad invoice ID
   * doesn't block the rest of the run.
   */
  async runPaymentBatch(tenantId: string, dto: RunPaymentBatchDto, actingUserId?: string) {
    const paymentRun = await prisma.paymentRun.create({
      data: {
        tenantId,
        runDate: new Date(),
        description: dto.description,
      },
    });

    const results: PaymentRunResult[] = [];

    // Fetch every candidate invoice in one round-trip instead of one findFirst
    // per invoiceId in the loop below (N+1) — the per-invoice write logic still
    // runs individually since each payment is its own financial transaction.
    const invoices = await prisma.invoice.findMany({
      where: { id: { in: dto.invoiceIds }, tenantId, type: 'AP' },
      include: { payments: true },
    });
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));

    for (const invoiceId of dto.invoiceIds) {
      try {
        const invoice = invoiceById.get(invoiceId);
        if (!invoice) throw new NotFoundException('AP Invoice not found.');
        if (invoice.status !== 'APPROVED' && invoice.status !== 'PARTIALLY_PAID') {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber} is not APPROVED (status: ${invoice.status}).`,
          );
        }

        const priorPaid = invoice.payments.reduce((sum, p) => sum + p.amount.toNumber(), 0);
        const balanceDue = invoice.totalAmount.toNumber() - priorPaid;
        if (balanceDue <= 0) {
          throw new BadRequestException(
            `Invoice ${invoice.invoiceNumber} has no outstanding balance.`,
          );
        }

        const paid = await this.recordPayment(
          tenantId,
          { invoiceId, amount: balanceDue, bankReference: dto.bankReference },
          actingUserId,
          paymentRun.id,
        );

        results.push({ invoiceId, status: 'PAID', amount: balanceDue, paymentId: paid.payment.id });
      } catch (error) {
        results.push({ invoiceId, status: 'FAILED', error: (error as Error).message });
      }
    }

    return {
      paymentRunId: paymentRun.id,
      processed: results.length,
      paidCount: results.filter((r) => r.status === 'PAID').length,
      failedCount: results.filter((r) => r.status === 'FAILED').length,
      totalPaid: results.reduce((sum, r) => sum + (r.amount ?? 0), 0),
      results,
    };
  }
}
