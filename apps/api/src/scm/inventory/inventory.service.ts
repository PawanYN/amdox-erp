/**
 * ============================================================================
 * SERVICE: inventory.service.ts
 * ============================================================================
 *
 * WHAT THIS FILE DOES:
 * This service is the heart of real-time inventory tracking. It handles:
 * 1. Warehouses (Physical locations where stock is kept).
 * 2. Stock Movements (The log of goods going in and out).
 * 3. Reorder Rules (The thresholds at which we should buy more stock).
 * 4. FIFO cost consumption (BE-05) — see `consumeFifoCostLayers()` below.
 *
 * HOW IT IS IMPLEMENTED:
 * - `recordMovement()` is the most critical function here. It uses a Prisma
 *   database transaction (`this.prisma.$transaction`) to guarantee data integrity.
 *   Whenever a StockMovement (e.g., RECEIPT or ISSUE) is logged, it calculates
 *   a `qtyMultiplier` (+1 or -1) and instantly UPSERTS (Updates or Creates)
 *   the corresponding `StockLevel` record.
 * - This ensures our `StockLevel` table is ALWAYS an accurate, real-time
 *   reflection of the sum of all `StockMovements`.
 * - It throws a `BadRequestException` if a movement would drop stock below 0.
 * - For outbound movements (ISSUE, TRANSFER) it additionally walks the
 *   `InventoryCostLayer` table oldest-first (FIFO) and drains `remainingQty`
 *   off each layer to compute the COGS of the units leaving the warehouse.
 *   Inbound cost layers themselves are created in `purchase.service.ts` at
 *   goods-receipt time — this file only consumes them.
 *
 * RELEVANT CONTEXT FOR NEW DEVS:
 * Note that `PurchaseService` heavily relies on the logic in this file (or replicates
 * the transaction logic) when "Receiving Goods" to update the warehouse stock.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@amdox/db';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { CreateStockMovementDto } from '../dto/stock-movement.dto';
import { UpsertReorderRuleDto } from '../dto/reorder-rule.dto';
import { AmdoxLogger } from '../../common/logger/amdox-logger';

/** One FIFO layer partially or fully drained to satisfy an outbound movement. */
export interface ConsumedLayer {
  costLayerId: string;
  quantityConsumed: number;
  unitCost: number;
}

/** Result of draining cost layers for an outbound movement. */
export interface FifoConsumptionResult {
  totalQuantityRequested: number;
  totalQuantityConsumed: number;
  /** Qty that had no matching cost layer left (e.g. legacy stock seeded before FIFO tracking). Costed at 0. */
  unmatchedQuantity: number;
  totalCost: number;
  layers: ConsumedLayer[];
}

@Injectable()
export class InventoryService {
  private prisma = new PrismaClient();

  // --- Warehouse Management ---
  async createWarehouse(tenantId: string, dto: CreateWarehouseDto) {
    return this.prisma.warehouse.create({
      data: { ...dto, tenantId },
    });
  }

  async getWarehouses(tenantId: string) {
    return this.prisma.warehouse.findMany({ where: { tenantId } });
  }

  async getWarehouse(tenantId: string, id: string) {
    const w = await this.prisma.warehouse.findFirst({
      where: { id, tenantId },
      include: { stockLevels: { include: { product: true } } },
    });
    if (!w) throw new NotFoundException('Warehouse not found');
    return w;
  }

  // --- Stock Management ---
  async recordMovement(tenantId: string, dto: CreateStockMovementDto) {
    return this.prisma.$transaction(async (tx) => {
      // dto.productId/warehouseId are caller-supplied — without this check, naming
      // another tenant's product or warehouse would read/write that tenant's
      // StockLevel row (its unique key is productId+warehouseId only, with no
      // tenantId component, so the findUnique below can't catch this itself).
      const [product, warehouse] = await Promise.all([
        tx.product.findFirst({ where: { id: dto.productId, tenantId } }),
        tx.warehouse.findFirst({ where: { id: dto.warehouseId, tenantId } }),
      ]);
      if (!product) throw new NotFoundException('Product not found');
      if (!warehouse) throw new NotFoundException('Warehouse not found');

      // 1. Create the stock movement
      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          type: dto.type as any,
          quantity: dto.quantity,
          reference: dto.reference,
        },
      });

      // 2. Adjust StockLevel
      // NOTE: ADJUSTMENT is treated as inbound (+) here — a downward stock count
      // correction should be raised as an ISSUE by the caller, not ADJUSTMENT.
      const isOutbound = dto.type === 'ISSUE' || dto.type === 'TRANSFER';
      const qtyMultiplier = isOutbound ? -1 : 1;
      const adjustmentAmount = Number(dto.quantity) * qtyMultiplier;

      // tenant-scope-ok: StockLevel's unique key is productId+warehouseId with no
      // tenantId component, but both were just verified above to belong to `tenantId`.
      const existingLevel = await tx.stockLevel.findUnique({
        where: {
          productId_warehouseId: {
            productId: dto.productId,
            warehouseId: dto.warehouseId,
          },
        },
      });

