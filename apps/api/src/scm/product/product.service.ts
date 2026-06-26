/**
 * ============================================================================
 * SERVICE: product.service.ts
 * ============================================================================
 * 
 * WHAT THIS FILE DOES:
 * This service manages the "Product Catalog" (SKUs, items, goods). 
 * It handles the creation, retrieval, updating, and soft deletion of products.
 * 
 * HOW IT IS IMPLEMENTED:
 * - Built on top of Prisma ORM with strict multi-tenancy (`tenantId`).
 * - When fetching a single product (`findOne`), we eagerly load its `defaultVendor` 
 *   and its current `stockLevels` (along with the warehouse details) so the 
 *   frontend gets a complete view of the product's status in a single query.
 * - Uses soft deletes (`deletedAt`, `isActive = false`) for `remove()` so that 
 *   historical inventory logs and purchase orders do not break.
 * 
 * RELEVANT CONTEXT FOR NEW DEVS:
 * A Product is the central entity in the SCM module. 
 * - Inventory tracks `StockLevels` per product.
 * - Purchasing orders `PurchaseOrderLines` of products.
 * - Automation uses a product's `defaultVendorId` to automatically generate POs.
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';

@Injectable()
export class ProductService {
  private prisma = new PrismaClient();

  async create(tenantId: string, createProductDto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        tenantId,
        ...createProductDto,
      },
    });
  }

  async findAll(tenantId: string) {
    return this.prisma.product.findMany({
      where: { tenantId, deletedAt: null },
      include: { defaultVendor: true },
    });
  }

  async findOne(tenantId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { defaultVendor: true, stockLevels: { include: { warehouse: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(tenantId: string, id: string, updateProductDto: UpdateProductDto) {
    await this.findOne(tenantId, id); // Ensure existence

    return this.prisma.product.update({
      where: { id },
      data: updateProductDto,
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    
    // Soft delete
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
