import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Create a dummy Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'amdox-erp' },
    update: {},
    create: {
      name: 'Amdox Corporation',
      slug: 'amdox-erp',
      plan: 'ENTERPRISE',
      settings: { theme: 'dark' },
    },
  });
  console.log('Created Tenant:', tenant.name);

  // 2. Create standard Roles
  const rolesData = [
    { name: 'SuperAdmin', systemRole: 'SUPER_ADMIN' },
    { name: 'TenantAdmin', systemRole: 'TENANT_ADMIN' },
    { name: 'Manager', systemRole: 'MANAGER' },
    { name: 'Viewer', systemRole: 'VIEWER' },
    { name: 'Employee', systemRole: 'EMPLOYEE' },
  ];

  for (const r of rolesData) {
    await prisma.role.upsert({
      where: {
        tenantId_name: {
          tenantId: tenant.id,
          name: r.name,
        }
      },
      update: {
        systemRole: r.systemRole as any,
      },
      create: {
        name: r.name,
        tenantId: tenant.id,
        systemRole: r.systemRole as any,
      },
    });
    console.log('Created/Updated Role:', r.name);
  }

  // 5. Create Standard GL Accounts
  const accountsData = [
    { code: '1000', name: 'Cash', type: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable', type: 'ASSET' },
    { code: '1300', name: 'Inventory Asset', type: 'ASSET' },
    { code: '1500', name: 'Intercompany Receivable', type: 'ASSET' },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
    { code: '2500', name: 'Intercompany Payable', type: 'LIABILITY' },
    { code: '4000', name: 'Sales Revenue', type: 'REVENUE' },
    { code: '5000', name: 'Cost of Goods Sold', type: 'EXPENSE' },
  ];

  for (const acc of accountsData) {
    const createdAcc = await prisma.account.upsert({
      where: {
        tenantId_code: {
          tenantId: tenant.id,
          code: acc.code,
        }
      },
      update: {},
      create: {
        tenantId: tenant.id,
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
      }
    });
    console.log(`Created GL Account: ${createdAcc.code} - ${createdAcc.name}`);
  }

  await seedBiDemoData(tenant.id);

  console.log('Seeding finished successfully!');
}

async function seedBiDemoData(tenantId: string) {
  const financeDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId, name: 'Finance' } },
    update: {},
    create: { tenantId, name: 'Finance', code: 'FIN' },
  });
  const hrDept = await prisma.department.upsert({
    where: { tenantId_name: { tenantId, name: 'Human Resources' } },
    update: {},
    create: { tenantId, name: 'Human Resources', code: 'HR' },
  });
  await prisma.department.upsert({
    where: { tenantId_name: { tenantId, name: 'Operations' } },
    update: {},
    create: { tenantId, name: 'Operations', code: 'OPS' },
  });

  for (const lt of ['Annual Leave', 'Sick Leave']) {
    await prisma.leaveType.upsert({
      where: { tenantId_name: { tenantId, name: lt } },
      update: {},
      create: { tenantId, name: lt, accrualRate: lt === 'Annual Leave' ? 1.17 : 0.5 },
    });
  }

  const demoEmployees = [
    { fullName: 'Alex Morgan', email: 'alex.morgan@amdox.demo', departmentId: financeDept.id },
    { fullName: 'Priya Sharma', email: 'priya.sharma@amdox.demo', departmentId: hrDept.id },
    { fullName: 'Jordan Lee', email: 'jordan.lee@amdox.demo', departmentId: financeDept.id },
  ];
  for (const emp of demoEmployees) {
    await prisma.employee.upsert({
      where: { tenantId_email: { tenantId, email: emp.email } },
      update: {},
      create: {
        tenantId,
        fullName: emp.fullName,
        email: emp.email,
        departmentId: emp.departmentId,
        hireDate: new Date('2024-01-15'),
        status: 'ACTIVE',
      },
    });
  }

  const customer = await prisma.customer.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      tenantId,
      name: 'Acme Industries',
      email: 'billing@acme.demo',
    },
  });

  const now = Date.now();
  const arInvoices = [
    { num: 'AR-1001', daysAgo: 10, amount: 125000, status: 'APPROVED' as const },
    { num: 'AR-1002', daysAgo: 45, amount: 89000, status: 'APPROVED' as const },
    { num: 'AR-1003', daysAgo: 75, amount: 56000, status: 'OVERDUE' as const },
    { num: 'AR-1004', daysAgo: 120, amount: 34000, status: 'OVERDUE' as const },
  ];
  for (const inv of arInvoices) {
    const dueDate = new Date(now - inv.daysAgo * 86400000);
    const issueDate = new Date(dueDate.getTime() - 15 * 86400000);
    await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: inv.num } },
      update: { totalAmount: inv.amount, dueDate, status: inv.status },
      create: {
        tenantId,
        type: 'AR',
        invoiceNumber: inv.num,
        customerId: customer.id,
        status: inv.status,
        issueDate,
        dueDate,
        totalAmount: inv.amount,
      },
    });
  }

  const warehouse = await prisma.warehouse.upsert({
    where: { id: '00000000-0000-4000-8000-000000000010' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000010',
      tenantId,
      name: 'Main Warehouse',
      location: 'Mumbai',
    },
  });

  const products = [
    { sku: 'SKU-001', name: 'Laptop Dock', qty: 120 },
    { sku: 'SKU-002', name: 'Office Chair', qty: 45 },
    { sku: 'SKU-003', name: 'Network Switch', qty: 18 },
    { sku: 'SKU-004', name: 'Monitor 27"', qty: 62 },
  ];
  for (const p of products) {
    const product = await prisma.product.upsert({
      where: { tenantId_sku: { tenantId, sku: p.sku } },
      update: {},
      create: {
        tenantId,
        sku: p.sku,
        name: p.name,
        unitCost: 5000,
      },
    });
    await prisma.stockLevel.upsert({
      where: { productId_warehouseId: { productId: product.id, warehouseId: warehouse.id } },
      update: { quantity: p.qty },
      create: {
        tenantId,
        productId: product.id,
        warehouseId: warehouse.id,
        quantity: p.qty,
      },
    });
  }

  await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000020' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000020',
      tenantId,
      name: 'ERP Rollout',
      status: 'ACTIVE',
      startDate: new Date('2025-06-01'),
    },
  });
  await prisma.project.upsert({
    where: { id: '00000000-0000-4000-8000-000000000021' },
    update: {},
    create: {
      id: '00000000-0000-4000-8000-000000000021',
      tenantId,
      name: 'Warehouse Automation',
      status: 'PLANNING',
    },
  });

  const existingDashboard = await prisma.dashboard.findFirst({
    where: { tenantId, name: 'Operations overview', deletedAt: null },
  });
  if (!existingDashboard) {
    const dashboard = await prisma.dashboard.create({
      data: {
        tenantId,
        name: 'Operations overview',
        layout: {
          lg: [
            { i: 'w-ar', x: 0, y: 0, w: 6, h: 4 },
            { i: 'w-inv', x: 6, y: 0, w: 6, h: 4 },
          ],
        },
      },
    });
    await prisma.widget.createMany({
      data: [
        {
          id: 'w-ar',
          tenantId,
          dashboardId: dashboard.id,
          type: 'pie',
          config: { title: 'AR aging', dataSource: 'ar_aging' },
        },
        {
          id: 'w-inv',
          tenantId,
          dashboardId: dashboard.id,
          type: 'bar',
          config: { title: 'Inventory levels', dataSource: 'inventory' },
        },
      ],
    });
    console.log('Created BI demo dashboard:', dashboard.name);
  }

  console.log('BI demo data seeded.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
