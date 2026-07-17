# Performance & Load Testing — Full Walkthrough

This explains, from zero, the five Day 21 gaps closed in this session
(`docs/planning/team_assignment.md`), the real bugs they surfaced
(`testing/K6_LOAD_TEST_LOG.md`, `testing/LIGHTHOUSE_AUDIT.md`,
`testing/BUNDLE_ANALYSIS.md`), and a reusable checklist for the next
project. Written for someone who hasn't done any of this before.

---

## Part 1 — The concepts, explained simply

### What is a load test, and why "virtual users"?

A load test throws simulated concurrent traffic at a real running system to
see where it breaks — the opposite of a unit test, which checks one input
at a time. **k6** is a tool that spins up "virtual users" (VUs): lightweight
simulated clients, each independently making requests on a loop, ramping up
to a target concurrency and holding it ("steady state") for a while. If 100
VUs all succeed instantly but 2,000 VUs mostly fail, you've found a
concurrency ceiling — something that only shows up under real simultaneous
load, never in a one-request-at-a-time test.

The trap: a load test only tells you about the **path it exercises**. Ours
ran from one machine (one IP address) with one login (one user identity).
Both of those turned out to matter a lot — see Finding 3 and the
methodology caveat below.

### What is a "rate limit bucket," and why does the _key_ matter more than the number?

A rate limiter counts requests per some **key** within a time window and
rejects once the count crosses a limit — "no more than N requests per
window, per key." The number (N) matters, but the **key** matters more:
it decides who shares a counter with whom.

- Key by **IP address** (the naive default): every request from the same
  network address shares one counter. Fine for one user on their laptop.
  Broken the moment multiple real users sit behind the same corporate
  NAT/VPN egress — they all collapse into one bucket and throttle each
  other, even though none of them individually is doing anything wrong.
- Key by **authenticated identity** (user ID, tenant ID, API key): each
  real caller gets their own counter regardless of network topology. This
  is almost always the right key for anything behind a login.

This project's rate limiter (added in the Day 20 security-hardening pass)
was keyed by IP. It worked exactly as designed for its intended job
("stop one abusive client") — the problem only appears at the specific
scale this load test exercised (many callers sharing one IP), which the
earlier, correct, single-client verification test in
`docs/audits/security-hardening-audit.md` had no reason to catch.

### What is JWKS, and why does _where_ you cache it matter?

A JWT (the login token) is signed by Keycloak with a private key. To verify
it, the API needs Keycloak's matching **public** key — fetched from a
"JWKS" (JSON Web Key Set) endpoint. Fetching that over the network on
every single request would be slow and pointlessly hammer Keycloak, so
libraries like `jwks-rsa` offer built-in caching (`cache: true`).

The catch: that cache lives _inside_ the object the library gives you back
(a `JwksClient` instance). If you create a **new** instance on every
request — easy to do by accident if the setup code lives inside a
per-request callback instead of module/constructor scope — you get a new,
empty cache every time. The cache option is doing nothing; you're back to
fetching on every request, just with extra steps. This is the same shape
of bug as an N+1 query (Day 14): the fix (`cache: true`) looks like it's
there, but it never actually gets a chance to help, because it's scoped to
the wrong lifetime.

### What is a CDN-style/Redis cache, and what does it trade away?

