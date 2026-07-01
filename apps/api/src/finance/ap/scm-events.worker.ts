import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ApService } from './ap.service';
import { PrismaClient } from '@amdox/db';
import { InvoiceType } from '../dto/create-invoice.dto';

@Processor('scm-events')
export class ScmEventsWorker extends WorkerHost {
  private readonly logger = new Logger(ScmEventsWorker.name);
  private prisma = new PrismaClient();

  constructor(private readonly apService: ApService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'goods.received') {
      const { tenantId, purchaseOrderId, goodsReceiptId } = job.data;
      this.logger.log(`Processing goods.received for PO ${purchaseOrderId}`);
      
      const po = await this.prisma.purchaseOrder.findUnique({
        where: { id: purchaseOrderId },
        include: { lines: true }
      });

      if (!po) {
        this.logger.error(`PO ${purchaseOrderId} not found.`);
        return;
      }

      try {
        // Auto-generate AP Invoice based on the PO data to trigger the 3-Way Match
        await this.apService.createInvoice(
          tenantId,
          {
            type: InvoiceType.AP,
            invoiceNumber: `INV-AUTO-${Date.now()}`,
            vendorId: po.vendorId,
            purchaseOrderId: po.id,
            currencyId: undefined as any,
            issueDate: new Date(),
            dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            totalAmount: po.totalAmount as any,
            lines: po.lines.map(l => ({
              description: `Auto-generated for Product ${l.productId}`,
              quantity: l.quantity as any,
              unitPrice: l.unitPrice as any,
              lineTotal: (Number(l.quantity) * Number(l.unitPrice)) as any
            }))
          },
          undefined,
          goodsReceiptId
        );
        this.logger.log(`AP Invoice auto-generated and 3-way match attempted for PO ${purchaseOrderId}`);
      } catch (err) {
        this.logger.error(`Failed to auto-generate Invoice for PO ${purchaseOrderId}`, err);
      }
    }
  }
}
