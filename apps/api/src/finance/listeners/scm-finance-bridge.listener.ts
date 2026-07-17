import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ApService } from '../ap/ap.service';
import { AmdoxLogger } from '../../infrastructure/common/logger/amdox-logger';

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
    AmdoxLogger.event('goods.received → AP invoice creation', `po=${payload.purchaseOrderId}`);
    try {
      await this.apService.createInvoiceFromGoodsReceipt(
        payload.tenantId,
        payload.purchaseOrderId,
        payload.goodsReceiptId,
      );
      AmdoxLogger.scm(
        'AP invoice auto-created from GR',
        `po=${payload.purchaseOrderId}  gr=${payload.goodsReceiptId}`,
      );
    } catch (err) {
      AmdoxLogger.critical(
        `AP invoice generation failed for PO ${payload.purchaseOrderId}`,
        (err as Error).message,
      );
    }
  }
}
