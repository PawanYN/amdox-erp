import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@amdox/db';

export type BiDataSource =
  | 'ar_aging'
  | 'inventory'
  | 'purchase_orders'
  | 'employees_by_department'
  | 'project_funnel'
  | 'resource_heatmap';

export type BiFilters = {
  period?: string;
  department?: string;
  status?: string;
};

export interface WidgetDataPoint {
  name: string;
  value: number;
  key?: string;
}

@Injectable()
export class BiDataService {
  private prisma = new PrismaClient();

  async getWidgetData(tenantId: string, dataSource: BiDataSource, filters: BiFilters = {}) {
    switch (dataSource) {
      case 'ar_aging':
        return this.getArAgingChart(tenantId, filters);
      case 'inventory':
        return this.getInventoryChart(tenantId);
      case 'purchase_orders':
        return this.getPurchaseOrderChart(tenantId, filters);
      case 'employees_by_department':
        return this.getEmployeesByDepartmentChart(tenantId, filters);
      case 'project_funnel':
        return this.getProjectFunnelChart(tenantId, filters);
      case 'resource_heatmap':
        return this.getResourceHeatmap(tenantId);
      default:
        return { series: [], meta: { dataSource } };
    }
  }

  async getDrillDown(
    tenantId: string,
    dataSource: BiDataSource,
    filterKey: string,
    filterValue?: string,
  ) {
    switch (dataSource) {
      case 'ar_aging':
        return this.drillDownArAging(tenantId, filterKey);
      case 'inventory':
        return this.drillDownInventory(tenantId, filterValue || filterKey);
      case 'purchase_orders':
        return this.drillDownPurchaseOrders(tenantId, filterKey);
      case 'employees_by_department':
        return this.drillDownEmployees(tenantId, filterValue || filterKey);
      case 'project_funnel':
        return this.drillDownProjects(tenantId, filterKey);
      case 'resource_heatmap':
        return this.drillDownResources(tenantId, filterValue || filterKey);
      default:
        return { columns: [], rows: [] };
    }
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

  private async getArAgingChart(tenantId: string, filters: BiFilters = {}) {
    const statusFilter =
      filters.status === 'closed'
        ? { in: ['PAID', 'CANCELLED'] as ('PAID' | 'CANCELLED')[] }
        : { notIn: ['PAID', 'CANCELLED'] as ('PAID' | 'CANCELLED')[] };

    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, type: 'AR', status: statusFilter },
      select: { totalAmount: true, dueDate: true },
    });
    const buckets = { Current: 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const now = Date.now();
    for (const inv of invoices) {
      const days = Math.floor((now - inv.dueDate.getTime()) / 86400000);
      const bucket =
        days <= 30 ? 'Current' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';

      if (filters.period === 'current' && bucket !== 'Current') continue;
      if (filters.period === 'overdue' && bucket === 'Current') continue;

      const amt = Number(inv.totalAmount);
      buckets[bucket] += amt;
    }
    const series: WidgetDataPoint[] = Object.entries(buckets).map(([name, value]) => ({
      name: name === '31-60' ? '31–60' : name === '61-90' ? '61–90' : name,
      value,
      key: name,
    }));
    return { series, meta: { dataSource: 'ar_aging', currency: 'INR' } };
  }

  private async getInventoryChart(tenantId: string) {
    const levels = await this.prisma.stockLevel.findMany({
      where: { tenantId },
      include: { product: true },
      take: 12,
      orderBy: { quantity: 'desc' },
    });
    const series = levels.map((l) => ({
      name: l.product.sku,
      value: Number(l.quantity),
      key: l.product.sku,
    }));
    return { series, meta: { dataSource: 'inventory' } };
  }

  private async getPurchaseOrderChart(tenantId: string, filters: BiFilters = {}) {
    const statusFilter =
      filters.status === 'open'
        ? { in: ['SUBMITTED', 'APPROVED', 'DRAFT'] as ('SUBMITTED' | 'APPROVED' | 'DRAFT')[] }
        : filters.status === 'closed'
          ? { in: ['RECEIVED', 'CANCELLED', 'CLOSED'] as ('RECEIVED' | 'CANCELLED' | 'CLOSED')[] }
          : undefined;

    const pos = await this.prisma.purchaseOrder.groupBy({
      by: ['status'],
      where: { tenantId, ...(statusFilter ? { status: statusFilter } : {}) },
      _count: { _all: true },
    });
    const series = pos.map((p) => ({
      name: p.status,
      value: p._count._all,
      key: p.status,
    }));
    return { series, meta: { dataSource: 'purchase_orders' } };
  }

  private async getEmployeesByDepartmentChart(tenantId: string, filters: BiFilters = {}) {
    const deptFilter = this.resolveDepartmentFilter(filters.department);
    const employees = await this.prisma.employee.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        ...(deptFilter
          ? { department: { name: { contains: deptFilter, mode: 'insensitive' } } }
          : {}),
      },
      include: { department: true },
    });
    const counts = new Map<string, number>();
    for (const e of employees) {
      const dept = e.department?.name || 'Unassigned';
      counts.set(dept, (counts.get(dept) || 0) + 1);
    }
    const series = [...counts.entries()].map(([name, value]) => ({
      name,
      value,
      key: name,
    }));
    return { series, meta: { dataSource: 'employees_by_department' } };
  }

  private async getProjectFunnelChart(tenantId: string, filters: BiFilters = {}) {
    const stages = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];
    const statusFilter =
      filters.status === 'open'
        ? { in: ['PLANNING', 'ACTIVE', 'ON_HOLD'] as ('PLANNING' | 'ACTIVE' | 'ON_HOLD')[] }
        : filters.status === 'closed'
          ? { in: ['COMPLETED', 'CANCELLED'] as ('COMPLETED' | 'CANCELLED')[] }
          : undefined;

    const groups = await this.prisma.project.groupBy({
      by: ['status'],
      where: {
        tenantId,
        deletedAt: null,
        ...(statusFilter ? { status: statusFilter } : {}),
      },
      _count: { _all: true },
    });
    const map = new Map(groups.map((g) => [g.status, g._count._all]));
    const series = stages.map((stage) => ({
      name: stage,
      value: map.get(stage as any) || 0,
      key: stage,
    }));
    return { series, meta: { dataSource: 'project_funnel' } };
  }

  private async getResourceHeatmap(tenantId: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: { tenantId },
      include: { employee: true, project: true },
      take: 100,
    });
    const cells: { x: string; y: string; value: number }[] = [];
    const seen = new Set<string>();
    for (const a of allocations) {
      const x = a.project?.name || 'Unknown project';
      const y = a.employee?.fullName || 'Unknown';
      const key = `${x}::${y}`;
      if (seen.has(key)) continue;
      seen.add(key);
      cells.push({ x, y, value: Number(a.allocatedHours || 0) });
    }
    return { heatmap: cells, meta: { dataSource: 'resource_heatmap' } };
  }

  private async drillDownArAging(tenantId: string, bucket: string) {
    const invoices = await this.prisma.invoice.findMany({
      where: { tenantId, type: 'AR', status: { notIn: ['PAID', 'CANCELLED'] } },
      include: { customer: true },
      orderBy: { dueDate: 'asc' },
    });
    const now = Date.now();
    const rows = invoices
      .filter((inv) => {
        const days = Math.floor((now - inv.dueDate.getTime()) / 86400000);
        const b =
          days <= 30 ? 'Current' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';
        return b === bucket;
      })
      .map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        customer: inv.customer?.name || '—',
        amount: Number(inv.totalAmount),
        dueDate: inv.dueDate.toISOString().slice(0, 10),
        status: inv.status,
      }));
    return {
      columns: ['Invoice', 'Customer', 'Amount', 'Due Date', 'Status'],
      rows,
    };
  }

  private async drillDownInventory(tenantId: string, sku: string) {
    const levels = await this.prisma.stockLevel.findMany({
      where: { tenantId, product: { sku } },
      include: { product: true, warehouse: true },
    });
    const rows = levels.map((l) => ({
      sku: l.product.sku,
      product: l.product.name,
      warehouse: l.warehouse?.name || l.warehouseId,
      quantity: Number(l.quantity),
      unitCost: Number(l.product.unitCost),
    }));
    return {
      columns: ['SKU', 'Product', 'Warehouse', 'Quantity', 'Unit Cost'],
      rows,
    };
  }

  private async drillDownPurchaseOrders(tenantId: string, status: string) {
    const pos = await this.prisma.purchaseOrder.findMany({
      where: { tenantId, status: status as any },
      include: { vendor: true },
      orderBy: { orderedAt: 'desc' },
      take: 50,
    });
    const rows = pos.map((po) => ({
      poNumber: po.poNumber,
      vendor: po.vendor?.name || '—',
      total: Number(po.totalAmount),
      status: po.status,
      orderedAt: po.orderedAt?.toISOString().slice(0, 10) || '—',
    }));
    return {
      columns: ['PO Number', 'Vendor', 'Total', 'Status', 'Ordered'],
      rows,
    };
  }

  private async drillDownEmployees(tenantId: string, departmentName: string) {
    const employees = await this.prisma.employee.findMany({
      where:
        departmentName === 'Unassigned'
          ? {
              tenantId,
              deletedAt: null,
              status: 'ACTIVE',
              departmentId: null,
            }
          : {
              tenantId,
              deletedAt: null,
              status: 'ACTIVE',
              department: { name: departmentName },
            },
      include: { department: true },
      take: 100,
    });
    const rows = employees.map((e) => ({
      name: e.fullName,
      email: e.email,
      department: e.department?.name || 'Unassigned',
      status: e.status,
    }));
    return {
      columns: ['Name', 'Email', 'Department', 'Status'],
      rows,
    };
  }

  private async drillDownProjects(tenantId: string, status: string) {
    const projects = await this.prisma.project.findMany({
      where: { tenantId, deletedAt: null, status: status as any },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const rows = projects.map((p) => ({
      name: p.name,
      id: p.id.slice(0, 8),
      status: p.status,
      startDate: p.startDate?.toISOString().slice(0, 10) || '—',
      endDate: p.endDate?.toISOString().slice(0, 10) || '—',
    }));
    return {
      columns: ['Name', 'ID', 'Status', 'Start', 'End'],
      rows,
    };
  }

  private async drillDownResources(tenantId: string, projectName: string) {
    const allocations = await this.prisma.resourceAllocation.findMany({
      where: {
        tenantId,
        project: { name: { equals: projectName, mode: 'insensitive' } },
      },
      include: { employee: true, project: true },
    });
    const rows = allocations.map((a) => ({
      employee: a.employee?.fullName || '—',
      project: a.project?.name || '—',
      allocationHours: Number(a.allocatedHours || 0),
      startDate: a.startDate?.toISOString().slice(0, 10) || '—',
      endDate: a.endDate?.toISOString().slice(0, 10) || '—',
    }));
    return {
      columns: ['Employee', 'Project', 'Allocated Hours', 'Start', 'End'],
      rows,
    };
  }
}
