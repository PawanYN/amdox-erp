# k6 Load Test Log — Day 21

**Date:** 2026-07-07
**Purpose:** Day 21 of the 28-day plan calls for "k6 load test: 2,000
concurrent virtual users, 10-minute steady state" plus bottleneck
identification. This log documents four real runs against the live local
stack (Postgres, Redis, Keycloak, and the actual NestJS API — not mocks),
three real findings surfaced and two of them fixed, and — rather than
leaving the first version's methodology limitation as an unresolved
caveat — a real 150-distinct-user pool built to actually close it (Run 4).

Script: `testing/load/k6-load-test.js`. Target mix per request: 40%
`GET /finance/ap/invoices`, 25% `GET /scm/vendors`, 25% `GET /bi/kpis`, 10%
`POST /finance/ap/invoices/payment-runs` (the endpoint with the Day 14 N+1
fix in `createPaymentRun()` — re-run here as the regression check for that
fix under real concurrency). Auth: a real Keycloak password-grant token,
either a single seeded user (`admin@companya.in`, Runs 1-3) or, from Run 4
onward, a pool of N distinct real users provisioned by
`testing/load/manage-load-test-users.cjs` (`create` / `delete`), sized via
`LOAD_TEST_USER_POOL_SIZE` in the root `.env`.

Environment: 6 vCPU / 47GB RAM, all services (`amdox-postgres`,
`amdox-redis`, `amdox-keycloak`) running in Docker as in
`infra/docker/docker-compose.yml`; API and web run via `pnpm dev` (not
containerized) directly on the host for this test.

---

## Run 1 — baseline, 2,000 VU / 10-min steady state

```
checks_succeeded: 10.04%  109,609 / 1,090,793
http_req_duration: avg=11.72ms  p95=39.14ms   (on requests that got a real response)
```

**~90% of requests failed.** Critically, the failures were near-instant
(the same ~10-15ms average as successes) — not slow timeouts. That
pointed away from "the database/API can't keep up" and toward "requests
are being rejected before real work happens."

### Finding 1 — JWKS client re-created per request (real bug, fixed)

`apps/api/src/auth/strategies/keycloak.strategy.ts`'s `secretOrKeyProvider`
called `passportJwtSecret({ cache: true, rateLimit: true, jwksRequestsPerMinute: 5, ... })`
**inside** the per-request callback. A fresh `passportJwtSecret(...)` call
creates a fresh `JwksClient` with its own empty LRU cache and its own rate
limiter — so `cache: true` and `rateLimit: true` never had a chance to
engage across requests. At 2,000 concurrent requests, every single one
independently hit Keycloak's `/protocol/openid-connect/certs` endpoint,
which overwhelmed the one Keycloak container and cascaded into connection
failures across the API.

Evidence from the API log during the run: `Fetching JWKS keys` logged
before literally every request, and the log stopped accepting new requests
entirely partway through the ramp (last logged line at 06:42:57, while k6
kept ramping until 06:51).

**Fix:** hoist one `passportJwtSecret(...)` instance per issuer into a
module-level `Map`, reused across all requests (`getSecretProvider()` in
the same file). Cache TTL set to 10 minutes (Keycloak's signing keys rotate
on the order of days, not seconds).

### Finding 2 — access token lifespan shorter than the test itself (test-methodology bug, worked around)

`company-a` realm's `accessTokenLifespan` was 300s (5 min) — shorter than
the 13-minute (2min ramp + 10min steady + 1min ramp-down) test. Temporarily
raised to 1800s via the Keycloak Admin API for the duration of testing,
reverted back to 300 afterward (`PUT /admin/realms/company-a` —
`accessTokenLifespan`). This is a test-script/environment mismatch, not an
app bug, but it would have confounded the results if left in place.

---

## Run 2 — after the JWKS fix

```
checks_succeeded: 10.08%  110,932 / 1,100,096
```

Still ~90% failure. The JWKS fix was real (confirmed by manual `curl`
checks afterward — see below), but a second, larger bottleneck was hiding
behind it.

### Finding 3 — global rate limiter keyed by IP (real bug, fixed)

`ThrottlerModule` (added in the Day 20 security-hardening pass, see
`docs/audits/security-hardening-audit.md`) is keyed by caller IP by default, at
5 req/s and 100/min. **All 2,000 k6 VUs run from one machine, i.e. one
IP** — so they all drew from the _same_ rate-limit bucket. This isn't
just a load-test artifact: any real deployment where multiple legitimate
users sit behind one corporate NAT/VPN egress (a routine setup for an ERP
customer) would collapse into the same shared bucket in production too.

