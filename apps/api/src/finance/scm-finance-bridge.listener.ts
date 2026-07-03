import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApService } from './ap/ap.service';

/**
 * Synchronous SCM → Finance bridge for goods receipt.
 * Ensures 3-way match + GL posting work without relying on BullMQ/Redis.
 */
@Injectable()
export class ScmFinanceBridgeListener {
  private readonly logger = new Logger(ScmFinanceBridgeListener.name);

  constructor(private readonly apService: ApService) {}

  @OnEvent('goods.received')
  async onGoodsReceived(payload: {
    tenantId: string;
    purchaseOrderId: string;
    goodsReceiptId: string;
  }) {
    try {
      await this.apService.createInvoiceFromGoodsReceipt(
        payload.tenantId,
        payload.purchaseOrderId,
        payload.goodsReceiptId,
      );
    } catch (err) {
      this.logger.error(
        `Failed AP invoice generation for PO ${payload.purchaseOrderId}`,
        err,
      );
    }
  }
}
