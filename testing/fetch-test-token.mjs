/**
 * Obtain a Keycloak access token for functional tests.
 * Does not print the token — only sets process.env.TEST_TOKEN.
 */
const KEYCLOAK_URL = process.env.KEYCLOAK_URL || 'http://localhost:8180';
const REALM = process.env.KEYCLOAK_REALM || 'company-a';
const CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID || 'amdox-erp-web';
const USERNAME = process.env.TEST_USERNAME || process.env.TEST_EMAIL || 'admin@companya.in';
const PASSWORD = process.env.TEST_PASSWORD || 'Admin123!';

const USERNAME_CANDIDATES = [USERNAME].filter((v, i, a) => v && a.indexOf(v) === i);

export async function ensureTestToken() {
  if (process.env.TEST_TOKEN) return true;

  const tokenUrl = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;

  let lastError = 'unknown';

  for (const username of USERNAME_CANDIDATES) {
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: CLIENT_ID,
      username,
      password: PASSWORD,
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      process.env.TEST_TOKEN = data.access_token;
      return true;
    }
    lastError = data.error_description || data.error || `HTTP ${res.status}`;
  }

  console.error(`Failed to obtain test token from Keycloak: ${lastError}`);
  console.error('Hint: run scripts/setup-keycloak.sh or set TEST_TOKEN manually.');
  return false;
}