A cache stores a computed result under a key, with a **TTL** (time-to-live)
— serve the cached value for that long, then recompute. It trades
freshness for speed: for the TTL window, a caller might see data that's
slightly stale. This is a fine trade for aggregate/reporting numbers that
naturally update slowly (a BI dashboard's KPI totals) and a bad trade for
anything where staleness would be actively wrong (an account balance right
after a payment).

### What is a Postgres read replica?

Postgres can stream every write (via its write-ahead log) to a second
instance that stays a few milliseconds-to-seconds behind and accepts
read-only queries. Point expensive, read-only reporting queries at the
replica instead of the primary, so they can't compete with real
transactional writes for the same connections/IO. Same freshness-for-speed
trade as a cache, at the infrastructure level instead of the application
level.

### What is Lighthouse, and what's a "render-blocking redirect"?

Lighthouse loads a page in a real (headless) Chrome and scores it on
performance, accessibility, best practices, and SEO, based on real
measured timings (not guesses) — Largest Contentful Paint (when the main
content appears), Total Blocking Time (how long the main thread was too
busy to respond to input), etc.

A subtle but expensive pattern it catches: if loading page A causes a
full-page redirect to page B and back before anything renders, the user
pays for two full navigations, not one — every millisecond of the first
page load is wasted. This project's frontend had exactly this: an
authentication library's "silently check if I'm still logged in" step was
implemented as a real top-level redirect (visible URL bar change) instead
of a hidden background check, costing ~5 seconds on every fresh page load.

### What is code splitting, and why does it matter for a chart library?

By default, a bundler ships one page's entire JavaScript as a single
download before the page can become interactive. **Code splitting** breaks
that into pieces loaded only when actually needed — e.g., a charting
library's ~370 KB doesn't need to block the initial page render if the
chart itself only appears after an API call resolves a few hundred
milliseconds later. In React/Next.js, `next/dynamic(() => import(...), { ssr: false })`
is the standard way to mark a piece of a page as "load this separately,
after the initial page is already interactive."

---

## Part 2 — The real walkthrough, in this project

1. **Wrote `testing/load/k6-load-test.js`** targeting real endpoints
   (`GET /finance/ap/invoices`, `GET /scm/vendors`, `GET /bi/kpis`,
   `POST /finance/ap/invoices/payment-runs`) with a real Keycloak login.
2. **Ran it for real** against the actual local stack — Postgres, Redis,
   Keycloak, and the NestJS API all running live, not mocked — ramping to
   2,000 VUs over 2 minutes, holding for 10, ramping down over 1.
3. **~90% of requests failed**, near-instantly (not slow) — a signal that
   pointed at "requests rejected before real work," not "database too
   slow." Investigated the API's own logs during the run and found every
   single request logging a fresh JWKS fetch (Finding 1 above) — fixed it
   by hoisting the JWKS client to module scope, re-ran, ~90% still failed.
4. **Investigated further with plain `curl`** (a much smaller, easier
   signal than a 2,000-VU run) and found the rate limiter throttling after
   exactly 5 requests, from any one IP — confirmed this was because every
   k6 VU shares one machine's IP. Built `UserAwareThrottlerGuard` to key by
   the caller's JWT subject instead, verified independently with two real
   distinct user logins (not k6) that each gets its own bucket.
5. **Re-ran the full k6 test a third time** and was honest that the
   remaining ~89% "failure" is no longer a bug — it's the (now-correct)
   per-user limiter correctly capping one identity generating far more
   traffic than any real single user would, because the test script itself
   shares one login across all 2,000 VUs. Documented this as a named
   methodology limitation rather than glossing over it.
6. **Added `CacheService`** (`apps/api/src/common/redis/cache.service.ts`)
   — a `wrap()` get-or-set helper over the existing `RedisService`, and
   applied it to the two heaviest BI read paths (`getExecutiveKpis()`,
   `getWidgetData()`), 30s TTL, tenant+filter-scoped keys.
7. **Wrote the read-replica strategy** as a design doc only
   (`docs/audits/postgres-read-replica-strategy.md`) — no replica was stood up,
   per the Day 21 task's actual scope.
8. **Ran a real bundle analysis** (`@next/bundle-analyzer` on a genuine
   `next build`), found ECharts already correctly deferred but Recharts
   loaded eagerly on three pages, fixed all three with the same
   `next/dynamic` pattern already established in the BI module, and
   measured a real 48% First Load JS reduction on each.
9. **Ran a real authenticated Lighthouse audit** — drove an actual
   Keycloak login via Puppeteer (not a mocked session), found the
   5-second top-level SSO redirect (Part 1, above), fixed it with a
   `silentCheckSsoRedirectUri` + a static relay page, and confirmed via a
   second, clean production-build run: `/home` went from performance 63 to
   93 (clears the ≥90 bar), `/bi` from 40 to 76 (a large, real
   improvement, though not yet at 90 — the next lever, `react-grid-layout`,
   is identified and documented, not yet fixed).

## Part 3 — Reusable checklist for the next project

1. **Run a real load test against a real running stack** before trusting
   any performance claim — single-request timing (`EXPLAIN ANALYZE`, a
   manual `curl`) cannot surface concurrency bugs.
2. **When most requests fail near-instantly under load, suspect the
   request's path _to_ your logic** (auth, rate limiting, connection
   pooling) before suspecting your business logic or database.
3. **Any "cache: true" / "rate limit" configuration is only as good as its
   object's lifetime.** If it's constructed inside a per-request function
   instead of a constructor/module scope, it's not actually caching or
   limiting anything across requests.
4. **Rate limiters need to be keyed by identity, not network address**,
   for anything behind authentication — IP-keying silently breaks for
   any shared-egress population (NAT, VPN, corporate proxy).
5. **Test infrastructure changes (like a load test) can be confounded by
   test environment settings** (a token lifespan shorter than the test
   itself) — separate "the app has a bug" from "my test setup has a bug"
   before concluding either.
6. **Measure frontend performance against a real production build**, not
   a dev server — dev servers are unminified and include extra dev-only
   code that inflates every JS-size-related metric.
7. **A full top-level redirect before a page can render is one of the
   most expensive things a page can do** — if an auth library offers a
   silent/iframe-based equivalent, use it.
8. **Before adding code-splitting, check the render-heaviest chunk first**
   (a bundle analyzer's own size report), not by guessing which page "feels
   heavy" — this project's actual biggest chunk (ECharts) turned out to
   already be handled; the real gap was a smaller, easier-to-miss library
   (Recharts) used on three different pages.
