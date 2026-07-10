/**
 * Delete all company-a employees via API, purge DB/KC records, recreate via API.
 * Prints new login passwords in the API terminal (yellow credential box).
 *
 * Usage: node scripts/recreate-company-a-employees.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const REALM = 'company-a';
const ADMIN_EMAIL = 'admin@companya.in';
const ADMIN_PASSWORD = 'Admin123!';

const MANAGERS = [
  {
    firstName: 'Priya',
    lastName: 'Sharma',
    email: 'priya.sharma@companya.in',
    designation: 'HR Manager',
    deptCode: 'HR',
  },
  {
    firstName: 'Vikram',
    lastName: 'Mehta',
    email: 'vikram.mehta@companya.in',
    designation: 'Finance Manager',
    deptCode: 'FIN',
  },
  {
    firstName: 'Neha',
    lastName: 'Kapoor',
    email: 'neha.kapoor@companya.in',
    designation: 'SCM Manager',
    deptCode: 'SCM',
  },
  {
    firstName: 'Rohan',
    lastName: 'Das',
    email: 'rohan.das@companya.in',
    designation: 'Project Manager',
    deptCode: 'PM',
  },
  {
    firstName: 'Karan',
    lastName: 'Singh',
    email: 'karan.singh@companya.in',
    designation: 'IT Administrator',
    deptCode: 'IT',
  },
];

const STAFF = [
  {
    firstName: 'Ananya',
    lastName: 'Rao',
    email: 'ananya.rao@companya.in',
    designation: 'HR Executive',
    deptCode: 'HR',
    managerEmail: 'priya.sharma@companya.in',
  },
  {
    firstName: 'Amit',
    lastName: 'Joshi',
    email: 'amit.joshi@companya.in',
    designation: 'Accountant',
    deptCode: 'FIN',
    managerEmail: 'vikram.mehta@companya.in',
  },
  {
    firstName: 'Sara',
    lastName: 'Thomas',
    email: 'sara.thomas@companya.in',
    designation: 'Supply Coordinator',
    deptCode: 'SCM',
    managerEmail: 'neha.kapoor@companya.in',
  },
  {
    firstName: 'Dev',
    lastName: 'Nair',
    email: 'dev.nair@companya.in',
    designation: 'Project Coordinator',
    deptCode: 'PM',
    managerEmail: 'rohan.das@companya.in',
  },
  {
    firstName: 'Meera',
    lastName: 'Iyer',
    email: 'meera.iyer@companya.in',
    designation: 'IT Support',
    deptCode: 'IT',
    managerEmail: 'karan.singh@companya.in',
  },
];

async function getToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: 'amdox-erp-web',
    username: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  const res = await fetch(`http://localhost:8180/realms/${REALM}/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Token failed: ${data.error_description || res.status}`);
  return data.access_token;
}

async function api(token, path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function psql(sql) {
  return execSync(
    `docker exec amdox-postgres psql -U amdox -d amdox_erp -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' },
  ).trim();
}

function purgeDb(tenantId) {
  console.log('\n[2/4] Purging employee + user records from DB...');
  const statements = [
    `DELETE FROM erp."LeaveBalance" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."LeaveRequest" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."AttendanceRecord" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."Payslip" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."ResourceAllocation" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."EmploymentContract" WHERE "employeeId" IN (SELECT id FROM erp."Employee" WHERE "tenantId" = '${tenantId}');`,
    `DELETE FROM erp."Employee" WHERE "tenantId" = '${tenantId}';`,
    `DELETE FROM erp."UserRole" WHERE "userId" IN (SELECT id FROM erp."User" WHERE "tenantId" = '${tenantId}' AND email != '${ADMIN_EMAIL}');`,
    `DELETE FROM erp."User" WHERE "tenantId" = '${tenantId}' AND email != '${ADMIN_EMAIL}';`,
  ];
  for (const sql of statements) psql(sql);
  console.log('  DB purge done.');
}

function purgeKeycloak() {
  console.log('\n[3/4] Removing Keycloak users (except admin)...');
  const KC = '/opt/keycloak/bin/kcadm.sh';
  execSync(
    `docker exec amdox-keycloak ${KC} config credentials --server http://localhost:8080 --realm master --user admin --password admin`,
    { stdio: 'ignore' },
  );
  const emails = [...MANAGERS, ...STAFF].map((e) => e.email);
  for (const email of emails) {
    try {
      const uid = execSync(
        `docker exec amdox-keycloak ${KC} get users -r ${REALM} -q username=${email} --fields id --format csv --noquotes 2>/dev/null | tail -1`,
        { encoding: 'utf8' },
      ).trim();
      if (uid && uid !== 'id') {
        execSync(`docker exec amdox-keycloak ${KC} delete users/${uid} -r ${REALM}`, {
          stdio: 'ignore',
        });
        console.log(`  KC deleted: ${email}`);
      }
    } catch {
      console.log(`  KC skip: ${email}`);
    }
  }
}

function buildPayload(person, deptMap, managerMap, systemRole) {
  return {
    firstName: person.firstName,
    lastName: person.lastName,
    email: person.email,
    phone: '+91 98765 43210',
    dateOfBirth: '1990-01-15',
    hireDate: '2026-01-01',
    employmentType: 'full_time',
    designation: person.designation,
    departmentId: deptMap[person.deptCode],
    managerId: person.managerEmail ? managerMap[person.managerEmail] || null : null,
    provideErpAccess: true,
    systemRole,
  };
}

async function main() {
  console.log('[1/4] Fetching token + deleting employees via API...');
  const token = await getToken();
  const tenantId = psql(`SELECT id FROM erp."Tenant" WHERE slug = 'company-a';`);
  const deptRows = psql(
    `SELECT code || '|' || id FROM erp."Department" WHERE "tenantId" = '${tenantId}' ORDER BY code;`,
  );
  const deptMap = Object.fromEntries(
    deptRows
      .split('\n')
      .filter(Boolean)
      .map((row) => row.split('|')),
  );

  const existing = await api(token, '/employees?scope=all');
  if (existing.length > 0) {
    for (const emp of existing) {
      try {
        await api(token, `/employees/${emp.id}`, { method: 'DELETE' });
        console.log(`  API deleted: ${emp.fullName}`);
      } catch (err) {
        console.log(`  API delete skip: ${emp.fullName} (${err.message})`);
      }
    }
  } else {
    console.log('  No employees to delete via API.');
  }

  purgeDb(tenantId);
  purgeKeycloak();

  console.log('\n[4/4] Recreating employees via API (watch API terminal for passwords)...');
  const managerMap = {};
  const created = [];

  for (const person of MANAGERS) {
    const emp = await api(token, '/employees', {
      method: 'POST',
      body: JSON.stringify(buildPayload(person, deptMap, managerMap, 'Manager')),
    });
    managerMap[person.email] = emp.id;
    created.push({ name: emp.fullName, email: emp.email, role: person.designation });
    console.log(`  Created manager: ${emp.fullName}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  for (const person of STAFF) {
    const emp = await api(token, '/employees', {
      method: 'POST',
      body: JSON.stringify(buildPayload(person, deptMap, managerMap, 'Employee')),
    });
    created.push({ name: emp.fullName, email: emp.email, role: person.designation });
    console.log(`  Created staff: ${emp.fullName}`);
    await new Promise((r) => setTimeout(r, 500));
  }

  const summaryPath = '/home/ubuntu/amdox-erp/docs/company-a-employee-logins.md';
  const lines = [
    '# Company A — Employee Logins (recreated)',
    '',
    `> Recreated: ${new Date().toISOString()}`,
    `> **Passwords are in the API terminal** (yellow credential box per user).`,
    '',
    '| Name | Email | Designation |',
    '|------|-------|-------------|',
    ...created.map((e) => `| ${e.name} | ${e.email} | ${e.role} |`),
    '',
    '| Admin | admin@companya.in | Admin123! |',
  ];
  writeFileSync(summaryPath, lines.join('\n'));

  console.log(`\nDone. ${created.length} employees recreated.`);
  console.log(`Summary (emails only): ${summaryPath}`);
  console.log('Check API terminal for PASSWORD for each employee.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
