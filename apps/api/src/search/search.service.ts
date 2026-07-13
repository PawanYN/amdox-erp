import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client } from '@elastic/elasticsearch';
import { prisma } from '@amdox/db';

// ── Index name constants ─────────────────────────────────────────────────────
const VENDOR_INDEX = 'amdox_vendors';
const PRODUCT_INDEX = 'amdox_products';
const EMPLOYEE_INDEX = 'amdox_employees';
const PURCHASE_ORDER_INDEX = 'amdox_purchase_orders';
const INVOICE_INDEX = 'amdox_invoices';
const CUSTOMER_INDEX = 'amdox_customers';
const PROJECT_INDEX = 'amdox_projects';
const LEAVE_REQUEST_INDEX = 'amdox_leave_requests';
const AUDIT_LOG_INDEX = 'amdox_audit_logs';
const JOURNAL_ENTRY_INDEX = 'amdox_journal_entries';

const ALL_INDICES = [
  VENDOR_INDEX,
  PRODUCT_INDEX,
  EMPLOYEE_INDEX,
  PURCHASE_ORDER_INDEX,
  INVOICE_INDEX,
  CUSTOMER_INDEX,
  PROJECT_INDEX,
  LEAVE_REQUEST_INDEX,
  AUDIT_LOG_INDEX,
  JOURNAL_ENTRY_INDEX,
];

// ── Per-index field mappings ──────────────────────────────────────────────────
const INDEX_MAPPINGS: Record<string, Record<string, object>> = {
  [VENDOR_INDEX]: {
    tenantId: { type: 'keyword' },
    name: { type: 'text' },
    email: { type: 'keyword' },
  },
  [PRODUCT_INDEX]: {
    tenantId: { type: 'keyword' },
    name: { type: 'text' },
    sku: { type: 'keyword' },
  },
  [EMPLOYEE_INDEX]: {
    tenantId: { type: 'keyword' },
    fullName: { type: 'text' },
    email: { type: 'keyword' },
    designation: { type: 'text' },
    department: { type: 'text' },
    status: { type: 'keyword' },
  },
  [PURCHASE_ORDER_INDEX]: {
    tenantId: { type: 'keyword' },
    poNumber: { type: 'keyword' },
    vendorName: { type: 'text' },
    status: { type: 'keyword' },
    totalAmount: { type: 'double' },
  },
  [INVOICE_INDEX]: {
    tenantId: { type: 'keyword' },
    invoiceNumber: { type: 'keyword' },
    type: { type: 'keyword' },
    status: { type: 'keyword' },
    vendorName: { type: 'text' },
    customerName: { type: 'text' },
    totalAmount: { type: 'double' },
  },
  [CUSTOMER_INDEX]: {
    tenantId: { type: 'keyword' },
    name: { type: 'text' },
    email: { type: 'keyword' },
    isActive: { type: 'boolean' },
  },
  [PROJECT_INDEX]: {
    tenantId: { type: 'keyword' },
    name: { type: 'text' },
    description: { type: 'text' },
    status: { type: 'keyword' },
  },
  [LEAVE_REQUEST_INDEX]: {
    tenantId: { type: 'keyword' },
    employeeName: { type: 'text' },
    status: { type: 'keyword' },
    startDate: { type: 'date' },
    endDate: { type: 'date' },
  },
  [AUDIT_LOG_INDEX]: {
    tenantId: { type: 'keyword' },
    action: { type: 'keyword' },
    entityType: { type: 'keyword' },
    entityId: { type: 'keyword' },
    description: { type: 'text' },
  },
  [JOURNAL_ENTRY_INDEX]: {
    tenantId: { type: 'keyword' },
    reference: { type: 'keyword' },
    description: { type: 'text' },
    sourceModule: { type: 'keyword' },
    status: { type: 'keyword' },
  },
};

