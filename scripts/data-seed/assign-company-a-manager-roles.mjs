/**
 * Assign Manager ERP role to existing department heads (no password reset).
 *
 * Usage: node scripts/assign-company-a-manager-roles.mjs
 */
const API = process.env.API_URL || 'http://localhost:3001/api/v1';
const REALM = 'company-a';
const ADMIN_EMAIL = 'admin@companya.in';
const ADMIN_PASSWORD = 'Admin123!';

const MANAGER_EMAILS = [
  'priya.sharma@companya.in',
  'vikram.mehta@companya.in',
  'neha.kapoor@companya.in',
  'rohan.das@companya.in',
  'karan.singh@companya.in',
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

async function main() {
  console.log('Assigning Manager ERP role to department heads...');
  const token = await getToken();
  const employees = await api(token, '/employees?scope=all');
  const byEmail = Object.fromEntries(employees.map((e) => [e.email.toLowerCase(), e]));

  for (const email of MANAGER_EMAILS) {
    const emp = byEmail[email.toLowerCase()];
    if (!emp) {
      console.log(`  skip — not found: ${email}`);
      continue;
    }
    if (!emp.userId) {
      console.log(`  skip — no login user: ${email}`);
      continue;
    }
    await api(token, `/employees/${emp.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ systemRole: 'Manager' }),
    });
    console.log(`  Manager role assigned: ${emp.fullName} (${email})`);
  }

  console.log('\nDone. Users must sign out and sign back in for JWT to refresh.');
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
