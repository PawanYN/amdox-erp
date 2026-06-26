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
 * 
 * RELEVANT CONTEXT FOR NEW DEVS:
 * Note that `PurchaseService` heavily relies on the logic in this file (or replicates 
 * the transaction logic) when "Receiving Goods" to update the warehouse stock.
 * ============================================================================
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateWarehouseDto } from '../dto/create-warehouse.dto';
import { UpdateWarehouseDto } from '../dto/update-warehouse.dto';
import { CreateStockMovementDto } from '../dto/stock-movement.dto';
import { UpsertReorderRuleDto } from '../dto/reorder-rule.dto';

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
      const qtyMultiplier = (dto.type === 'RECEIPT' || dto.type === 'ADJUSTMENT') ? 1 : -1;
      const adjustmentAmount = Number(dto.quantity) * qtyMultiplier;

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

      return { movement, stockLevel: updatedLevel };
    });
  }

  // --- Reorder Rules ---
  async upsertReorderRule(tenantId: string, dto: UpsertReorderRuleDto) {
    const existing = await this.prisma.reorderRule.findFirst({
      where: { tenantId, productId: dto.productId },
    });

    if (existing) {
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
