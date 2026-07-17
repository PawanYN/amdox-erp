/**
 * Backfill Department.allowedModules for company-a from department codes.
 * Usage: node scripts/backfill-company-a-department-modules.mjs
 */
import { execSync } from 'node:child_process';

const MAP = {
  HR: ['hr'],
  FIN: ['finance'],
  SCM: ['scm', 'forecast'],
  PM: ['projects'],
  IT: ['settings'],
};

function psql(sql) {
  return execSync(
    `docker exec amdox-postgres psql -U amdox -d amdox_erp -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' },
  ).trim();
}

function toPgArray(arr) {
  return `{${arr.join(',')}}`;
}

const tenantId = psql(`SELECT id FROM erp."Tenant" WHERE slug = 'company-a';`);
if (!tenantId) {
  console.error('company-a tenant not found');
  process.exit(1);
}

const rows = psql(
  `SELECT id || '|' || code FROM erp."Department" WHERE "tenantId" = '${tenantId}';`,
)
  .split('\n')
  .filter(Boolean);

for (const row of rows) {
  const [id, code] = row.split('|');
  const mods = MAP[code.trim().toUpperCase()];
  if (!mods) {
    console.log(`  skip ${code} — no default map`);
    continue;
  }
  psql(`UPDATE erp."Department" SET "allowedModules" = '${toPgArray(mods)}' WHERE id = '${id}';`);
  console.log(`  ${code} → [${mods.join(', ')}]`);
}

console.log('Done.');