// ── Search fields per index (for multi_match) ─────────────────────────────────
const SEARCH_FIELDS: Record<string, string[]> = {
  [VENDOR_INDEX]: ['name', 'email'],
  [PRODUCT_INDEX]: ['name', 'sku'],
  [EMPLOYEE_INDEX]: ['fullName', 'email', 'designation', 'department'],
  [PURCHASE_ORDER_INDEX]: ['poNumber', 'vendorName'],
  [INVOICE_INDEX]: ['invoiceNumber', 'vendorName', 'customerName'],
  [CUSTOMER_INDEX]: ['name', 'email'],
  [PROJECT_INDEX]: ['name', 'description'],
  [LEAVE_REQUEST_INDEX]: ['employeeName'],
  [AUDIT_LOG_INDEX]: ['description', 'entityType'],
  [JOURNAL_ENTRY_INDEX]: ['reference', 'description', 'sourceModule'],
};

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private readonly client: Client;
  private readonly enabled: boolean;

  constructor() {
    const node = process.env.ELASTICSEARCH_URL || 'http://localhost:9200';
    // ES SDK v9 sends `compatible-with=9` headers by default; ES 8.x server rejects them.
    // Override with plain JSON headers for cross-version compatibility.
    this.client = new Client({
      node,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    });
    this.enabled = process.env.ELASTICSEARCH_ENABLED !== 'false';
  }

  async onModuleInit() {
    if (!this.enabled) return;
    try {
      await this.ensureIndices();
      // Reindex all tenants that have actual data
      const tenants = await prisma.tenant.findMany({ select: { id: true } });
      await Promise.all(tenants.map((t) => this.reindexAll(t.id).catch(() => undefined)));
    } catch (err) {
      this.logger.warn(`Elasticsearch init skipped: ${(err as Error).message}`);
    }
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async ping(): Promise<'connected' | 'disconnected'> {
    if (!this.enabled) return 'disconnected';
    try {
      const res = await this.client.ping();
      return res ? 'connected' : 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  // ── Index bootstrap ────────────────────────────────────────────────────────

  private async ensureIndices() {
    for (const index of ALL_INDICES) {
      const exists = await this.client.indices.exists({ index });
      if (!exists) {
        await this.client.indices.create({
          index,
          mappings: { properties: INDEX_MAPPINGS[index] },
        });
      }
    }
  }

  // ── Private helper ─────────────────────────────────────────────────────────

  // Wraps client.search with explicit any to bypass strict ES SDK v9 query DSL union types.
   
  private searchIndex(index: string, size: number, query: any): Promise<any> {
     
    return (this.client.search as any)({ index, size, query });
  }

  private async safeIndex(index: string, id: string, document: object): Promise<void> {
    try {
      await this.client.index({ index, id, document });
    } catch (err) {
      this.logger.warn(`ES index failed [${index}/${id}]: ${(err as Error).message}`);
    }
  }

  // ── Bulk reindex ───────────────────────────────────────────────────────────

  async reindexAll(tenantId: string) {
    const [
      vendors,
      products,
      employees,
      purchaseOrders,
      invoices,
      customers,
      projects,
      leaveRequests,
      auditLogs,
      journalEntries,
    ] = await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, tenantId: true, name: true, email: true },
      }),
      prisma.product.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, tenantId: true, name: true, sku: true },
      }),
      prisma.employee.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          fullName: true,
          email: true,
          designation: true,
          status: true,
          department: { select: { name: true } },
        },
      }),
      prisma.purchaseOrder.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          poNumber: true,
          status: true,
          totalAmount: true,
          vendor: true,
        },
      }),
      prisma.invoice.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          invoiceNumber: true,
          type: true,
          status: true,
          totalAmount: true,
          vendor: true,
          customer: true,
        },
      }),
      prisma.customer.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, tenantId: true, name: true, email: true, isActive: true },
      }),
      prisma.project.findMany({
        where: { tenantId, deletedAt: null },
        select: { id: true, tenantId: true, name: true, description: true, status: true },
      }),
      prisma.leaveRequest.findMany({
        where: { tenantId },
        select: {
          id: true,
          tenantId: true,
          status: true,
          startDate: true,
          endDate: true,
          employee: { select: { fullName: true } },
        },
      }),
      prisma.auditLog.findMany({
        where: { tenantId },
        select: { id: true, tenantId: true, action: true, entityType: true, entityId: true },
      }),
      prisma.journalEntry.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          tenantId: true,
          reference: true,
          description: true,
          sourceModule: true,
          status: true,
        },
      }),
    ]);

    const bulkOps: Array<{ ops: object[]; index: string; count: number }> = [
      {
        index: VENDOR_INDEX,
        count: vendors.length,
        ops: vendors.flatMap((v) => [
          { index: { _index: VENDOR_INDEX, _id: v.id } },
          { tenantId: v.tenantId, name: v.name, email: v.email ?? '' },
        ]),
      },
      {
        index: PRODUCT_INDEX,
        count: products.length,
        ops: products.flatMap((p) => [
          { index: { _index: PRODUCT_INDEX, _id: p.id } },
          { tenantId: p.tenantId, name: p.name, sku: p.sku },
        ]),
      },
      {
        index: EMPLOYEE_INDEX,
        count: employees.length,
        ops: employees.flatMap((e) => [
          { index: { _index: EMPLOYEE_INDEX, _id: e.id } },
          {
            tenantId: e.tenantId,
            fullName: e.fullName,
            email: e.email,
            designation: e.designation ?? '',
            department: e.department?.name ?? '',
            status: e.status,
          },
        ]),
      },
      {
        index: PURCHASE_ORDER_INDEX,
        count: purchaseOrders.length,
        ops: purchaseOrders.flatMap((po) => [
          { index: { _index: PURCHASE_ORDER_INDEX, _id: po.id } },
          {
            tenantId: po.tenantId,
            poNumber: po.poNumber,
            vendorName: po.vendor?.name ?? '',
            status: po.status,
            totalAmount: Number(po.totalAmount),
          },
        ]),
      },
      {
        index: INVOICE_INDEX,
        count: invoices.length,
        ops: invoices.flatMap((inv) => [
          { index: { _index: INVOICE_INDEX, _id: inv.id } },
          {
            tenantId: inv.tenantId,
            invoiceNumber: inv.invoiceNumber,
            type: inv.type,
            status: inv.status,
            vendorName: inv.vendor?.name ?? '',
            customerName: inv.customer?.name ?? '',
            totalAmount: Number(inv.totalAmount),
          },
        ]),
      },
      {
        index: CUSTOMER_INDEX,
        count: customers.length,
        ops: customers.flatMap((c) => [
          { index: { _index: CUSTOMER_INDEX, _id: c.id } },
          { tenantId: c.tenantId, name: c.name, email: c.email ?? '', isActive: c.isActive },
        ]),
      },
      {
        index: PROJECT_INDEX,
        count: projects.length,
        ops: projects.flatMap((p) => [
          { index: { _index: PROJECT_INDEX, _id: p.id } },
          {
            tenantId: p.tenantId,
            name: p.name,
            description: p.description ?? '',
            status: p.status,
          },
        ]),
      },
      {
        index: LEAVE_REQUEST_INDEX,
        count: leaveRequests.length,
        ops: leaveRequests.flatMap((lr) => [
          { index: { _index: LEAVE_REQUEST_INDEX, _id: lr.id } },
          {
            tenantId: lr.tenantId,
            employeeName: lr.employee?.fullName ?? '',
            status: lr.status,
            startDate: lr.startDate.toISOString(),
            endDate: lr.endDate.toISOString(),
          },
        ]),
      },
      {
        index: AUDIT_LOG_INDEX,
        count: auditLogs.length,
        ops: auditLogs.flatMap((al) => [
          { index: { _index: AUDIT_LOG_INDEX, _id: al.id } },
          {
            tenantId: al.tenantId,
            action: al.action,
            entityType: al.entityType,
            entityId: al.entityId,
            description: `${al.action} ${al.entityType}`,
          },
        ]),
      },
      {
        index: JOURNAL_ENTRY_INDEX,
        count: journalEntries.length,
        ops: journalEntries.flatMap((je) => [
          { index: { _index: JOURNAL_ENTRY_INDEX, _id: je.id } },
          {
            tenantId: je.tenantId,
            reference: je.reference,
            description: je.description ?? '',
            sourceModule: je.sourceModule ?? '',
            status: je.status,
          },
        ]),
      },
    ];

    const results: Record<string, number> = {};
    for (const { ops, index, count } of bulkOps) {
      if (ops.length) await this.client.bulk({ refresh: true, operations: ops });
      results[index] = count;
    }

    return {
      vendors: vendors.length,
      products: products.length,
      employees: employees.length,
      purchaseOrders: purchaseOrders.length,
      invoices: invoices.length,
      customers: customers.length,
      projects: projects.length,
      leaveRequests: leaveRequests.length,
      auditLogs: auditLogs.length,
      journalEntries: journalEntries.length,
    };
  }

  // ── Real-time index methods ────────────────────────────────────────────────

  async indexEmployee(emp: {
    id: string;
    tenantId: string;
    fullName: string;
    email: string;
    designation?: string | null;
    department?: { name?: string | null } | null;
    status: string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(EMPLOYEE_INDEX, emp.id, {
      tenantId: emp.tenantId,
      fullName: emp.fullName,
      email: emp.email,
      designation: emp.designation ?? '',
      department: emp.department?.name ?? '',
      status: emp.status,
    });
  }

  async removeEmployee(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: EMPLOYEE_INDEX, id });
    } catch (err) {
      this.logger.warn(`ES delete failed [${EMPLOYEE_INDEX}/${id}]: ${(err as Error).message}`);
    }
  }

  async indexPurchaseOrder(po: {
    id: string;
    tenantId: string;
    poNumber: string;
    vendor?: { name?: string | null } | null;
    status: string;
    totalAmount: number | string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(PURCHASE_ORDER_INDEX, po.id, {
      tenantId: po.tenantId,
      poNumber: po.poNumber,
      vendorName: po.vendor?.name ?? '',
      status: po.status,
      totalAmount: Number(po.totalAmount),
    });
  }

  async removePurchaseOrder(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: PURCHASE_ORDER_INDEX, id });
    } catch (err) {
      this.logger.warn(
        `ES delete failed [${PURCHASE_ORDER_INDEX}/${id}]: ${(err as Error).message}`,
      );
    }
  }

  async indexInvoice(inv: {
    id: string;
    tenantId: string;
    invoiceNumber: string;
    type: string;
    status: string;
    vendor?: { name?: string | null } | null;
    customer?: { name?: string | null } | null;
    totalAmount: number | string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(INVOICE_INDEX, inv.id, {
      tenantId: inv.tenantId,
      invoiceNumber: inv.invoiceNumber,
      type: inv.type,
      status: inv.status,
      vendorName: inv.vendor?.name ?? '',
      customerName: inv.customer?.name ?? '',
      totalAmount: Number(inv.totalAmount),
    });
  }

  async removeInvoice(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: INVOICE_INDEX, id });
    } catch (err) {
      this.logger.warn(`ES delete failed [${INVOICE_INDEX}/${id}]: ${(err as Error).message}`);
    }
  }

  async indexCustomer(c: {
    id: string;
    tenantId: string;
    name: string;
    email?: string | null;
    isActive: boolean;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(CUSTOMER_INDEX, c.id, {
      tenantId: c.tenantId,
      name: c.name,
      email: c.email ?? '',
      isActive: c.isActive,
    });
  }

  async removeCustomer(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: CUSTOMER_INDEX, id });
    } catch (err) {
      this.logger.warn(`ES delete failed [${CUSTOMER_INDEX}/${id}]: ${(err as Error).message}`);
    }
  }

  async indexProject(p: {
    id: string;
    tenantId: string;
    name: string;
    description?: string | null;
    status: string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(PROJECT_INDEX, p.id, {
      tenantId: p.tenantId,
      name: p.name,
      description: p.description ?? '',
      status: p.status,
    });
  }

  async removeProject(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: PROJECT_INDEX, id });
    } catch (err) {
      this.logger.warn(`ES delete failed [${PROJECT_INDEX}/${id}]: ${(err as Error).message}`);
    }
  }

  async indexLeaveRequest(lr: {
    id: string;
    tenantId: string;
    employee?: { fullName?: string | null } | null;
    status: string;
    startDate: Date | string;
    endDate: Date | string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(LEAVE_REQUEST_INDEX, lr.id, {
      tenantId: lr.tenantId,
      employeeName: lr.employee?.fullName ?? '',
      status: lr.status,
      startDate: lr.startDate instanceof Date ? lr.startDate.toISOString() : lr.startDate,
      endDate: lr.endDate instanceof Date ? lr.endDate.toISOString() : lr.endDate,
    });
  }

  async removeLeaveRequest(id: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await this.client.delete({ index: LEAVE_REQUEST_INDEX, id });
    } catch (err) {
      this.logger.warn(
        `ES delete failed [${LEAVE_REQUEST_INDEX}/${id}]: ${(err as Error).message}`,
      );
    }
  }

  async indexAuditLog(al: {
    id: string;
    tenantId: string;
    action: string;
    entityType: string;
    entityId: string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(AUDIT_LOG_INDEX, al.id, {
      tenantId: al.tenantId,
      action: al.action,
      entityType: al.entityType,
      entityId: al.entityId,
      description: `${al.action} ${al.entityType}`,
    });
  }

  async indexJournalEntry(je: {
    id: string;
    tenantId: string;
    reference: string;
    description?: string | null;
    sourceModule?: string | null;
    status: string;
  }): Promise<void> {
    if (!this.enabled) return;
    await this.safeIndex(JOURNAL_ENTRY_INDEX, je.id, {
      tenantId: je.tenantId,
      reference: je.reference,
      description: je.description ?? '',
      sourceModule: je.sourceModule ?? '',
      status: je.status,
    });
  }

  // ── Global search ─────────────────────────────────────────────────────────

  async search(tenantId: string, query: string, limit = 20) {
    if (!this.enabled) {
      return this.dbFallbackSearch(tenantId, query, limit);
    }

    try {
      const buildQuery = (fields: string[]) => ({
        bool: {
          must: [{ term: { tenantId } }, { multi_match: { query, fields, fuzziness: 'AUTO' } }],
        },
      });

      const indexKeys: Array<[string, string]> = [
        ['vendors', VENDOR_INDEX],
        ['products', PRODUCT_INDEX],
        ['employees', EMPLOYEE_INDEX],
        ['purchaseOrders', PURCHASE_ORDER_INDEX],
        ['invoices', INVOICE_INDEX],
        ['customers', CUSTOMER_INDEX],
        ['projects', PROJECT_INDEX],
        ['leaveRequests', LEAVE_REQUEST_INDEX],
        ['auditLogs', AUDIT_LOG_INDEX],
        ['journalEntries', JOURNAL_ENTRY_INDEX],
      ];

      const results = await Promise.all(
        indexKeys.map(([, idx]) => this.searchIndex(idx, limit, buildQuery(SEARCH_FIELDS[idx]))),
      );

       
      const toHits = (res: any) =>
         
        (res?.hits?.hits ?? []).map((h: any) => ({ id: h._id, ...(h._source as object) }));

       
      return indexKeys.reduce<Record<string, any[]>>((acc, [key], i) => {
        acc[key] = toHits(results[i]);
        return acc;
      }, {});
    } catch (err) {
      this.logger.warn(`ES search failed, using DB fallback: ${(err as Error).message}`);
      return this.dbFallbackSearch(tenantId, query, limit);
    }
  }

  // ── DB fallback ────────────────────────────────────────────────────────────

  private async dbFallbackSearch(tenantId: string, query: string, limit: number) {
    const q = { contains: query, mode: 'insensitive' as const };

    const [vendors, products, employees, customers, projects] = await Promise.all([
      prisma.vendor.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: q }, { email: q }] },
        take: limit,
        select: { id: true, name: true, email: true },
      }),
      prisma.product.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: q }, { sku: q }] },
        take: limit,
        select: { id: true, name: true, sku: true },
      }),
      prisma.employee.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ fullName: q }, { email: q }, { designation: q }],
        },
        take: limit,
        select: { id: true, fullName: true, email: true, designation: true, status: true },
      }),
      prisma.customer.findMany({
        where: { tenantId, deletedAt: null, OR: [{ name: q }, { email: q }] },
        take: limit,
        select: { id: true, name: true, email: true, isActive: true },
      }),
      prisma.project.findMany({
        where: {
          tenantId,
          deletedAt: null,
          OR: [{ name: q }, { description: q }],
        },
        take: limit,
        select: { id: true, name: true, description: true, status: true },
      }),
    ]);

    return {
      vendors,
      products,
      employees,
      purchaseOrders: [],
      invoices: [],
      customers,
      projects,
      leaveRequests: [],
      auditLogs: [],
      journalEntries: [],
    };
  }
}