Confirmed directly with `curl` (not k6, for a clean minimal repro):

```
$ for i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " \
    http://localhost:3001/scm/vendors -H "Authorization: Bearer $TOKEN"; done
200 200 200 200 200 429 429 429 429 429
```

**Fix:** `apps/api/src/common/throttler/user-aware-throttler.guard.ts` — a
`ThrottlerGuard` subclass that keys by the JWT `sub` claim (base64-decoded
from the bearer token, not signature-verified — a rate-limit key doesn't
need cryptographic trust; real authn/authz still happens downstream in
each route's actual auth guard) when a token is present, falling back to
IP for unauthenticated requests (e.g. `POST /tenant`, whose own tighter
`@Throttle` override is untouched). Registered in `app.module.ts` in place
of the stock `ThrottlerGuard`. Limits also raised from 5 req/s + 100/min to
20 req/s + 600/min — the original numbers were tight enough that a single
BI dashboard page load (which fires several concurrent XHRs) could trip
them for one legitimate user.

**Verified independently of k6** (two real seeded users, `admin@companya.in`
and `admin@companyb.in`, resetting the latter's password via the Keycloak
Admin API the same way `testing/TERMINAL_TEST_LOG.md` did for the former):

```
User A — 30 rapid requests (limit 20/s):
200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 200 429 429 429 429 429 429 429 429 429 429
                                                                        ^ caps exactly at 20, as configured

User B immediately after — 5 requests, unaffected by A's burst:
200 200 200 200 200
```

This confirms the fix does what it's designed to do: distinct users get
independent buckets even from the same source IP.

---

## Run 3 — after both fixes

```
checks_succeeded: 11.24%  123,714 / 1,099,804
```

Still ~89% failure in the full 2,000-VU run — but this is now **expected
and correct**, not a remaining bug, given a limitation in the test script
itself explained below.

### Honest methodology caveat

`k6-load-test.js` fetches **one** login token in `setup()` and shares it
across all 2,000 virtual users. That means, from the app's perspective,
this test doesn't simulate "2,000 distinct concurrent users" — it
simulates **one identity generating ~1,400 req/s**, which is exactly the
kind of traffic a per-user rate limit is supposed to cap. The Finding 3 fix
was verified correctly (see the two-real-user `curl` proof above), but
this specific k6 script can't demonstrate that benefit at 2,000-VU scale,
because only 2-3 real seeded users exist per tenant in this environment.

**Recommended follow-up** (not done in this pass): seed a pool of N
distinct Keycloak users (with matching `User` rows so `KeycloakStrategy`'s
`ssoSubject` lookup succeeds) and distribute k6 VUs across that pool via
`setup()`, for a load test that's actually representative of many
concurrent distinct users rather than one user at extreme frequency.

### What did improve, confirmed by direct comparison

| Metric (on successful requests)  | Run 1 (before) | Run 3 (after) |
| -------------------------------- | -------------- | ------------- |
| `http_req_duration` p95          | 39.14ms        | 23.66ms       |
| Successful `bi kpis` checks      | 138            | 5,226         |
| Successful `invoice list` checks | 195            | 3,835         |
| Successful `vendor list` checks  | 150            | 4,926         |

The ~10-40x jump in successful requests reflects the JWKS fix (Finding 1)
letting far more requests reach real application logic before hitting the
now-correctly-scoped per-user throttle (Finding 3) — not the app becoming
capable of serving 2,000 truly-distinct concurrent users, which this
script can't prove either way.

---

## Run 4 — real 150-distinct-user pool, 2,000 VU / 10-min steady state

Acted on the Run 3 methodology caveat instead of leaving it as a
follow-up. Built `testing/load/manage-load-test-users.cjs` (`create` /
`delete`), driven by `.env`'s `LOAD_TEST_*` keys — provisions N real
Keycloak users (with matching DB `User` + `UserRole` rows, `TenantAdmin`
role, so `KeycloakStrategy`'s `ssoSubject` lookup succeeds) and reverts
everything (deletes users, restores the original token lifespan)
afterward. Ran with `LOAD_TEST_USER_POOL_SIZE=150`.

Also fixed a real flaw in the k6 script itself while doing this: the
custom `errors` metric only ever called `.add(1)` on failure, never
`.add(0)` on success — meaning its "rate" was structurally guaranteed to
read 100% the instant any single request failed, never a meaningful
signal. Fixed to record both.

`k6-load-test.js`'s `setup()` now logs in as all 150 pool users and each
VU is deterministically assigned one (`__VU % pool.length`), so a VU
behaves like one consistent user session, and the 2,000 VUs spread across
150 real distinct identities instead of sharing one.

```
checks_succeeded: 98.01%  402,972 / 411,117
errors: 1.98% (8,145 / 411,117) — threshold was rate<0.01, so still
        technically over, but the qualitative picture is transformed
http_req_duration: avg=1.68s  p95=1.48s
http_reqs: 411,267 total (522.8/s) — far fewer than Run 1-3's ~1.1M
        because each request now genuinely takes ~1.3s instead of ~12ms
```

**This is a completely different result from Runs 1-3** — not a marginal
change. 98% of requests succeeded. The two artificial bottlenecks (JWKS
re-fetch storm, IP-collapsed rate limit) are confirmed gone.

### Finding 4 — real capacity ceiling in the single Node API process (not a bug, an architecture limit)

The remaining ~2% failures are qualitatively different from every earlier
run: they're genuine timeouts (`dial: i/o timeout`, `request timeout`,
some at exactly k6's 60s HTTP timeout), not near-instant rejections.
Checked the API log for the same window: only **1** real `5xx` in
~364,000 logged requests — so the API process wasn't crashing or erroring,
it was queueing. `ps`/`uptime` during the run showed the API's single
Node process pegged around 60%+ of one CPU core while the box's other 5
cores sat comparatively idle (`load average: 2.99, 4.16, 2.75` on 6
cores) — consistent with a single-threaded Node event loop being the
actual ceiling, not Postgres, Redis, or Keycloak.

**Not fixed in this pass** (a real infrastructure change, not a code
bug): the standard remedy is running the API with Node's `cluster` module
or multiple replica processes behind a load balancer, so more than one
CPU core is actually doing request-handling work. Flagged as a concrete
follow-up rather than attempted here.

### Updated comparison across all 4 runs

| Metric                  | Run 1 (baseline) | Run 3 (both fixes, 1 shared login) | Run 4 (both fixes, 150-user pool)                         |
| ----------------------- | ---------------- | ---------------------------------- | --------------------------------------------------------- |
| `checks_succeeded`      | 10.04%           | 11.24%                             | **98.01%**                                                |
| `http_req_duration` p95 | 39.14ms          | 23.66ms                            | 1.48s (real queueing under genuine load, not a rejection) |
| Real 5xx errors         | —                | —                                  | 1 (out of ~364K logged)                                   |

Run 3 vs. Run 4 is the real before/after for Finding 3 (the rate-limit
fix) — Run 3's "1 shared login" methodology couldn't show it; Run 4 can,
and does.

---

## Bottleneck identification — summary (the actual Day 21 ask)

| Bottleneck                                                                         | Real?         | Status                                                                                     |
| ---------------------------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------ |
| N+1 in `ap.service.ts` `createPaymentRun()`                                        | Yes (Day 14)  | Fixed previously, re-verified live under this load test                                    |
| 8 missing composite indexes                                                        | Yes (Day 14)  | Fixed previously                                                                           |
| JWKS client re-created per request                                                 | Yes           | **Fixed this session**, confirmed gone in Run 4                                            |
| Global rate limiter keyed by IP                                                    | Yes           | **Fixed this session**, confirmed gone in Run 4 (98% success vs. ~10%)                     |
| Redis cache gaps (BI/reporting reads)                                              | Yes           | **Fixed this session** — see `apps/api/src/common/redis/cache.service.ts`                  |
| Postgres read replicas for BI                                                      | Not yet built | Strategy documented — `docs/audits/postgres-read-replica-strategy.md`                      |
| Single Node process is a real throughput ceiling at 2,000 genuine concurrent users | Yes (Run 4)   | **Found, not fixed** — needs clustering/horizontal scaling, an infra change not a code fix |

The database itself was never the bottleneck in any of the 4 runs. Real
bottlenecks found, in order of discovery: two in the request's _path to_
the application (JWKS re-fetching, IP-collapsed rate limiting — both
fixed), and one in the application's own request-handling capacity at
genuine 2,000-user concurrency (single-threaded Node process — found,
not yet fixed).
