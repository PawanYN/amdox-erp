import { Injectable, Logger } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaClient } from '@amdox/db';

interface InvoiceApprovedPayload {
  tenantId: string;
  invoiceId: string;
  projectId?: string | null;
  totalAmount?: number;
  invoiceNumber?: string;
}

/**
 * Bridges Finance AP approvals to PM budget actuals.
 * When an AP invoice linked to a project PO is approved, emits cost.reported
 * so BudgetService can update planned-vs-actual tracking.
 */
@Injectable()
export class PmCostBridgeListener {
  private readonly logger = new Logger(PmCostBridgeListener.name);
  private prisma = new PrismaClient();

  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('invoice.approved')
  async onInvoiceApproved(payload: InvoiceApprovedPayload) {
    let projectId = payload.projectId ?? null;
    let amount = payload.totalAmount ?? 0;
    let invoiceNumber = payload.invoiceNumber;

    if (!projectId || amount <= 0) {
      const invoice = await this.prisma.invoice.findFirst({
        where: { id: payload.invoiceId, tenantId: payload.tenantId, type: 'AP' },
        include: {
          purchaseOrder: { select: { projectId: true, poNumber: true } },
        },
      });

      if (!invoice) return;

      projectId =
        invoice.projectId ?? invoice.purchaseOrder?.projectId ?? null;
      amount = Number(invoice.totalAmount);
      invoiceNumber = invoice.invoiceNumber;
    }

    if (!projectId || amount <= 0) return;

    this.logger.log(
      `Emitting cost.reported for project ${projectId} from AP invoice ${invoiceNumber ?? payload.invoiceId}`,
    );

    this.eventEmitter.emit('cost.reported', {
      tenantId: payload.tenantId,
      projectId,
      amount,
      source: 'AP',
      sourceId: payload.invoiceId,
      description: `AP Invoice ${invoiceNumber ?? payload.invoiceId}`,
    });
  }
}
