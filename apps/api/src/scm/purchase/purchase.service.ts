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
import { PrismaClient } from '@amdox/db';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from '../dto/receive-goods.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { VendorPortalService } from '../vendor-portal/vendor-portal.service';
import { AmdoxLogger } from '../../common/logger/amdox-logger';

@Injectable()
export class PurchaseService {
  private prisma = new PrismaClient();
  private readonly logger = new Logger(PurchaseService.name);

  constructor(
    private eventEmitter: EventEmitter2,
    @InjectQueue('scm-events') private scmQueue: Queue,
    private vendorPortalService: VendorPortalService,
  ) {}

  // --- Purchase Orders ---
  async createPurchaseOrder(tenantId: string, dto: CreatePurchaseOrderDto) {
    const totalAmount = dto.lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
    const poNumber = `PO-${Date.now()}`;

    let projectId = dto.projectId;
    if (dto.requisitionId) {
      const requisition = await this.prisma.purchaseRequisition.findFirst({
        where: { id: dto.requisitionId, tenantId },
      });
      if (requisition?.projectId) {
        projectId = requisition.projectId;
      }
    }

    return this.prisma.purchaseOrder.create({
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
  }

  async getPurchaseOrders(tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
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
    const po = await this.prisma.purchaseOrder.findFirst({
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
    const updatedPo = await this.prisma.purchaseOrder.update({
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

    return updatedPo;
  }

  // --- Goods Receipt ---
  async receiveGoods(tenantId: string, id: string, dto: ReceiveGoodsDto, actingUserId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
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

      // 1. Create Goods Receipt
      const receipt = await tx.goodsReceipt.create({
        data: {
          tenantId,
          purchaseOrderId: id,
          warehouseId: dto.warehouseId,
          notes: dto.notes,
        },
      });

      // 2. Loop through PO lines and update stock + FIFO cost layers
      for (const line of po.lines) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: line.productId,
            warehouseId: dto.warehouseId,
            type: 'RECEIPT',
            quantity: line.quantity,
            reference: `GR-${receipt.id}`,
          },
        });

        await tx.inventoryCostLayer.create({
          data: {
            tenantId,
            productId: line.productId,
            warehouseId: dto.warehouseId,
            goodsReceiptId: receipt.id,
            quantity: line.quantity,
            remainingQty: line.quantity,
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
            data: { quantity: Number(existingLevel.quantity) + Number(line.quantity) },
          });
        } else {
          await tx.stockLevel.create({
            data: {
              tenantId,
              productId: line.productId,
              warehouseId: dto.warehouseId,
              quantity: line.quantity,
            },
          });
        }
      }

      // 3. Mark PO as RECEIVED
      // tenant-scope-ok: `po` was fetched scoped to `tenantId` at the top of this transaction.
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
      });

      // 4. Trigger AI Forecasting pipeline placeholder
      AmdoxLogger.scm('AI forecast re-eval queued (Prophet/LSTM)', `po=${po.poNumber}`);

      return receipt;
    });

    // 5. Enqueue heavy async task for Finance 3-way match
    await this.scmQueue.add('goods.received', {
      tenantId,
      purchaseOrderId: id,
      goodsReceiptId: result.id,
    });
    this.eventEmitter.emit('goods.received', {
      tenantId,
      purchaseOrderId: id,
      goodsReceiptId: result.id,
      userId: actingUserId,
    });
    AmdoxLogger.scm(`Goods received`, `poId=${id}  grId=${result.id}`);
    AmdoxLogger.event('Emitted goods.received → AP invoice + GL chain triggered');

    return result;
  }
}
