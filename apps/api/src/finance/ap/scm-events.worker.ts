import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ApService } from './ap.service';

@Processor('scm-events')
export class ScmEventsWorker extends WorkerHost {
  private readonly logger = new Logger(ScmEventsWorker.name);

  constructor(private readonly apService: ApService) {
    super();
  }

  async process(job: Job<any>): Promise<any> {
    if (job.name === 'goods.received') {
      const { tenantId, purchaseOrderId, goodsReceiptId } = job.data;
      this.logger.log(`Processing goods.received for PO ${purchaseOrderId}`);
      
      try {
        await this.apService.createInvoiceFromGoodsReceipt(
          tenantId,
          purchaseOrderId,
          goodsReceiptId,
        );
        this.logger.log(
          `AP Invoice auto-generated and 3-way match attempted for PO ${purchaseOrderId}`,
        );
      } catch (err) {
        this.logger.error(`Failed to auto-generate Invoice for PO ${purchaseOrderId}`, err);
      }
    }
  }
}
