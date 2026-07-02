import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

const VALID_WIDGET_TYPES = new Set([
  'bar', 'line', 'pie', 'heatmap', 'funnel',
  'gauge', 'card', 'waterfall', 'scatter', 'treemap',
]);

const VALID_DATA_SOURCES = new Set<string>([
  'ar_aging', 'inventory', 'purchase_orders',
  'employees_by_department', 'project_funnel', 'resource_heatmap',
]);

export type BiFilters = {
  period?: string;
  department?: string;
  status?: string;
};

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

  async getDashboard(tenantId: string, id: string) {
    const dashboard = await this.prisma.dashboard.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { widgets: true },
    });
    if (!dashboard) throw new NotFoundException('Dashboard not found');
    return dashboard;
  }

  async createDashboard(tenantId: string, name: string, ownerId?: string) {
    return this.prisma.dashboard.create({
      data: { tenantId, name, ownerId, layout: {} },
    });
  }

  async updateDashboard(
    tenantId: string,
    id: string,
    data: { name?: string; layout?: object },
  ) {
    await this.getDashboard(tenantId, id);
    return this.prisma.dashboard.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.layout !== undefined ? { layout: data.layout } : {}),
      },
    });
  }

  async deleteDashboard(tenantId: string, id: string) {
    await this.getDashboard(tenantId, id);
    return this.prisma.dashboard.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async addWidget(
    tenantId: string,
    dashboardId: string,
    type: string,
    config: object,
  ) {
    this.validateWidget(type, config);
    await this.getDashboard(tenantId, dashboardId);
    return this.prisma.widget.create({
      data: { tenantId, dashboardId, type, config },
    });
  }

  async updateWidget(
    tenantId: string,
    id: string,
    data: { type?: string; config?: object },
  ) {
    const widget = await this.prisma.widget.findFirst({
      where: { id, tenantId },
    });
    if (!widget) throw new NotFoundException('Widget not found');
    const nextType = data.type ?? widget.type;
    const nextConfig = data.config ?? (widget.config as object);
    this.validateWidget(nextType, nextConfig);
    return this.prisma.widget.update({
      where: { id },
      data: {
        ...(data.type !== undefined ? { type: data.type } : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
      },
    });
  }

  private validateWidget(type: string, config: object) {
    if (!VALID_WIDGET_TYPES.has(type)) {
      throw new BadRequestException(`Invalid widget type: ${type}`);
    }
    const c = config as { dataSource?: string; title?: string };
    if (c.dataSource && !VALID_DATA_SOURCES.has(c.dataSource)) {
      throw new BadRequestException(`Invalid data source: ${c.dataSource}`);
    }
    if (c.title !== undefined && typeof c.title !== 'string') {
      throw new BadRequestException('Widget title must be a string');
    }
  }

  async deleteWidget(tenantId: string, id: string) {
    const widget = await this.prisma.widget.findFirst({
      where: { id, tenantId },
    });
    if (!widget) throw new NotFoundException('Widget not found');
    return this.prisma.widget.delete({ where: { id } });
  }

  async getWidget(tenantId: string, id: string) {
    const widget = await this.prisma.widget.findFirst({
      where: { id, tenantId },
    });
    if (!widget) throw new NotFoundException('Widget not found');
    return widget;
  }

  async getExecutiveKpis(tenantId: string, filters: BiFilters = {}) {
    const departmentFilter = this.resolveDepartmentFilter(filters.department);

    const employeeWhere: Record<string, unknown> = {
      tenantId,
      status: 'ACTIVE',
      deletedAt: null,
    };
    if (departmentFilter) {
      employeeWhere.department = {
        name: { contains: departmentFilter, mode: 'insensitive' },
      };
    }

    const arStatusFilter =
      filters.status === 'closed'
        ? { in: ['PAID', 'CANCELLED'] as ('PAID' | 'CANCELLED')[] }
        : { notIn: ['PAID', 'CANCELLED'] as ('PAID' | 'CANCELLED')[] };

    const [
      invoiceCount,
      openPos,
      employeeCount,
      lowStockProducts,
      projectCount,
      arInvoices,
      departments,
    ] = await Promise.all([
      this.prisma.invoice.count({ where: { tenantId } }),
      this.prisma.purchaseOrder.count({
        where: { tenantId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      }),
      this.prisma.employee.count({ where: employeeWhere }),
      this.prisma.reorderRule.count({ where: { tenantId, isActive: true } }),
      this.prisma.project.count({ where: { tenantId, deletedAt: null } }),
      this.prisma.invoice.findMany({
        where: { tenantId, type: 'AR', status: arStatusFilter },
        select: { totalAmount: true, dueDate: true },
      }),
      this.prisma.department.findMany({
        where: { tenantId, deletedAt: null },
        select: { name: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    const now = Date.now();
    const aging = { current: 0, d31_60: 0, d61_90: 0, over90: 0 };
    for (const inv of arInvoices) {
      const days = Math.floor(
        (now - new Date(inv.dueDate).getTime()) / (86400000),
      );
      const bucket =
        days <= 30 ? 'Current' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';

      if (filters.period === 'current' && bucket !== 'Current') continue;
      if (filters.period === 'overdue' && bucket === 'Current') continue;

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
        openArInvoices: arInvoices.length,
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
      departments: departments.map((d) => d.name),
    };
  }

  private resolveDepartmentFilter(value?: string): string | null {
    if (!value || value === 'all') return null;
    const map: Record<string, string> = {
      finance: 'Finance',
      hr: 'Human Resources',
      engineering: 'Engineering',
      operations: 'Operations',
    };
    return map[value.toLowerCase()] || value.replace(/_/g, ' ');
  }
}
