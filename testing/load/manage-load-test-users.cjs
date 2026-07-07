#!/usr/bin/env node
// Provisions (or tears down) a pool of real Keycloak + DB users for the
// Day 21 k6 load test, so 2,000 VUs can spread across many distinct
// identities instead of sharing one shared login — see
// testing/K6_LOAD_TEST_LOG.md for why that matters (the per-user rate
// limiter otherwise treats 2,000 VUs sharing one login as one abusive
// caller, not 2,000 real users).
//
// All tunables come from the root .env (LOAD_TEST_* keys) — nothing here
// is hardcoded, so the pool size / prefix / password / tenant can be
// changed in one place.
//
// Usage:
//   node --env-file=.env testing/load/manage-load-test-users.js create
//   node --env-file=.env testing/load/manage-load-test-users.js delete

const fs = require('fs');
const path = require('path');
// testing/load isn't its own workspace package, so @prisma/client (a plain
// dependency of packages/db, isolated there by pnpm) doesn't resolve from
// here directly — point at it explicitly instead of hoisting/duplicating it.
const { PrismaClient } = require(
  path.join(__dirname, '../../packages/db/node_modules/@prisma/client'),
);

const KEYCLOAK_BASE_URL = process.env.KEYCLOAK_BASE_URL || 'http://localhost:8180';
const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME || 'admin';
const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD;
const REALM = process.env.LOAD_TEST_TENANT_SLUG || 'company-a';
const POOL_SIZE = parseInt(process.env.LOAD_TEST_USER_POOL_SIZE || '0', 10);
const PREFIX = process.env.LOAD_TEST_USER_PREFIX || 'loadtest-user';
const PASSWORD = process.env.LOAD_TEST_USER_PASSWORD;
const TOKEN_LIFESPAN = parseInt(process.env.LOAD_TEST_TOKEN_LIFESPAN_SECONDS || '1800', 10);

const STATE_FILE = path.join(__dirname, '.load-test-state.json');

const prisma = new PrismaClient();

function usernameFor(i) {
  return `${PREFIX}-${i}@companya.in`;
}

