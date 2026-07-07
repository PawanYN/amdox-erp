// Day 21 load test — 2,000 VU / 10-min steady state against real hot paths.
//
// Auth: by default, logs in as a POOL of distinct users
// (loadtest-user-1@companya.in .. loadtest-user-<POOL_SIZE>@companya.in,
// provisioned by `manage-load-test-users.cjs create`) and spreads the
// 2,000 VUs across that pool, so this test measures the API/DB path under
// *many distinct concurrent users* — not one identity replayed 2,000 times,
// which the per-user rate limiter (UserAwareThrottlerGuard) would correctly
// cap regardless of how fast the API/DB actually are. See
// testing/K6_LOAD_TEST_LOG.md for why this matters.
//
// Run: k6 run testing/load/k6-load-test.js
// Override target/scale via env: k6 run -e BASE_URL=... -e MAX_VUS=200 testing/load/k6-load-test.js
// Fall back to a single shared login (old behavior) with -e USER_POOL_SIZE=1

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const KEYCLOAK_URL = __ENV.KEYCLOAK_URL || 'http://localhost:8180';
const REALM = __ENV.REALM || 'company-a';
const CLIENT_ID = __ENV.CLIENT_ID || 'amdox-erp-web';
const MAX_VUS = Number(__ENV.MAX_VUS || 2000);

// User pool — matches testing/load/manage-load-test-users.cjs and the
// LOAD_TEST_* keys in the root .env. Falls back to the single seeded
// admin user when POOL_SIZE is 1 (e.g. a quick smoke test with no pool
// provisioned).
const USER_POOL_SIZE = Number(__ENV.USER_POOL_SIZE || 150);
const USER_POOL_PREFIX = __ENV.USER_POOL_PREFIX || 'loadtest-user';
const USER_POOL_PASSWORD = __ENV.USER_POOL_PASSWORD || 'LoadTest123!';
const FALLBACK_USERNAME = __ENV.USERNAME || 'admin@companya.in';
const FALLBACK_PASSWORD = __ENV.PASSWORD || 'Admin123!';

export const errorRate = new Rate('errors');
export const invoiceListTrend = new Trend('invoice_list_duration');
export const vendorListTrend = new Trend('vendor_list_duration');
export const biKpisTrend = new Trend('bi_kpis_duration');
export const paymentRunTrend = new Trend('payment_run_duration');

export const options = {
  setupTimeout: '3m', // setup() now logs in up to USER_POOL_SIZE times sequentially
  scenarios: {
    steady_state: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: MAX_VUS }, // ramp-up
        { duration: '10m', target: MAX_VUS }, // steady state — the Day 21 requirement
        { duration: '1m', target: 0 }, // ramp-down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    // http_req_failed counts any non-2xx/3xx as a failure, including the
    // expected 400 from payment-runs with no eligible invoices — so real
    // failure is judged by the custom `errors` metric (5xx / connection
    // failures only), not the generic one.
    http_req_duration: ['p(95)<1500'], // p95 under 1.5s
    errors: ['rate<0.01'],
  },
};

function login(username, password) {
  const res = http.post(
    `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`,
    {
      grant_type: 'password',
      client_id: CLIENT_ID,
      username,
      password,
    },
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  const token = res.json('access_token');
  if (!token) {
    throw new Error(`Keycloak token fetch failed for ${username}: ${res.status} ${res.body}`);
  }
  return token;
}

export function setup() {
  if (USER_POOL_SIZE <= 1) {
    return { tokens: [login(FALLBACK_USERNAME, FALLBACK_PASSWORD)] };
  }
  const tokens = [];
  for (let i = 1; i <= USER_POOL_SIZE; i++) {
    tokens.push(login(`${USER_POOL_PREFIX}-${i}@companya.in`, USER_POOL_PASSWORD));
  }
  return { tokens };
}

export default function (data) {
  // Deterministically assign each VU to one pool user, so a given VU
  // behaves like one consistent user session across its iterations,
  // instead of hopping identities every request.
  const token = data.tokens[(__VU - 1) % data.tokens.length];
  const headers = { Authorization: `Bearer ${token}` };

  // Weighted mix of real hot paths — reads dominate, one write endpoint
  // included since AP payment-run creation is the one with the known-fixed
  // N+1 (ap.service.ts createPaymentRun()); re-running it under load is the
  // regression check for that fix.
  const roll = Math.random();

  // errorRate records a 0 on every success and a 1 on every failure — not
  // just 1-on-failure — so its `rate` is an honest fraction of all
  // requests, not structurally guaranteed to read 100% the moment any
  // single request fails (a real flaw in an earlier version of this
  // script, see testing/K6_LOAD_TEST_LOG.md).
  if (roll < 0.4) {
    const res = http.get(`${BASE_URL}/finance/ap/invoices`, {
      headers,
      tags: { name: 'invoice_list' },
    });
    invoiceListTrend.add(res.timings.duration);
    errorRate.add(res.status === 200 ? 0 : 1);
    check(res, { 'invoice list 200': (r) => r.status === 200 });
  } else if (roll < 0.65) {
    const res = http.get(`${BASE_URL}/scm/vendors`, { headers, tags: { name: 'vendor_list' } });
    vendorListTrend.add(res.timings.duration);
    errorRate.add(res.status === 200 ? 0 : 1);
    check(res, { 'vendor list 200': (r) => r.status === 200 });
  } else if (roll < 0.9) {
    const res = http.get(`${BASE_URL}/bi/kpis`, { headers, tags: { name: 'bi_kpis' } });
    biKpisTrend.add(res.timings.duration);
    errorRate.add(res.status === 200 ? 0 : 1);
    check(res, { 'bi kpis 200': (r) => r.status === 200 });
  } else {
    const res = http.post(`${BASE_URL}/finance/ap/invoices/payment-runs`, JSON.stringify({}), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      tags: { name: 'payment_run' },
    });
    paymentRunTrend.add(res.timings.duration);
    // 400s are acceptable here (empty body / no eligible invoices) — only
    // treat 5xx / connection failure as an error for this smoke path.
    errorRate.add(res.status < 500 ? 0 : 1);
    check(res, { 'payment run not 5xx': (r) => r.status < 500 });
  }

  sleep(Math.random() * 1.5 + 0.5); // 0.5–2s think-time between requests
}
