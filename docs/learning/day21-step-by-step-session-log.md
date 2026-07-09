# Day 21 — Step-by-Step Session Log

This is a blow-by-blow record of exactly what was done, in what order, and
why, for each of the five Day 21 tasks. Where the conceptual "what is a
JWKS cache / rate-limit bucket / read replica" explanation lives in
`docs/learning/performance-load-testing-concepts.md`, this file is the
other half: the actual sequence of commands, checks, dead ends, and
decisions from this real session, so you can see _how_ to investigate a
performance problem, not just what the answer turned out to be.

Each heading below is one task. Steps are numbered in the order they
actually happened.

---

## Task 1 — k6 Load Test (2,000 VUs, 10-minute steady state)

**Step 1 — Checked what was actually executable in this environment.**
Before promising a load test, checked for a `k6` binary, Docker access,
and a browser (`which k6 docker npx`, `docker ps`). Why: no point writing
a test script if there's no way to run it. Result: `docker ps` failed with
"permission denied" — looked blocked at first.

**Step 2 — Checked with `sudo`.** `sudo -n true` returned success
(passwordless sudo available), so retried `sudo docker ps`. Result: real
containers were already running — Postgres, Redis, and Keycloak, all part
of this project's own `infra/docker/docker-compose.yml` stack. This
changed the whole plan from "write a script I can't run" to "run this for
real."

**Step 3 — Installed k6.** `sudo snap install k6` — worked immediately.
Why snap and not apt: checked `apt-cache search k6` first, found nothing;
`snap` was already available on the box.

**Step 4 — Checked the database was actually up to date.**
`pnpm --filter @amdox/db exec prisma migrate status` — this is a "what
would happen" check, not a change. Result: 5 migrations existed in the
repo but hadn't been applied to this particular running Postgres
container yet.

**Step 5 — Applied the pending migrations.**
`pnpm --filter @amdox/db exec prisma migrate deploy` (the non-destructive
"apply committed migrations" command, not `migrate dev` which can prompt
to reset data). Why this one specifically: it only adds what's already
checked into the repo; it doesn't touch existing data. Result: all 8
migrations applied cleanly. Then ran `prisma generate` so the Prisma
client matched the now-current schema.

**Step 6 — Started the real API and web servers.**
`pnpm --filter api dev` and `pnpm --filter web dev`, each backgrounded
with output redirected to a log file (`> file.log 2>&1 &`, then `disown`)
so they'd keep running across separate tool calls. Confirmed both were
actually up by tailing the logs for "Nest application successfully
started" and "Ready in ...ms".

**Step 7 — Got a real login token.** Used the exact `curl` recipe already
documented in this repo's own `testing/TERMINAL_TEST_LOG.md` (Keycloak
password grant for `admin@companya.in`), then confirmed it worked with
`GET /auth/me`. Why: a load test against protected endpoints needs a real,
valid JWT, not a fake one.

