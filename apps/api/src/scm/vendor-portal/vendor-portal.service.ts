import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaClient } from '@amdox/db';
import { createHash, randomBytes } from 'crypto';
import { AcknowledgePoDto } from './dto/acknowledge-po.dto';

@Injectable()
export class VendorPortalService {
  private prisma = new PrismaClient();
  private readonly logger = new Logger(VendorPortalService.name);

  hashAccessKey(accessKey: string): string {
    return createHash('sha256').update(accessKey).digest('hex');
  }

  generateAccessKey(): string {
    return `vp_${randomBytes(24).toString('hex')}`;
  }

  async issuePortalKey(tenantId: string, vendorId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null, isActive: true },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    if (!vendor.email) {
      throw new BadRequestException('Vendor must have an email before issuing a portal key');
    }

    const accessKey = this.generateAccessKey();
    // tenant-scope-ok: `vendor` was just found via a tenantId-scoped findFirst above.
    await this.prisma.vendor.update({
      where: { id: vendorId },
      data: {
        portalAccessKeyHash: this.hashAccessKey(accessKey),
        portalKeyIssuedAt: new Date(),
      },
    });

    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      accessKey,
      portalUrl: '/vendor-portal',
      message: 'Save this access key — it is shown only once. Share with the supplier.',
    };
  }

  async login(tenantSlug: string, email: string, accessKey: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: { slug: tenantSlug, isActive: true, deletedAt: null },
    });
    if (!tenant) {
      throw new UnauthorizedException('Invalid tenant, email, or vendor portal access key');
    }

    const vendor = await this.resolveVendor(tenant.id, accessKey);
    if (!vendor || vendor.email?.toLowerCase() !== email.toLowerCase()) {
      throw new UnauthorizedException('Invalid tenant, email, or vendor portal access key');
    }

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      vendorId: vendor.id,
      vendorName: vendor.name,
      vendorEmail: vendor.email,
      accessKey,
    };
  }

  async resolveVendor(tenantId: string, accessKey: string) {
    const hash = this.hashAccessKey(accessKey);
    return this.prisma.vendor.findFirst({
      where: {
        tenantId,
        portalAccessKeyHash: hash,
        isActive: true,
        deletedAt: null,
      },
    });
  }

  async getProfile(vendorId: string, tenantId: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: vendorId, tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        email: true,
        portalKeyIssuedAt: true,
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async listPurchaseOrders(vendorId: string, tenantId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: {
        tenantId,
        vendorId,
        status: { in: ['APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED'] },
        deletedAt: null,
      },
      include: {
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
      orderBy: { orderedAt: 'desc' },
    });
  }

  async getPurchaseOrder(vendorId: string, tenantId: string, poId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: {
        id: poId,
        tenantId,
        vendorId,
        deletedAt: null,
      },
      include: {
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
        goodsReceipts: true,
      },
    });
    if (!po) throw new NotFoundException('Purchase order not found');
    return po;
  }

  async acknowledgePurchaseOrder(
    vendorId: string,
    tenantId: string,
    poId: string,
    dto: AcknowledgePoDto,
  ) {
    const po = await this.getPurchaseOrder(vendorId, tenantId, poId);
    if (po.status !== 'APPROVED') {
      throw new BadRequestException('Only approved purchase orders can be acknowledged');
    }
    if (po.vendorAcknowledgedAt) {
      throw new BadRequestException('Purchase order already acknowledged');
    }

    // tenant-scope-ok: `po` was fetched above via getPurchaseOrder(), which is
    // scoped to both tenantId and vendorId.
    return this.prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        vendorAcknowledgedAt: new Date(),
        vendorExpectedDeliveryAt: dto.expectedDeliveryAt
          ? new Date(dto.expectedDeliveryAt)
          : undefined,
        vendorShipmentNotes: dto.notes,
      },
      include: {
        lines: { include: { product: { select: { id: true, name: true, sku: true } } } },
      },
    });
  }

  async notifyVendorWebhook(webhookUrl: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        this.logger.warn(`Vendor webhook returned ${response.status} for ${webhookUrl}`);
      }
    } catch (err) {
      this.logger.warn(`Vendor webhook failed for ${webhookUrl}: ${(err as Error).message}`);
    }
  }
}
