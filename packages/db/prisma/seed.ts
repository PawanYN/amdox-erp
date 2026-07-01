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
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
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

  console.log('Seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
