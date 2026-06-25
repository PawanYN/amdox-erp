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
      plan: 'enterprise',
      settings: { theme: 'dark' },
    },
  });
  console.log('Created Tenant:', tenant.name);

  // 2. Create standard Roles
  const rolesData = [
    { name: 'SuperAdmin', permissions: { all: true } },
    { name: 'TenantAdmin', permissions: { manage_tenant: true, view_all: true } },
    { name: 'Manager', permissions: { manage_team: true, view_team: true } },
    { name: 'Viewer', permissions: { view_only: true } },
  ];

  const createdRoles = [];
  for (const r of rolesData) {
    const role = await prisma.role.create({
      data: {
        name: r.name,
        tenantId: tenant.id,
        permissions: r.permissions,
      },
    });
    createdRoles.push(role);
    console.log('Created Role:', role.name);
  }
  
  const superAdminRole = createdRoles.find(r => r.name === 'SuperAdmin')!;

  // 3. Create the User (matching your Keycloak ID)
  const user = await prisma.user.upsert({
    where: { keycloakId: 'cc73ff3c-761c-480e-a7f1-ba3dc70c14f6' },
    update: {},
    create: {
      email: 'pawannannaware16@gmail.com',
      firstName: 'PAWAN',
      lastName: 'NANNAWARE',
      keycloakId: 'cc73ff3c-761c-480e-a7f1-ba3dc70c14f6',
      tenantId: tenant.id,
    },
  });
  console.log('Created User:', user.email);

  // 4. Assign the Role to the User
  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: superAdminRole.id,
      tenantId: tenant.id,
    },
  });
  console.log('Assigned SuperAdmin role to user');

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