async function getAdminToken() {
  const res = await fetch(`${KEYCLOAK_BASE_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=password&client_id=admin-cli&username=${KEYCLOAK_ADMIN_USERNAME}&password=${KEYCLOAK_ADMIN_PASSWORD}`,
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Keycloak admin auth failed: ${JSON.stringify(data)}`);
  return data.access_token;
}

async function kc(adminToken, method, urlPath, body) {
  return fetch(`${KEYCLOAK_BASE_URL}${urlPath}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function create() {
  if (POOL_SIZE <= 0) {
    console.log('LOAD_TEST_USER_POOL_SIZE is 0 in .env — nothing to create.');
    return;
  }
  if (!PASSWORD) throw new Error('LOAD_TEST_USER_PASSWORD is not set in .env');

  const adminToken = await getAdminToken();

  // Save the realm's current accessTokenLifespan before changing it, so
  // `delete` can restore the exact original value later. Guarded so
  // re-running `create` (e.g. after a partial failure) never overwrites an
  // already-saved original with the temporarily-bumped value.
  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    console.log(
      `${STATE_FILE} already exists (original lifespan ${state.originalLifespan}s saved) — ` +
        `skipping the bump step, realm should already be at ${TOKEN_LIFESPAN}s.`,
    );
  } else {
    const realmRes = await kc(adminToken, 'GET', `/admin/realms/${REALM}`);
    const realm = await realmRes.json();
    const originalLifespan = realm.accessTokenLifespan;
    fs.writeFileSync(STATE_FILE, JSON.stringify({ originalLifespan, realm: REALM }, null, 2));
    await kc(adminToken, 'PUT', `/admin/realms/${REALM}`, { accessTokenLifespan: TOKEN_LIFESPAN });
    console.log(
      `Realm "${REALM}" accessTokenLifespan: ${originalLifespan}s -> ${TOKEN_LIFESPAN}s ` +
        `(original saved to ${STATE_FILE})`,
    );
  }

  const tenant = await prisma.tenant.findFirst({ where: { slug: REALM } });
  if (!tenant) throw new Error(`No tenant found with slug "${REALM}"`);
  // Seeded role name varies by tenant ("TenantAdmin" vs "Tenant Admin" —
  // RolesGuard strips spaces as a safety net for exactly this reason).
  const roles = await prisma.role.findMany({ where: { tenantId: tenant.id } });
  const role = roles.find((r) => r.name.replace(/\s+/g, '').toLowerCase() === 'tenantadmin');
  if (!role) {
    throw new Error(
      `No TenantAdmin-equivalent role found for tenant "${REALM}" (found: ${roles.map((r) => r.name).join(', ')})`,
    );
  }

  let created = 0;
  let skipped = 0;
  for (let i = 1; i <= POOL_SIZE; i++) {
    const username = usernameFor(i);

    // Idempotent: safe to re-run `create` without duplicating existing pool users.
    const existing = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: username },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const createRes = await kc(adminToken, 'POST', `/admin/realms/${REALM}/users`, {
      username,
      email: username,
      // Without firstName/lastName, Keycloak's profile-completeness check
      // rejects direct-grant login with "Account is not fully set up"
      // even though requiredActions reads back empty — found by comparing
      // against the working admin@companya.in user, which has both set.
      firstName: 'Load',
      lastName: `Test${i}`,
      enabled: true,
      emailVerified: true,
      credentials: [{ type: 'password', value: PASSWORD, temporary: false }],
    });

    if (createRes.status !== 201) {
      const body = await createRes.text();
      console.error(`  Keycloak user create failed for ${username}: ${createRes.status} ${body}`);
      continue;
    }

    const location = createRes.headers.get('location');
    const kcUserId = location.split('/').pop();

    const dbUser = await prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: username,
        fullName: `Load Test User ${i}`,
        ssoSubject: kcUserId,
        isActive: true,
      },
    });

    await prisma.userRole.create({
      data: { tenantId: tenant.id, userId: dbUser.id, roleId: role.id },
    });

    created++;
    if (created % 25 === 0) console.log(`  ...${created}/${POOL_SIZE} created`);
  }
  console.log(
    `Done. Created ${created}, skipped ${skipped} already-existing (pool target: ${POOL_SIZE}).`,
  );
}

async function del() {
  const adminToken = await getAdminToken();

  const tenant = await prisma.tenant.findFirst({ where: { slug: REALM } });
  if (tenant) {
    const users = await prisma.user.findMany({
      where: { tenantId: tenant.id, email: { startsWith: `${PREFIX}-` } },
    });
    console.log(`Found ${users.length} pool users in DB to remove.`);

    for (const u of users) {
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
      if (u.ssoSubject) {
        await kc(adminToken, 'DELETE', `/admin/realms/${REALM}/users/${u.ssoSubject}`);
      }
    }
    console.log(`Deleted ${users.length} pool users (Keycloak + DB).`);
  } else {
    console.log(`No tenant found with slug "${REALM}" — nothing to delete there.`);
  }

  if (fs.existsSync(STATE_FILE)) {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    await kc(adminToken, 'PUT', `/admin/realms/${state.realm}`, {
      accessTokenLifespan: state.originalLifespan,
    });
    console.log(
      `Restored realm "${state.realm}" accessTokenLifespan to ${state.originalLifespan}s.`,
    );
    fs.unlinkSync(STATE_FILE);
  } else {
    console.log('No saved state file found — token lifespan left unchanged.');
  }
}

async function main() {
  const mode = process.argv[2];
  if (mode === 'create') await create();
  else if (mode === 'delete') await del();
  else {
    console.error('Usage: node manage-load-test-users.js <create|delete>');
    process.exit(1);
  }
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
