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

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreatePurchaseOrderDto } from '../dto/create-purchase-order.dto';
import { ReceiveGoodsDto } from '../dto/receive-goods.dto';

@Injectable()
export class PurchaseService {
  private prisma = new PrismaClient();

  // --- Purchase Orders ---
  async createPurchaseOrder(tenantId: string, dto: CreatePurchaseOrderDto) {
    const totalAmount = dto.lines.reduce((sum, line) => sum + (line.quantity * line.unitPrice), 0);
    const poNumber = `PO-${Date.now()}`;

    return this.prisma.purchaseOrder.create({
      data: {
        tenantId,
        poNumber,
        vendorId: dto.vendorId,
        status: 'SUBMITTED', // Or DRAFT
        totalAmount,
        orderedAt: new Date(),
        lines: {
          create: dto.lines.map(line => ({
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
      include: { vendor: true, lines: true },
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

  async approvePurchaseOrder(tenantId: string, id: string) {
    await this.getPurchaseOrder(tenantId, id);
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  // --- Goods Receipt ---
  async receiveGoods(tenantId: string, id: string, dto: ReceiveGoodsDto) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id, tenantId },
        include: { lines: true },
      });

      if (!po) throw new NotFoundException('PO not found');
      if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new BadRequestException('Cannot receive goods for unapproved PO');
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

      // 2. Loop through PO lines and update stock
      for (const line of po.lines) {
        // Create stock movement
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

        // Upsert stock level
        const existingLevel = await tx.stockLevel.findUnique({
          where: {
            productId_warehouseId: {
              productId: line.productId,
              warehouseId: dto.warehouseId,
            },
          },
        });

        if (existingLevel) {
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
      await tx.purchaseOrder.update({
        where: { id },
        data: { status: 'RECEIVED' },
      });

      return receipt;
    });
  }
}
