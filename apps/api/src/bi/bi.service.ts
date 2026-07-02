import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

@Injectable()
export class BiService {
  private prisma = new PrismaClient();

  async listDashboards(tenantId: string) {
    return this.prisma.dashboard.findMany({
      where: { tenantId, deletedAt: null },
      include: { widgets: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createDashboard(tenantId: string, name: string, ownerId?: string) {
    return this.prisma.dashboard.create({
      data: { tenantId, name, ownerId, layout: {} },
    });
  }

  async addWidget(
    tenantId: string,
    dashboardId: string,
    type: string,
    config: object,
  ) {
    return this.prisma.widget.create({
      data: { tenantId, dashboardId, type, config },
    });
  }

  async getExecutiveKpis(tenantId: string) {
    const [
      invoiceCount,
      openPos,
      employeeCount,
      lowStockProducts,
      projectCount,
      arInvoices,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      }),
      this.prisma.employee.count({
        where: { tenantId, status: 'ACTIVE', deletedAt: null },
      }),
      this.prisma.reorderRule.count({ where: { tenantId, isActive: true } }),
      this.prisma.project.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.invoice.findMany({
        where: { tenantId, type: 'AR', status: { not: 'PAID' } },
        select: { totalAmount: true, dueDate: true },
      }),
    ]);

    const now = Date.now();
    const aging = { current: 0, d31_60: 0, d61_90: 0, over90: 0 };
    for (const inv of arInvoices) {
      const days = Math.floor(
        (now - new Date(inv.dueDate).getTime()) / (86400000),
      );
      const amt = Number(inv.totalAmount);
      if (days <= 30) aging.current += amt;
      else if (days <= 60) aging.d31_60 += amt;
      else if (days <= 90) aging.d61_90 += amt;
      else aging.over90 += amt;
    }

    const stockLevels = await this.prisma.stockLevel.findMany({
      where: { tenantId },
      include: { product: true },
      take: 20,
    });

    return {
      totals: {
        invoices: invoiceCount,
        openPurchaseOrders: openPos,
        activeEmployees: employeeCount,
        activeProjects: projectCount,
        reorderRules: lowStockProducts,
      },
      arAging: aging,
      inventorySnapshot: stockLevels.map((s) => ({
        sku: s.product.sku,
        name: s.product.name,
        quantity: Number(s.quantity),
      })),
    };
  }
}
