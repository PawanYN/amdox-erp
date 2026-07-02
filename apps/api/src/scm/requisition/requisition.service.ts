import { Injectable, Logger, BadRequestException } from '@nestjs/common';
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
}
