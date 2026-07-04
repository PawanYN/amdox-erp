/**
 * Amdox ERP — Functional Test HTTP Client
 * Wraps fetch with base URL, auth token, and JSON helpers.
 *
 * Set env vars before running:
 *   API_BASE=http://localhost:3001   (default)
 *   TEST_TOKEN=<JWT from Keycloak>   (optional — tests without token still verify 401/403)
 */

const BASE = process.env.API_BASE || 'http://localhost:3001';
const TOKEN = process.env.TEST_TOKEN || null;

async function request(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { data = await res.json(); } catch { data = null; }
  } else {
    data = await res.text().catch(() => null);
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

export const api = {
  get:    (path)         => request('GET',    path),
  post:   (path, body)   => request('POST',   path, body),
  patch:  (path, body)   => request('PATCH',  path, body),
  put:    (path, body)   => request('PUT',    path, body),
  delete: (path)         => request('DELETE', path),
  BASE,
  TOKEN,
  hasToken: () => !!TOKEN,
};