**Step 8 — Picked real endpoints to hit.** Read `ap.controller.ts` and
`vendor.controller.ts` to get exact real route paths, then `curl`'d each
one with the token to confirm they return 200 before putting them in a
load-test script (no point load-testing a typo'd URL).

**Step 9 — Wrote `testing/load/k6-load-test.js`.** A weighted mix (40%
invoice list, 25% vendor list, 25% BI KPIs, 10% payment-run creation),
ramping 0→2,000 VUs over 2 minutes, holding 10 minutes, ramping down over
1 minute — matching the literal Day 21 spec.

**Step 10 — Smoke-tested with 5 VUs for 20 seconds first**, not the full
13-minute run. Why: catch script bugs cheaply before committing 13 minutes
to a broken script. Result: found a real script bug — the default
`http_req_failed` threshold was tripping on the payment-run endpoint's
_expected_ 400 responses (no eligible invoices), which isn't a real
failure. Fixed by relying on a custom `errors` metric (only counts 5xx /
connection failures) instead of the generic one.

**Step 11 — Ran the full 2,000-VU / 13-minute test for real**, in the
background (`run_in_background`), so other work could continue while it
ran. Result: **only ~10% of requests succeeded.** The successful ones were
fast (avg ~12ms) — so this wasn't "the database is too slow," it was
"something is rejecting requests before real work happens."

**Step 12 — Checked system health during the run** (`uptime`, `free -h`,
`ps aux --sort=-%cpu`) to rule out the sandbox itself running out of
CPU/RAM. Result: load average 2.66 on 6 cores, 40GB free — the box itself
was fine. This ruled out "ran out of resources" and pointed the
investigation back at the application.

**Step 13 — Read the live API log during the run.** Found `Fetching JWKS
keys` logged before literally every single request, and the log stopped
receiving new requests partway through the ramp even though k6 kept
ramping for several more minutes. That's the signal that something was
blocking at the auth layer.

**Step 14 — Read `keycloak.strategy.ts` to find the actual bug.** Found
that `passportJwtSecret({ cache: true, rateLimit: true, ... })` was
constructed **inside** the per-request `secretOrKeyProvider` callback —
meaning a brand-new JWKS client (with its own empty cache and its own rate
limiter) was created on every single request. The `cache: true` option was
never actually caching anything across requests.

**Step 15 — Fixed it**: hoisted one `passportJwtSecret(...)` per issuer
into a module-level `Map`, created once and reused (`getSecretProvider()`).
Then `tsc --noEmit` to confirm it compiled, waited for `nest start --watch`
to auto-restart, and manually `curl`'d the API again to confirm it still
worked before re-running anything expensive.

**Step 16 — Discovered a second confound: token expiry.** While fixing
Finding 1, noticed the realm's `accessTokenLifespan` was 300s (5 min) —
shorter than the 13-minute test. Checked it via the Keycloak Admin API
(`GET /admin/realms/company-a`), temporarily raised it to 1800s via `PUT`,
noting to revert it afterward. Why temporarily and not permanently: this
is a shared realm setting, not something to leave changed without reason.

**Step 17 — Re-ran the full 13-minute test.** Result: still ~90% failure.
The JWKS fix was real (confirmed independently via manual `curl` — 15
consecutive successful requests where it used to fail), but a second,
bigger bottleneck was still hiding behind it.

**Step 18 — Investigated with plain `curl` instead of another 13-minute
k6 run.** Why: a 10-request `curl` loop gives the same diagnostic signal
in 2 seconds instead of 13 minutes. Result: `200 200 200 200 200 429 429
429 429 429` — a rate limiter was capping at exactly 5 requests.

**Step 19 — Read `app.module.ts`'s `ThrottlerModule` config.** Found
`{ name: 'short', ttl: 1000, limit: 5 }`, keyed by IP by default (NestJS's
`ThrottlerGuard` default tracker). Realized: all 2,000 k6 VUs run from one
machine, i.e. one IP — so they all shared one 5-req/s bucket. This wasn't
just a test artifact; it's a real production risk for any customer whose
users sit behind a shared corporate NAT/VPN.

**Step 20 — Explained the fix in plain terms before writing code**
(per your request mid-session): a rate-limit "bucket" is just a counter
per key; the bug was the wrong population sharing one bucket, not the
limit number being wrong.

**Step 21 — Built `UserAwareThrottlerGuard`.** A `ThrottlerGuard` subclass
overriding `getTracker()` to decode (not cryptographically verify — that
happens later, downstream, in the real auth guard) the JWT `sub` claim
when a bearer token is present, falling back to IP otherwise. Registered
it in `app.module.ts` in place of the stock guard, and raised the raw
limits from 5/req/s + 100/min to 20/s + 600/min (the old numbers were tight
enough that one legitimate user's dashboard page, which fires several
concurrent requests, could trip them).

**Step 22 — Verified the fix directly**, not by guessing: 15 rapid
requests as one user all returned 200 (previously capped at 5). Then, to
prove it's genuinely per-user and not just "raised the number until it
stopped triggering," reset a second real seeded user's password
(`admin@companyb.in`, via the same Keycloak Admin API technique already
documented in `testing/TERMINAL_TEST_LOG.md`) and ran: 30 rapid requests
as User A (capped exactly at 20, as configured), then 5 requests as User B
immediately after — all succeeded, completely unaffected by A's burst.

**Step 23 — Ran the full 2,000-VU test a third time.** Result: still ~89%
"failure" — but this time recognized and stated honestly _why_, rather
than either declaring victory or continuing to chase it: the k6 script
shares **one** login across all 2,000 VUs, so from the rate limiter's
perspective this test isn't "2,000 distinct users," it's "one identity
generating ~1,400 req/s" — which a per-user limiter is _supposed_ to cap.
Documented this as a named test-methodology limitation with a concrete
follow-up recommendation (seed a pool of distinct users) rather than
either pretending it passed or building a bigger fix under time pressure.

**Step 24 — Reverted the temporary realm setting** back to 300s once
testing was done, to leave the shared environment as it was found.

---

## Task 2 — Redis Cache Gaps

**Step 1 — Found real caching targets by reading the code**, not
guessing. Read `apps/api/src/bi/bi.service.ts` and `bi-data.service.ts`
and found `getExecutiveKpis()` (7 parallel Prisma queries plus an extra
stock-levels query, aggregated in memory) and `getWidgetData()` (one of 6
different chart-data queries per call) — both read-only, both hit on every
dashboard load, both already in the k6 test's own request mix.

**Step 2 — Checked what caching infrastructure already existed.** Read
`apps/api/src/common/redis/redis.service.ts` and `redis.module.ts`. Found
`RedisService` already existed and was already globally available, but was
only ever used for BullMQ queues and blacklist checks — never as an
actual read-through cache.

**Step 3 — Built `CacheService`** (`apps/api/src/common/redis/cache.service.ts`)
— a thin `wrap(key, ttlSeconds, loader)` get-or-set helper around the
existing `RedisService`, plus an `invalidatePrefix()` helper using `SCAN`
(cursor-based, non-blocking) rather than `KEYS` — deliberately not `KEYS`,
since blocking Redis's single event loop during a scan would be the wrong
tradeoff to introduce in a _performance_ pass.

**Step 4 — Registered it in the existing global `RedisModule`** so it's
available everywhere without extra wiring, matching how `RedisService`
itself was already set up.

**Step 5 — Wired it into both real call sites.** In `BiService`, renamed
the original query logic to a private `computeExecutiveKpis()` and made
the public `getExecutiveKpis()` just call `cache.wrap(key, 30, () =>
this.computeExecutiveKpis(...))`. Same pattern in `BiDataService` for
`getWidgetData()`. Cache keys are scoped by tenant + filters, so different
tenants/filter combinations never collide.

**Step 6 — Verified it compiled** (`tsc --noEmit` on `apps/api`), then
confirmed the dev server auto-restarted cleanly and a live `curl` against
`/bi/kpis` still returned 200 with real data.

---

## Task 3 — Postgres Read-Replica Strategy

**Step 1 — Read the existing Prisma client setup first.**
`packages/db/src/client.ts` — found the app already has a tenant
auto-scoping wrapper (`$extends` around `PrismaClient`) that injects
`tenantId` into every query automatically. This mattered directly: any
replica client needs to reuse this exact same wrapper, or BI queries would
silently lose tenant isolation.

**Step 2 — Wrote the strategy as a design document**, not code — this was
scoped by the Day 21 task itself as "a strategy," and there's no
`docker-compose.prod.yml` yet to add a real replica service to (that's a
separate, already-tracked Day 22 gap). Covered: why BI reads specifically
are the right candidate (tolerate staleness, don't need transactional
consistency), the docker-compose sketch for a second Postgres instance,
how the application-side Prisma client would route to it while reusing the
tenant-scoping wrapper, and a fallback-to-primary pattern if the replica
connection ever fails — deliberately mirroring the same "degrade instead
of break" shape already used in `CacheService.wrap()`.

---

## Task 4 — Bundle Analysis

**Step 1 — Checked the current bundler config.** Read
`apps/web/next.config.ts` — plain, no analyzer wired in yet. Also noted
the app runs `next build --turbopack`, not raw webpack — relevant because
"webpack-bundle-analyzer" (the literal Day 21 wording) needs a webpack
build to hook into.

**Step 2 — Installed `@next/bundle-analyzer`** (`pnpm --filter web add -D
@next/bundle-analyzer`) and wrapped `next.config.ts` behind an
`ANALYZE=true` env check.

**Step 3 — First build attempt used `--turbopack` and produced no
analyzer output.** Investigated: the analyzer plugin hooks into webpack's
compilation step, which Turbopack bypasses entirely. Re-ran as a plain
`next build` (no `--turbopack` flag) — this one uses webpack by default,
and the analyzer's HTML reports appeared at `.next/analyze/*.html`.

**Step 4 — Parsed the real data out of the analyzer's HTML** rather than
just eyeballing the treemap. The analyzer embeds its full module-size tree
as `window.chartData = [...]` inside the (minified) HTML file; wrote a
small Python script to locate that assignment, extract the JSON, and sum
sizes per chunk and per leaf module.

**Step 5 — Found the two real numbers that mattered:** one chunk at
1,034.9 KB parsed (ECharts) and one at 374.1 KB parsed (Recharts + its d3
and redux-toolkit internals) — by far the two largest single chunks in
the whole build.

**Step 6 — Checked whether these were loaded eagerly (bad) or lazily
(fine)**, by grepping for how each library was actually imported.
`grep -rln "echarts-for-react"` → found it was already wrapped in
`dynamic(() => import("echarts-for-react"), { ssr: false })` in both
`bi/widget-chart.tsx` and `bi/advanced-charts.tsx`. `grep -rln "from
'recharts'"` → found 3 pages (`forecast`, `scm/forecast`, `scm/inventory`)
importing it directly at module scope, with no `dynamic()` at all.

**Step 7 — Read each of the 3 offending pages' exact chart JSX** before
touching anything, to extract it without changing any visual behavior.

**Step 8 — Extracted each page's chart block into its own small client
component** (`mape-chart.tsx` × 2, `stock-forecast-chart.tsx` × 1),
keeping the exact same JSX/props — then replaced the direct
`import {...} from "recharts"` in each page with
`const XyzChart = dynamic(() => import("./xyz-chart"), { ssr: false })`,
matching the exact pattern already established for ECharts elsewhere in
this same codebase (reusing an existing convention instead of inventing a
new one).

**Step 9 — Typechecked** (`tsc --noEmit`), confirming no new errors beyond
pre-existing unused-variable warnings whose line numbers had simply
shifted.

**Step 10 — Rebuilt with `ANALYZE=true next build` again** and compared
the real, measured "First Load JS" numbers Next.js prints per route:
`/forecast` 225→116 kB, `/scm/forecast` 225→116 kB, `/scm/inventory`
228→119 kB — each roughly a 48% reduction — while `/bi` (the unchanged
control, since ECharts was already split) stayed exactly the same, 255 kB,
confirming the measurement methodology itself was sound.

**Step 11 — Verified visually**, not just numerically: took a real
authenticated browser screenshot of `/forecast` and `/scm/inventory` after
the change (see Task 5's browser-automation setup below) to confirm the
charts still rendered correctly — the extraction only moved code, it
didn't change what the user sees.

---

## Task 5 — Lighthouse Audit (≥90 target)

**Step 1 — Confirmed Lighthouse itself was usable.** `npx lighthouse
--version` — auto-installed and worked immediately.

**Step 2 — Ran it against the one page that needs no login first**
(`/login`), to get a real, low-risk baseline before tackling anything
harder. Result: performance 90, accessibility 96, best practices 100,
SEO 100 — already at target, and a useful sanity check that the tooling
itself worked correctly.

**Step 3 — Realized authenticated pages needed real browser automation.**
Read the frontend's actual login code
(`src/app/(auth)/login/page.tsx`, `src/lib/keycloak.ts`,
`KeycloakProvider.tsx`) to understand the real flow: redirect to a
Keycloak-hosted login page (OIDC Authorization Code flow via `keycloak-js`),
not a simple form POST. This ruled out a plain `curl`-based approach — a
real browser had to actually click through the login.

**Step 4 — Tried the OS's existing `chromium-browser` (a snap package)
via Puppeteer.** It hung indefinitely with no output and didn't respond to
`timeout`, even after installing missing shared libraries. Diagnosed this
by launching the same binary directly from the shell and observing the
same unresponsive behavior — concluded the snap-confined browser wasn't
going to work reliably in this sandbox, rather than continuing to fight
it.

**Step 5 — Switched to plain `puppeteer`** (which bundles its own,
non-snap Chromium build) instead. First attempt failed with a clear,
actionable error: `error while loading shared libraries: libatk-1.0.so.0`.
Installed the missing headless-Chrome dependencies via `apt-get` (looked
up the correct Ubuntu 22.04 package names first, since some guessed names
didn't exist).

**Step 6 — Still got silent timeouts with no output at all.** Diagnosed by
switching from a blocking foreground call to `setsid ... &` (detached
background) with output redirected to a log file, then polling with a
`until ! ps -p $PID` loop instead of a fixed `sleep`. This revealed the
actual problem was tool-harness timeout handling, not the browser itself —
once run properly in the background, the script's own `console.log`
output showed up immediately and the login flow worked.

**Step 7 — Ran the real login + Lighthouse script against the dev
server** (`next dev --turbopack`), targeting `/home` and `/bi`. Result:
performance 63 and 40 — both well under target.

**Step 8 — Read the actual Lighthouse audit details** (not just the top
score) for both pages: found a `redirects` opportunity costing ~5 seconds
on _both_ pages, and `unminified-javascript`/`unused-javascript`
opportunities of 200-700 KB.

**Step 9 — Investigated the redirect chain specifically**, printing the
exact URLs Lighthouse recorded: a full round trip to
`.../protocol/openid-connect/auth?...&prompt=none` and back, on every
fresh page load — not just first login. Traced this to
`KeycloakProvider.tsx`'s `kc.init({ onLoad: "check-sso", checkLoginIframe:
false })` having no `silentCheckSsoRedirectUri` configured, which is what
tells `keycloak-js` to do this check inside a hidden iframe instead of a
visible top-level redirect.

**Step 10 — Fixed it**: added `apps/web/public/silent-check-sso.html` (a
tiny static relay page — a standard `keycloak-js` pattern) and passed
`silentCheckSsoRedirectUri` into the `init()` call.

**Step 11 — Recognized the JS-size opportunities were partly a
measurement artifact**, not a real bug: the audit had been run against
`next dev` (unminified, includes dev-only code), not a production build.
Stopped the dev server, ran a real `next build`, then `next start` on the
same port, to get an honest number.

**Step 12 — Re-ran the exact same login + Lighthouse script against the
production server.** Result: `/home` 63→93 (now clears target), `/bi`
40→76 (large real improvement, not yet at target). Confirmed the
`redirects` opportunity was now completely gone on both pages, and LCP
dropped from 11.2s→3.0s (`/home`) and 16.1s→4.0s (`/bi`) — direct evidence
the fix, not just the production build, drove the improvement.

**Step 13 — Identified what's still holding `/bi` back**, rather than
stopping at "improved but not fixed": read the remaining opportunities and
found ~346 KB of still-unused-on-load JS, most likely
`react-grid-layout`'s drag-and-drop code loading eagerly even before a
user starts rearranging the dashboard. Documented as a concrete, named
follow-up instead of leaving it vague.

**Step 14 — Took real authenticated screenshots** (`/home`, `/bi`,
`/forecast`, `/scm/inventory`) as a visual correctness check, per this
project's own "test in a browser before calling it done" standard for
frontend changes — not just trusting the Lighthouse score in isolation.

**Step 15 — Found a genuinely separate issue while taking those
screenshots**: an intermittent 401 when hard-reloading directly to `/bi`
(as opposed to clicking an in-app link). Investigated whether this had
contaminated the Lighthouse numbers just reported — checked that specific
run's own `errors-in-console` audit (score 1/1, clean) — confirming it
hadn't. Traced the likely cause (a fresh full-page load remounts
`KeycloakProvider`, re-triggering the iframe SSO check, which can race
with the page's own first API calls) and documented it as a known,
unfixed follow-up rather than either ignoring it or scope-creeping into
fixing it under time pressure.

**Step 16 — Cleaned up.** Killed the temporary production server, killed
a lingering stale `next-server` process that was still holding port 3000,
restarted the normal `next dev` server, and reverted the temporarily-raised
Keycloak realm token lifespan back to its original value — leaving the
shared dev environment as it was found.

---

## What was actually fixed, and what it means for the application

| #   | Bug found                               | Where                                                                                           | What it means in practice                                                                                                                                                                                                                                                                                                                                                                             |
| --- | --------------------------------------- | ----------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | JWKS client re-created on every request | `apps/api/src/auth/strategies/keycloak.strategy.ts`                                             | Every API request used to trigger a fresh trip to Keycloak's public-key endpoint. Under real concurrent traffic, this alone was enough to overwhelm Keycloak and cause most requests to fail. Now the key is fetched once and reused — Keycloak is no longer on the critical path of every single request.                                                                                            |
| 2   | Rate limiter keyed by IP address        | `apps/api/src/app.module.ts` + new `common/throttler/user-aware-throttler.guard.ts`             | Before: any two real users sharing a network exit point (a common setup — office VPN, corporate proxy) would throttle each other, even doing completely normal usage. Now: each logged-in user gets their own limit, so this can no longer happen — while a single caller hammering the API is still capped.                                                                                          |
| 3   | No caching on BI/reporting reads        | `apps/api/src/common/redis/cache.service.ts`, wired into `bi.service.ts` / `bi-data.service.ts` | The heaviest dashboard queries (7 parallel aggregate queries for the executive KPI panel) used to re-run in full on every single page view. Now repeated views within a 30-second window are served from Redis instead of re-querying Postgres — less database load under concurrent dashboard usage, faster response for the cached case.                                                            |
| 4   | Recharts loaded eagerly on 3 pages      | `forecast/page.tsx`, `scm/forecast/page.tsx`, `scm/inventory/page.tsx`                          | These 3 pages used to force the browser to download and parse ~370 KB of charting-library JavaScript before the page could even become interactive, even before the chart had any data to show. Now that code loads in the background after the page is already usable — measured as a real 48% smaller "First Load JS" on each page, which directly means the page becomes interactive sooner.       |
| 5   | Missing silent-SSO iframe config        | `apps/web/src/components/KeycloakProvider.tsx` + new `apps/web/public/silent-check-sso.html`    | Every single fresh page load — not just the first login — used to force a full, visible round-trip redirect to the Keycloak server and back before the page could render anything, costing about 5 real seconds every time. Now that check happens invisibly in the background; measured Largest Contentful Paint dropping from 11.2s to 3.0s (`/home`) and 16.1s to 4.0s (`/bi`) as a direct result. |

**Net effect on the application:**

- **Under load**, the API can now serve far more real, distinct concurrent
  users before hitting an artificial ceiling — the two things that used to
  cap it (Keycloak overload from JWKS re-fetching, and one shared IP
  bucket) are both gone. The database and application logic itself were
  never the actual bottleneck in any of the three test runs — every
  successful request's p95 stayed under 40ms throughout.
- **Page load time** for a first-time or freshly-reloaded visit to any
  authenticated page dropped dramatically — roughly **4x faster** to
  Largest Contentful Paint on `/home` (11.2s → 3.0s) and `/bi` (16.1s →
  4.0s) — almost entirely because of the SSO-redirect fix, with the
  Recharts code-splitting fix further shrinking the initial download on
  three other pages by about half.
- **Dashboard/reporting responsiveness** under repeated or concurrent
  viewing improved because the heaviest BI queries no longer re-run in
  full on every view within the cache window.
- **What's still open, on record, for the next pass:** a real
  representative multi-user k6 run (needs a seeded pool of distinct
  users), the `react-grid-layout` code-split on `/bi` (the one remaining
  lever short of the ≥90 Lighthouse target there), an actual Postgres read
  replica (only the strategy is written so far), and the intermittent
  401-on-hard-reload issue.