      let updatedLevel;
      if (existingLevel) {
        // tenant-scope-ok: existingLevel was just found via the tenant-safe lookup above.
        updatedLevel = await tx.stockLevel.update({
          where: { id: existingLevel.id },
          data: { quantity: Number(existingLevel.quantity) + adjustmentAmount },
        });
      } else {
        if (adjustmentAmount < 0) {
          throw new BadRequestException('Insufficient stock to complete movement');
        }
        updatedLevel = await tx.stockLevel.create({
          data: {
            tenantId,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            quantity: adjustmentAmount,
          },
        });
      }

      // 3. BE-05 — FIFO cost consumption for outbound movements.
      // Inbound receipts create InventoryCostLayer rows (see purchase.service.ts);
      // here we drain the oldest layers first so COGS reflects actual purchase price history
      // rather than the product's latest unit cost.
      let fifoConsumption: FifoConsumptionResult | null = null;
      if (isOutbound) {
        fifoConsumption = await this.consumeFifoCostLayers(
          tx,
          tenantId,
          dto.productId,
          dto.warehouseId,
          Number(dto.quantity),
        );

        AmdoxLogger.scm(
          'FIFO cost layers consumed for outbound movement',
          `productId=${dto.productId} warehouseId=${dto.warehouseId} type=${dto.type} ` +
            `qty=${fifoConsumption.totalQuantityConsumed}/${fifoConsumption.totalQuantityRequested} ` +
            `layers=${fifoConsumption.layers.length} totalCost=${fifoConsumption.totalCost.toFixed(2)}`,
        );

        if (fifoConsumption.unmatchedQuantity > 0) {
          // Happens when stock exists (e.g. seeded/legacy StockLevel rows) without a
          // matching InventoryCostLayer trail — costed at 0 so the movement isn't blocked.
          AmdoxLogger.warn(
            'FIFO consumption ran out of cost layers before covering the full quantity',
            `productId=${dto.productId} warehouseId=${dto.warehouseId} unmatchedQty=${fifoConsumption.unmatchedQuantity}`,
          );
        }
      } else {
        AmdoxLogger.scm(
          'Stock movement recorded (inbound)',
          `productId=${dto.productId} warehouseId=${dto.warehouseId} type=${dto.type} qty=${dto.quantity}`,
        );
      }

      return { movement, stockLevel: updatedLevel, fifoConsumption };
    });
  }

  /**
   * Drains `InventoryCostLayer` rows oldest-first (FIFO) for a product/warehouse to
   * cost an outbound quantity (ISSUE or TRANSFER).
   *
   * Each layer's `remainingQty` is decremented in place; a layer is only exhausted
   * (remainingQty === 0) once fully consumed, so partially-consumed layers stay
   * available for the next outbound movement. If the requested quantity exceeds
   * what all layers combined can cover, the shortfall is reported as
   * `unmatchedQuantity` (costed at 0) rather than blocking the movement — this can
   * legitimately happen for stock that predates FIFO tracking (e.g. seed data).
   */
  private async consumeFifoCostLayers(
    tx: Prisma.TransactionClient,
    tenantId: string,
    productId: string,
    warehouseId: string,
    quantity: number,
  ): Promise<FifoConsumptionResult> {
    let remainingToConsume = quantity;
    const layersConsumed: ConsumedLayer[] = [];
    let totalCost = 0;

    // Oldest layer first = FIFO. Only layers with stock left are candidates.
    const availableLayers = await tx.inventoryCostLayer.findMany({
      where: {
        tenantId,
        productId,
        warehouseId,
        remainingQty: { gt: 0 },
      },
      orderBy: { receivedAt: 'asc' },
    });

    for (const layer of availableLayers) {
      if (remainingToConsume <= 0) break;

      const layerRemaining = Number(layer.remainingQty);
      const takeFromLayer = Math.min(layerRemaining, remainingToConsume);

      // tenant-scope-ok: `layer` came from availableLayers above, fetched scoped to `tenantId`.
      await tx.inventoryCostLayer.update({
        where: { id: layer.id },
        data: { remainingQty: layerRemaining - takeFromLayer },
      });

      layersConsumed.push({
        costLayerId: layer.id,
        quantityConsumed: takeFromLayer,
        unitCost: Number(layer.unitCost),
      });
      totalCost += takeFromLayer * Number(layer.unitCost);
      remainingToConsume -= takeFromLayer;
    }

    return {
      totalQuantityRequested: quantity,
      totalQuantityConsumed: quantity - remainingToConsume,
      unmatchedQuantity: remainingToConsume,
      totalCost,
      layers: layersConsumed,
    };
  }

  // --- Reorder Rules ---
  async upsertReorderRule(tenantId: string, dto: UpsertReorderRuleDto) {
    const existing = await this.prisma.reorderRule.findFirst({
      where: { tenantId, productId: dto.productId },
    });

    if (existing) {
      // tenant-scope-ok: `existing` was just found via a tenantId-scoped findFirst above.
      return this.prisma.reorderRule.update({
        where: { id: existing.id },
        data: {
          thresholdQty: dto.thresholdQty,
          reorderQty: dto.reorderQty,
          isActive: dto.isActive ?? true,
        },
      });
    } else {
      return this.prisma.reorderRule.create({
        data: {
          tenantId,
          productId: dto.productId,
          thresholdQty: dto.thresholdQty,
          reorderQty: dto.reorderQty,
          isActive: dto.isActive ?? true,
        },
      });
    }
  }

  async getReorderRules(tenantId: string) {
    return this.prisma.reorderRule.findMany({
      where: { tenantId },
      include: { product: true },
    });
  }
}
