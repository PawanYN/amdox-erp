import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface MaterialRequestedPayload {
  tenantId: string;
  projectId: string;
  requestedBy?: string;
  reason?: string;
  lines: {
    productId: string;
    quantity: number;
    estimatedUnitPrice?: number;
  }[];
}

@Injectable()
export class RequisitionService {
  private prisma = new PrismaClient();
  private readonly logger = new Logger(RequisitionService.name);

  constructor(private eventEmitter: EventEmitter2) {}

  async listRequisitions(tenantId: string) {
    return this.prisma.purchaseRequisition.findMany({
      where: { tenantId },
      include: {
        project: { select: { id: true, name: true } },
        lines: { include: { product: { select: { id: true, sku: true, name: true, unitCost: true, defaultVendorId: true } } } },
        purchaseOrders: { select: { id: true, poNumber: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFromMaterialRequest(payload: MaterialRequestedPayload) {
    const products = await this.prisma.product.findMany({
      where: {
        tenantId: payload.tenantId,
        id: { in: payload.lines.map((l) => l.productId) },
        isActive: true,
        deletedAt: null,
      },
    });

    if (products.length !== payload.lines.length) {
      throw new BadRequestException(
        'One or more products are invalid or inactive.',
      );
    }

    const requisition = await this.prisma.purchaseRequisition.create({
      data: {
        tenantId: payload.tenantId,
        projectId: payload.projectId,
        requestedBy: payload.requestedBy,
        reason: payload.reason,
        lines: {
          create: payload.lines.map((line) => ({
            tenantId: payload.tenantId,
            productId: line.productId,
            quantity: line.quantity,
            estimatedUnitPrice: line.estimatedUnitPrice,
          })),
        },
      },
      include: {
        lines: { include: { product: true } },
        project: { select: { id: true, name: true } },
      },
    });

    this.logger.log(
      `Created requisition ${requisition.id} for project ${payload.projectId}`,
    );

    this.eventEmitter.emit('requisition.created', {
      tenantId: payload.tenantId,
      requisitionId: requisition.id,
      projectId: payload.projectId,
    });

    return requisition;
  }

  async createFromLowStock(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId, isActive: true, deletedAt: null },
      include: {
        stockLevels: true,
        reorderRules: { where: { isActive: true }, take: 1 },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const rule = product.reorderRules[0];
    const totalStock = product.stockLevels.reduce(
      (sum, level) => sum + Number(level.quantity),
      0,
    );
    const thresholdQty = rule ? Number(rule.thresholdQty) : 10;
    const reorderQty = rule
      ? Number(rule.reorderQty)
      : Math.max(thresholdQty * 2 - totalStock, 1);

    if (totalStock >= thresholdQty) {
      throw new BadRequestException(
        `Stock (${totalStock}) is at or above reorder threshold (${thresholdQty})`,
      );
    }

    const pendingRequisition = await this.prisma.purchaseRequisition.findFirst({
      where: {
        tenantId,
        lines: { some: { productId } },
        purchaseOrders: { none: {} },
      },
      include: {
        lines: { include: { product: true } },
        purchaseOrders: { select: { id: true, poNumber: true, status: true } },
      },
    });

    if (pendingRequisition) {
      this.logger.log(
        `Returning existing open requisition ${pendingRequisition.id} for product ${product.sku}`,
      );
      return pendingRequisition;
    }

    const requisition = await this.prisma.purchaseRequisition.create({
      data: {
        tenantId,
        reason: `Low stock auto-PR for ${product.sku} (${totalStock} < ${thresholdQty})`,
        lines: {
          create: {
            tenantId,
            productId,
            quantity: reorderQty,
            estimatedUnitPrice: product.unitCost,
          },
        },
      },
      include: {
        lines: { include: { product: true } },
        purchaseOrders: { select: { id: true, poNumber: true, status: true } },
      },
    });

    this.logger.log(
      `Created low-stock requisition ${requisition.id} for product ${product.sku}`,
    );

    this.eventEmitter.emit('inventory.low_stock', {
      tenantId,
      productId,
      productSku: product.sku,
      currentStock: totalStock,
      thresholdQty,
      requisitionId: requisition.id,
    });

    this.eventEmitter.emit('requisition.created', {
      tenantId,
      requisitionId: requisition.id,
    });

    return requisition;
  }
}
