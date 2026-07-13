/**
 * ============================================================================
 * SERVICE: purchase.service.ts
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This service controls the complete Purchasing Lifecycle.
 * It manages Purchase Orders (POs) and Goods Receipts (GRs).
 *
 * HOW IT IS IMPLEMENTED:
 * - `createPurchaseOrder`: Generates a unique PO number, maps the nested `lines`
 *   DTO into the Prisma relation, and automatically calculates the `totalAmount`
 *   by doing `quantity * unitPrice` for each line.
 * - `receiveGoods`: This is a massive, highly-critical database transaction.
 *   When goods arrive at the physical warehouse:
 *   1. It ensures the PO is APPROVED.
 *   2. It creates a `GoodsReceipt` record for auditing.
 *   3. It mathematically loops through EVERY line on the Purchase Order.
 *   4. For each line, it creates a `StockMovement` (type: RECEIPT).
 *   5. It looks up the `StockLevel` in the selected warehouse and upserts it
 *      to reflect the newly added quantity.
 *   6. Finally, it marks the Purchase Order status as RECEIVED.
 *   Because this is wrapped in `prisma.$transaction()`, if ANY step fails
 *   (e.g., database drops connection), the entire process rolls back safely!
 *
 * RELEVANT CONTEXT FOR NEW DEVS:
 * This file replaces the older boilerplate `po.service.ts` and `gr.service.ts`
 * to ensure that POs and GRs are tightly coupled and updated safely within
 * single transactions.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { prisma } from '@amdox/db';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from '../dto/receive-goods.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VendorPortalService } from '../vendor-portal/vendor-portal.service';
import { EmailChannel } from '../../notification/channels/email.channel';
import { AmdoxLogger } from '../../common/logger/amdox-logger';
import { SearchService } from '../../search/search.service';

@Injectable()
export class PurchaseService {
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    private vendorPortalService: VendorPortalService,
    private emailChannel: EmailChannel,
    private readonly searchService: SearchService,
  ) {}

  // --- Purchase Orders ---
  async createPurchaseOrder(tenantId: string, dto: CreatePurchaseOrderDto) {
    const totalAmount = dto.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const poNumber = `PO-${Date.now()}`;

    let projectId = dto.projectId;
    if (dto.requisitionId) {
      const requisition = await prisma.purchaseRequisition.findFirst({
        where: { id: dto.requisitionId, tenantId },
      });
      if (requisition?.projectId) {
        projectId = requisition.projectId;
      }
    }

    const result = await prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        vendorId: dto.vendorId,
        requisitionId: dto.requisitionId,
        projectId,
        status: 'SUBMITTED', // Or DRAFT
        totalAmount,
        orderedAt: new Date(),
        lines: {
          create: dto.lines.map((line) => ({
            tenantId,
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
          })),
        },
      },
      include: { lines: true },
    });
    this.searchService.indexPurchaseOrder(result);
    return result;
  }

  async getGoodsReceipts(tenantId: string) {
    return prisma.goodsReceipt.findMany({
      where: { tenantId },
      include: {
        purchaseOrder: {
          select: {
            poNumber: true,
            totalAmount: true,
            vendor: { select: { name: true } },
          },
        },
      },
      orderBy: { receivedAt: 'desc' },
    });
  }

  async getPurchaseOrders(tenantId: string) {
    return prisma.purchaseOrder.findMany({
      where: { tenantId },
      include: {
        vendor: true,
        lines: true,
        project: { select: { id: true, name: true } },
        requisition: { select: { id: true, reason: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPurchaseOrder(tenantId: string, id: string) {
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, tenantId },
      include: { vendor: true, lines: { include: { product: true } }, goodsReceipts: true },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async approvePurchaseOrder(tenantId: string, id: string, actingUserId?: string) {
    const po = await this.getPurchaseOrder(tenantId, id);
    // tenant-scope-ok: getPurchaseOrder() above already throws NotFoundException
    // unless `id` belongs to `tenantId`.
    const updatedPo = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
    });

    this.eventEmitter.emit('po.created', {
      tenantId,
      poId: id,
      poNumber: updatedPo.poNumber,
      vendorId: po.vendorId,
      userId: actingUserId,
    });
    this.searchService.indexPurchaseOrder(updatedPo);
    AmdoxLogger.scm(
      `PO approved`,
      `poNumber=${updatedPo.poNumber}  total=${updatedPo.totalAmount}`,
    );
    AmdoxLogger.event('Emitted po.created', `poId=${id}`);

    if (po.vendor?.webhookUrl) {
      await this.vendorPortalService.notifyVendorWebhook(po.vendor.webhookUrl, {
        event: 'po.approved',
        tenantId,
        poId: id,
        poNumber: updatedPo.poNumber,
        totalAmount: Number(updatedPo.totalAmount),
        portalUrl: '/vendor-portal',
        message: `Purchase order ${updatedPo.poNumber} is ready for supplier acknowledgement`,
      });
    }

    if (po.vendor?.email) {
      await this.emailChannel.send({
        to: po.vendor.email,
        subject: `PO ${updatedPo.poNumber} approved`,
        body: `Purchase order ${updatedPo.poNumber} (total ${updatedPo.totalAmount}) has been approved. Please acknowledge via the vendor portal.`,
      });
    }

    return updatedPo;
  }

  /**
   * WHAT: Cancels a PO that hasn't been received yet.
   * WHY: A wrongly-created or duplicate PO previously sat in the list forever —
   * users worked around it by creating a second one, which is how duplicate
   * orders start. Received POs can't be cancelled (stock already moved).
   */
  async cancelPurchaseOrder(tenantId: string, id: string, reason?: string, actingUserId?: string) {
    const po = await this.getPurchaseOrder(tenantId, id);
    if (po.status === 'RECEIVED' || po.status === 'PARTIALLY_RECEIVED' || po.status === 'CLOSED') {
      throw new BadRequestException(
        'This purchase order has already received goods and can no longer be cancelled.',
      );
    }
    if (po.status === 'CANCELLED') {
      throw new BadRequestException('This purchase order is already cancelled.');
    }

    // tenant-scope-ok: getPurchaseOrder() above throws unless `id` belongs to `tenantId`.
    const cancelled = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    this.eventEmitter.emit('po.cancelled', {
      tenantId,
      poId: id,
      poNumber: cancelled.poNumber,
      reason,
      userId: actingUserId,
    });
    AmdoxLogger.scm(
      `PO cancelled`,
      `poNumber=${cancelled.poNumber}${reason ? `  reason=${reason}` : ''}`,
    );

    return cancelled;
  }

  // --- Goods Receipt ---
  async receiveGoods(tenantId: string, id: string, dto: ReceiveGoodsDto, actingUserId?: string) {
    const result = await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { lines: true },
      });

      if (!po) throw new NotFoundException('PO not found');
      if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException('Cannot receive goods for unapproved PO');
      }

      // dto.warehouseId is caller-supplied — without this check, a caller could name
      // another tenant's warehouse and this loop would read/write that tenant's
      // StockLevel rows (StockLevel's unique key is productId+warehouseId only, with
      // no tenantId component, so a plain findUnique below can't catch this itself).
      const warehouse = await tx.warehouse.findFirst({
        where: { id: dto.warehouseId, tenantId },
      });
      if (!warehouse) throw new NotFoundException('Warehouse not found');

      // Resolve how much of each line to receive in this event. No `dto.lines` means
      // "receive everything still outstanding" — the one-click behaviour every
      // pre-existing caller (UI, E2E smoke test) already relies on.
      const linesToReceive: Array<{
        line: (typeof po.lines)[number];
        quantity: number;
      }> = [];

      if (dto.lines && dto.lines.length > 0) {
        for (const requested of dto.lines) {
          const line = po.lines.find((l) => l.id === requested.purchaseOrderLineId);
          if (!line) {
            throw new BadRequestException(
              `PO line ${requested.purchaseOrderLineId} does not belong to this PO`,
            );
          }
          const remaining = Number(line.quantity) - Number(line.receivedQuantity);
          if (requested.quantity > remaining + 1e-6) {
            throw new BadRequestException(
              `Cannot receive ${requested.quantity} for line ${line.id} — only ${remaining} remains outstanding`,
            );
          }
          if (requested.quantity > 0) linesToReceive.push({ line, quantity: requested.quantity });
        }
      } else {
        for (const line of po.lines) {
          const remaining = Number(line.quantity) - Number(line.receivedQuantity);
          if (remaining > 1e-6) linesToReceive.push({ line, quantity: remaining });
        }
      }

      if (linesToReceive.length === 0) {
        throw new BadRequestException('Nothing outstanding to receive on this PO');
      }

      // 1. Create Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId,
          purchaseOrderId: id,
          warehouseId: dto.warehouseId,
          notes: dto.notes,
        },
      });

      // 2. Loop through the lines being received and update stock + FIFO cost layers
      for (const { line, quantity } of linesToReceive) {
        // Per-delivery record: what arrived in THIS receipt, for this line —
        // the audit trail behind the running total on the PO line, and what
        // makes "received 60 of 100" a queryable fact rather than a status label.
        await tx.goodsReceiptLine.create({
          data: {
            tenantId,
            goodsReceiptId: receipt.id,
            purchaseOrderLineId: line.id,
            productId: line.productId,
            quantity,
          },
        });

        await tx.purchaseOrderLine.update({
          where: { id: line.id },
          data: { receivedQuantity: { increment: quantity } },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: line.productId,
            warehouseId: dto.warehouseId,
            type: 'RECEIPT',
            quantity,
            reference: `GR-${receipt.id}`,
          },
        });

        await tx.inventoryCostLayer.create({
          data: {
            tenantId,
            productId: line.productId,
            warehouseId: dto.warehouseId,
            goodsReceiptId: receipt.id,
            quantity,
            remainingQty: quantity,
            unitCost: line.unitPrice,
          },
        });

        // tenant-scope-ok: line.productId comes from po.lines, and `po` above was
        // fetched scoped to `tenantId` — products referenced by a tenant's own PO
        // lines belong to that tenant.
        await tx.product.update({
          where: { id: line.productId },
          data: { unitCost: line.unitPrice },
        });

        // tenant-scope-ok: StockLevel's unique key is productId+warehouseId with no
        // tenantId component, but both productId (see above) and warehouseId (verified
        // against `tenantId` earlier in this transaction) are already tenant-safe.
        const existingLevel = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        if (existingLevel) {
          // tenant-scope-ok: existingLevel was just found via the tenant-safe lookup above.
          await tx.stockLevel.update({
            where: { id: existingLevel.id },
            data: { quantity: Number(existingLevel.quantity) + quantity },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              productId: line.productId,
              warehouseId: dto.warehouseId,
              quantity,
            },
          });
        }
      }

      // 3. Mark the PO RECEIVED only once every line is fully received;
      // otherwise it's PARTIALLY_RECEIVED (F-04 roadmap item — was previously
      // full-order-receipt-only, this is the schema change that unlocks it).
      const receivedIncrementByLine = new Map(linesToReceive.map((r) => [r.line.id, r.quantity]));
      const allLinesFullyReceived = po.lines.every((l) => {
        const newTotal = Number(l.receivedQuantity) + (receivedIncrementByLine.get(l.id) ?? 0);
        return newTotal >= Number(l.quantity) - 1e-6;
      });

      // tenant-scope-ok: `po` was fetched scoped to `tenantId` at the top of this transaction.
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: allLinesFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED' },
      });

      // 4. Trigger AI Forecasting pipeline placeholder
      AmdoxLogger.scm('AI forecast re-eval queued (Prophet/LSTM)', `po=${po.poNumber}`);

      return receipt;
    });

    // 5. Notify Finance to auto-generate the AP invoice + run the 3-way match.
    // NOTE: this is dispatched through the synchronous in-process event bus ONLY.
    // Previously it was ALSO enqueued on the `scm-events` BullMQ queue, so both the
    // ScmEventsWorker and the ScmFinanceBridgeListener called createInvoiceFromGoodsReceipt
    // for the same goods receipt. They raced past the "already exists" idempotency check
    // and created TWO approved AP invoices per receipt (double GL/budget posting). The
    // queue path has been removed so exactly one invoice is created per goods receipt.
    this.eventEmitter.emit('goods.received', {
      tenantId,
      purchaseOrderId: id,
      goodsReceiptId: result.id,
      userId: actingUserId,
    });
    AmdoxLogger.scm(`Goods received`, `poId=${id}  grId=${result.id}`);
    AmdoxLogger.event('Emitted goods.received → AP invoice + GL chain triggered');

    prisma.purchaseOrder
      .findFirst({ where: { id, tenantId }, include: { vendor: true } })
      .then((po) => {
        if (po) this.searchService.indexPurchaseOrder(po);
      })
      .catch(() => {});

    return result;
  }
}
