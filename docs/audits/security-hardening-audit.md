# Amdox ERP — Security Hardening Audit (PLAT-04 / Day 20)

**Started:** 2026-07-06
**Trigger:** `team_assignment.md`'s Day 20 section lists 6 broad claims (CSRF ❌, XSS/DOMPurify/CSP ❌, IDOR ⚠️, Helmet ❌, rate limiting ❌, secrets audit ❌, CI/Trivy/Snyk ❌). Rather than accept these at face value, this document verifies each one against the actual code, records what's confirmed vs. overstated vs. understated, and tracks decisions as we work through them together.
**Status:** All 8 items fixed as of 2026-07-07 (decisions taken 2026-07-07, see §10). This is now a record of what was found and what was done about it, not an open task list.

---

## 1. How to read this doc

Each finding gets a verdict:

- **CONFIRMED-CRITICAL** — real, exploitable, matches or exceeds the original claim's severity.
- **CONFIRMED-LOWER-PRIORITY** — real gap, but the original doc's framing overstated the risk given this app's actual architecture.
- **OVERSTATED** — the ❌ in the doc doesn't reflect a real live risk once the surrounding architecture is accounted for.
- **NEW** — something the original Day 20 checklist never mentioned at all, found during this audit.

Every claim below is backed by a file:line citation I actually read — not inferred from the checklist text.

---

## 2. IDOR (Insecure Direct Object Reference — when a user can access someone else's data just by guessing/changing an ID, like `/invoices/123` → `/invoices/124`) / Tenant Isolation — **CONFIRMED-CRITICAL, and bigger than the doc says**

The doc says: _"tenantId auto-scoping in client.ts acts as a de facto guard, no explicit IDOR test suite."_ This undersells the actual state — the "auto-scoping guard" (a safety net that's supposed to automatically restrict every database query to only the current customer's/company's data) barely applies to the codebase at all, and the piece of it that's wired up is itself broken.

### 2.1 The safe, auto-scoping Prisma client is used in only 2 of 40 services

`packages/db/src/client.ts` exports a `prisma` (Prisma is the database toolkit/ORM — Object-Relational Mapper, i.e. the layer that turns JS code into SQL queries) wrapped in `$extends()` (a Prisma feature for injecting custom logic into every query) that auto-injects `tenantId` (the ID of the customer/company a row belongs to) into every query's `where`/`data`, reading the tenant from an `AsyncLocalStorage` context (a Node.js mechanism for stashing a value — here, "which tenant is this request for" — so it's automatically available anywhere deep in the call stack without having to pass it as a parameter everywhere). This is a genuinely good pattern _if it's actually used_.

```
grep -rl "import { prisma } from '@amdox/db'" apps/api/src → 2 files
grep -rl "new PrismaClient()" apps/api/src              → 38 files
```

The 38 files (`ap.service.ts`, `gl.service.ts`, `employee.service.ts`, `payroll.service.ts`, `budget.service.ts`, `bi.service.ts`, ... essentially every domain service) each construct their **own raw, unscoped `PrismaClient()`** (a plain database connection with none of the automatic tenant-filtering safety net) and bypass the auto-injection entirely. For those services, tenant isolation depends 100% on every individual query in every method remembering to manually add `tenantId` to its `where` clause (the filter conditions of a database query). There is no ORM-level backstop (automatic safety check built into the database layer itself) if one is missed.

### 2.2 ~~The one piece of auto-scoping that _is_ wired up is broken~~ — CORRECTED: it was dead code, not wired up at all, and the real mechanism was already safe. **Fixed 2026-07-06.**

**Original finding (kept here for the record, then corrected):** `apps/api/src/common/middleware/tenant-context.middleware.ts:8` read `(req.user as any)?.tenantId || (req.headers['x-tenant-id'] as string)`. Since Nest middleware always runs _before_ `@UseGuards()` guards, `req.user` (populated by Passport inside the login-check guard) would always be `undefined` at that point, so this line would always fall through to the client-supplied, unauthenticated `x-tenant-id` header.

**What I missed on the first pass, and verified when asked to fix it:** this middleware was **never actually registered anywhere** — no `app.use()`, no `.configure(consumer)` call in any module. It was dead code that never ran on a single real request. I'd assumed it was the active mechanism because of its name and the concept it implemented; I hadn't checked whether anything actually wired it in.

**What's actually running:** a _separate_, already-correct file, `apps/api/src/common/interceptors/tenant-context.interceptor.ts`, registered globally via `APP_INTERCEPTOR` in `app.module.ts`. It reads **only** `req.user?.tenantId` — no header fallback — and, being an Interceptor rather than Middleware, it runs _after_ Guards in Nest's pipeline, so `req.user` is genuinely populated by the verified login token by the time it executes. This was correct all along.

**Fix applied:** deleted the dead, unused, buggy `tenant-context.middleware.ts` file entirely. It served no function (nothing called it) and was actively misleading — anyone reading the codebase (including me, the first time) could mistake it for the live mechanism, and a future "helpful" refactor that wired it into `main.ts` would have silently reintroduced a real vulnerability for zero benefit, since a correct replacement already existed. Verified via `tsc --noEmit` (clean) and a live server restart (boots fine, `/health/live` still 200).

**Honest caveat on verification:** I could not construct a live "spoofed header produces different data" test for this specific mechanism, because — per §2.1 — only 2 files use the auto-scoping `prisma` export at all, and neither currently runs a tenant-sensitive query through it (`tenant.service.ts` only queries the `Tenant` model, which is explicitly exempt from auto-scoping; `health.service.ts` only runs a raw `SELECT 1`, which the auto-injection wrapper doesn't apply to since it only intercepts Prisma model operations, not raw SQL). So this fix removes a landmine and corrects a misdiagnosis, but — consistent with the original finding — there wasn't a live exploit to "prove fixed" via a before/after HTTP test today.

### 2.3 The 38 raw-`PrismaClient` services: same-header footgun exists in 19 places, but only in unguarded/edge paths so far

Separately (not the middleware — this is in route handlers, the actual functions that answer each API endpoint), 19 call sites use this pattern:

```ts
const tenantId = req.user?.tenantId || req.headers['x-tenant-id'] || 'default-tenant-id';
```

e.g. `tenant.controller.ts:32,40,50,58,...`. Here `req.user.tenantId` genuinely _is_ populated correctly by the time route handlers run (confirmed in §2.4), because guards run before route handlers. So on any route with `@UseGuards(AuthGuard('keycloak'), RolesGuard)` (i.e. any endpoint that requires login + a role check), the header fallback is dead weight, not a live bypass — `req.user.tenantId` always wins. The risk is narrower: it only matters on the few routes with **no guard** (`tenant.controller.ts:15` `GET exists/:slug`, `:23` `POST /tenant` create-tenant — both intentionally public, low sensitivity) or if `req.user.tenantId` is ever falsy (empty/missing) for an authenticated user, which I did not find a case of.

**Verdict:** the pattern is a smell (client-controlled header sitting in a fallback chain like this is fragile — a future refactor that reorders the `||` or adds an unguarded route reusing this snippet would silently reopen the hole) but not currently proven-exploitable outside of §2.2.

### 2.4 Where `req.user.tenantId` actually comes from — verified reliable post-auth

`apps/api/src/auth/strategies/keycloak.strategy.ts:66-90` — `validate()` (the function Passport calls once it's confirmed a login token's signature is genuine) looks up the `User` row by `ssoSubject` (the unique ID Keycloak — the login/identity server — assigns to this person) and returns the full `user` record (which has its own `tenantId` column) as `req.user`. This runs inside the Passport `AuthGuard`, so by the time a guarded route handler executes, `req.user.tenantId` reflects the authenticated user's real tenant from the database — not anything client-supplied. **This part is solid.**

### 2.5 Spot-checked `findUnique`-by-id-only patterns (the classic Prisma multi-tenancy footgun)

Prisma's `findUnique` (a query that fetches exactly one row, looked up by a field guaranteed to be unique, like its ID) can only filter on a genuinely unique field/combination, which tempts people into `findUnique({ where: { id } })` with no tenant check at all — because you technically can't bolt "and also check it belongs to my company" onto that specific type of query unless the database itself has been told that combination is unique. I grepped for this pattern across the 38 raw-client files and manually verified a sample:

| File:line                                                 | Verdict                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `hr/leave/leave.service.ts:77` (`approveOrReject`)        | **Safe**                                    | Fetches by `id` alone, then explicitly checks `if (!leave \|\| leave.tenantId !== tenantId) throw NotFoundException` before use. Correct mitigation pattern (fetch first, then manually double-check ownership before doing anything with the result).                                                                                                                                                                                                                                                                                                                              |
| `pm/resource/resource.service.ts:24` (`allocateResource`) | **Safe**                                    | Uses `findUnique({ where: { id: dto.employeeId, tenantId } })` — compiles, meaning `Employee` has a compound unique constraint (a database rule saying "the combination of tenantId + id together must be unique," not just id alone) covering `(tenantId, id)`, so the database itself enforces the scoping in one query.                                                                                                                                                                                                                                                          |
| `finance/gl/gl.service.ts:203,375,417,507,550`            | **Lower risk, not verified safe by design** | All are internal `@OnEvent(...)` handlers (functions that react automatically when something else in the app fires an internal "event," like "invoice approved" — not directly reachable by an outside caller) keyed off event payload IDs (`event.invoiceId`, `event.paymentId`, etc.), not directly attacker-supplied HTTP params. Exploitability would require first getting a malicious tenantId into an event payload upstream — a longer chain, not a direct hit. **Not yet checked**: whether any upstream event emitter could be tricked into carrying a foreign-tenant ID. |
| `finance/automation/outbox.processor.ts:31`               | **Not yet checked**                         | `findUnique({ where: { id: outboxEventId } })` — processes background outbox events (a reliability pattern where actions-to-be-done are written to a database table first, then picked up and executed by a background worker, so nothing gets lost if the server crashes mid-request); needs the same check as above.                                                                                                                                                                                                                                                              |
| `notification/notification.service.ts:105`                | **Low risk**                                | `Tenant.findUnique` — `Tenant` model itself, not tenant-scoped by nature (it _is_ the tenant, so "which tenant does this tenant belong to" doesn't apply).                                                                                                                                                                                                                                                                                                                                                                                                                          |

**This sample (5 of ~38 files) came back mostly clean.** I have _not_ yet gone through the remaining ~33 files' full query surface. Given how large that task is, §10 asks how deep you want this to go before we call IDOR "audited."

### 2.6 Full automated audit + fix, 2026-07-07 — **DONE**

Decision taken (§10): automate rather than hand-audit all 38 files. Built `apps/api/scripts/audit-tenant-scoping.ts`, a TypeScript-AST-based static scanner (not regex — walks the real parse tree) that:

- Finds every file constructing `new PrismaClient()`.
- Within those, flags any `findMany`/`findFirst`/`findUnique`/`update`/`updateMany`/`delete`/`deleteMany`/`count`/`upsert`/`create`/`createMany` call whose `where`/`data` looks like it's missing `tenantId` — treating anything unverifiable (a spread, a variable holding the filter object) as "assume safe" to keep false positives low.
- Recognizes Prisma's compound-unique-key syntax (`tenantId_name: {...}`) as safe, and a `// tenant-scope-ok: <reason>` comment as an explicit, grep-able suppression.
- Wired into `package.json` as `pnpm audit:tenant-scoping`, and into `.github/workflows/ci.yml` as a permanent CI gate (§8).

**First run: 77 findings across 26 files.** Triaged every single one by hand:

- **~65 were false positives** once cross-statement context is accounted for — almost always a preceding `findFirst`/`findOne` scoped to `tenantId` that throws `NotFoundException` before the flagged call ever runs, or (2 cases) a legitimate system-wide cron scan across all tenants by design (`bi-report.scheduler.ts`, `pm/milestone-overdue.scheduler.ts`). Each now carries a `// tenant-scope-ok: <reason>` comment so the scanner won't re-flag it and the next reader sees the reasoning inline instead of having to re-derive it.
- **2 were genuine, real, previously-undetected gaps**, both the same shape: a caller-supplied `productId`/`warehouseId` went straight into a `StockLevel` lookup keyed only on `productId_warehouseId` (no `tenantId` in that compound unique constraint) with **no ownership check first**.
  - `scm/purchase/purchase.service.ts` — `receiveGoods()`
  - `scm/inventory/inventory.service.ts` — `recordMovement()`

  Both fixed by verifying the product/warehouse belong to the caller's tenant before proceeding. **Verified live with a real attack attempt**: company-a's token, but a warehouseId belonging to company-b — before the fix this would have written to company-b's stock levels; after the fix it correctly returns `404 Warehouse not found`, and a DB check confirmed zero rows leaked into company-b's `StockLevel` table. A same-tenant control request still succeeds normally (no regression).

- **The rest were tightened for defense-in-depth** even without a proven exploit path today — e.g. notification preference/email lookups threaded with `tenantId` that weren't before, payroll status updates converted from `update()` to `updateMany()` with an explicit `tenantId` filter.

### 2.7 Migrated all 38 services onto the safe `prisma` export, 2026-07-07 — **DONE**

Decision taken (§10): migrate, but additive-only — **every existing explicit `tenantId` filter was kept exactly as-is**, never removed. This matters because background workers (BullMQ processors, `@Cron` schedulers, `@OnEvent` listeners) run _outside_ the HTTP request pipeline, so `TenantContextInterceptor` (§2.2) never sets tenant context for them — the explicit filters are the _only_ real protection on those paths, regardless of which Prisma client the file imports. The migration's actual value is (a) one shared connection pool instead of 38 separate ones, and (b) a real ORM-level backstop for the request paths that _do_ go through the interceptor.

One real type incompatibility surfaced by the migration: the `$extends()`-wrapped client's `$transaction` callback isn't structurally identical to the plain `Prisma.TransactionClient` type. `inventory.service.ts`'s `consumeFifoCostLayers()` took an explicitly-typed `tx: Prisma.TransactionClient` parameter that no longer matched after migration — fixed by deriving the type directly from the wrapped client (`Parameters<Parameters<typeof prisma.$transaction>[0]>[0]`) so it can never drift out of sync again.

The audit script (§2.6) was extended with a second permanent check: it now also fails if `new PrismaClient()` reappears anywhere in `apps/api/src` (the only legitimate construction site is `packages/db/src/client.ts` itself, a different package). Verified the guard actually catches a reintroduction before removing the test file used to prove it.

**Verified live:** server boots cleanly (NestJS DI resolved all 38 changed providers with no errors), `/health/ready` reports every dependency connected, and a smoke test across every affected module (Finance GL/AP/AR, HR employees/departments/leave/payroll, SCM vendors/products/inventory, PM projects, BI dashboards, Forecast, Audit logs, GDPR, Notifications) returns correct responses — plus an explicit write-path test (create/update/delete a department) to confirm mutations still work, not just reads.

---

## 3. CSRF (Cross-Site Request Forgery — tricking a logged-in user's browser into firing an authenticated request to your site without them meaning to, usually by abusing the fact that browsers auto-attach cookies) — **OVERSTATED** given the current architecture

The doc marks this ❌ with no qualification, implying a live gap. In practice:

- Auth is **pure Bearer JWT** via `Authorization` header (`keycloak.strategy.ts:43` — `ExtractJwt.fromAuthHeaderAsBearerToken()`) — meaning every request has to explicitly attach `Authorization: Bearer <token>` in JavaScript code; it's not cookie/session-based (the older, more CSRF-prone pattern where the browser automatically resends a stored cookie on every request, including ones triggered by a malicious third-party page).
- Frontend never sends `credentials: 'include'` (the fetch-API setting that tells the browser "also attach cookies to this cross-site request") on any fetch (`grep` across `apps/web/src` — zero matches), so it isn't relying on cookies for cross-origin (a request from one website to a different website's server) auth either.

Classic CSRF exploits a browser's _automatic_ attachment of cookies to cross-site requests. Since nothing here uses cookies for auth, a malicious site cannot forge an authenticated request — it has no way to make the victim's browser attach their Bearer token (the token lives in the Keycloak JS adapter's in-memory state, not anywhere a cross-site page can read or trigger). **A dedicated CSRF token/middleware would be solving a problem this architecture doesn't currently have.**

**Caveat that keeps this from being a clean "not needed":** `main.ts:24` — `app.enableCors()` (CORS = Cross-Origin Resource Sharing, the browser rule that normally blocks website A's JavaScript from calling website B's API unless B explicitly allows it) is called with **no options at all**. Nest/Express's `cors` package default is `origin: true` (reflect and allow _any_ calling website) with `credentials` (whether cookies are allowed to ride along) defaulting to `false`. Since credentials are off by default and nothing sends them, this isn't currently a working exploit chain — but it does mean any website in the world can call this API cross-origin (subject to the caller having a valid Bearer token some other way).

**Fixed 2026-07-06:** `app.enableCors()` replaced with an explicit allowlist read from `FRONTEND_URL` (comma-separated for multiple environments, defaults to `http://localhost:3000`), `credentials: true`. Verified live: a request with `Origin: https://evil.example.com` gets no `Access-Control-Allow-Origin` header back; a request with the configured origin does.

---

## 4. XSS (Cross-Site Scripting — an attacker sneaking their own `<script>`/HTML into a page so it runs in another user's browser, e.g. via a comment field that isn't escaped before being displayed) / DOMPurify (a library that strips dangerous HTML/scripts out of untrusted content before displaying it) / CSP (Content Security Policy — a browser-enforced header telling it "only run scripts from these trusted sources, nowhere else") — **partially OVERSTATED, CSP gap is real**

- `dangerouslySetInnerHTML` (React's escape hatch for injecting raw HTML directly into the page, bypassing React's normal automatic escaping): **zero occurrences** anywhere in `apps/web/src`.
- Raw `.innerHTML =` assignment (the plain-JavaScript equivalent, also bypasses escaping): **zero occurrences**.

React escapes all interpolated content by default (meaning if you render `{someVariable}` in JSX, React automatically converts any `<`, `>`, `"` etc. into harmless text instead of live HTML), so the typical stored/reflected XSS vector (rendering un-sanitized user input as HTML) doesn't have an entry point in this codebase today. **DOMPurify would have nothing to sanitize** — there's no raw-HTML-rendering call site for it to guard. Adding it now would be a no-op unless a future feature introduces a raw-HTML render path (rich text editor, HTML email preview, etc.), in which case it should be added _at that time_.

**CSP headers are a separate, real gap** — even with React's escaping, a Content-Security-Policy is defense-in-depth (an extra safety layer that limits the damage _if_ something else goes wrong) against any _future_ injection point (a bug, a dependency, a compromised script). Currently `main.ts` sets no security headers at all (see §5, this is really the same fix as Helmet). **CONFIRMED gap**, but bundle it with Helmet rather than treating "DOMPurify" and "CSP" as equally urgent — they're not the same risk tier.

---

## 5. Helmet.js (a popular Express middleware that sets a bundle of security-related HTTP response headers in one line, instead of configuring each by hand) — **CONFIRMED-CRITICAL, straightforward fix**

`grep helmet` across `apps/api` → nothing. `main.ts` sets no security headers (`HSTS` — forces browsers to only ever use HTTPS with this site; `X-Frame-Options` — stops the site being embedded in a hidden iframe on another page, a clickjacking defense; `Referrer-Policy` — controls how much of your URL leaks to other sites when you click a link away from it; `Permissions-Policy` — lets you disable browser features like camera/mic access by default; CSP, described above) at all. This is a real, cheap-to-fix gap — `helmet()` as Express middleware is a ~5 line change. No caveats here; the doc is right.

**Fixed 2026-07-06:** `helmet()` added with an explicit CSP (`default-src 'self'`, no inline scripts except a relaxed policy scoped specifically to `/api-docs` and `/admin/queues`, which render their own inline `<script>`/`<style>` tags — Swagger UI and Bull Board). `Permissions-Policy` added manually via a small custom middleware since Helmet 8 dropped its built-in default for that header (the policy is too app-specific to have a sane one-size-fits-all default). Verified live: `CSP`, `Referrer-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, and `Permissions-Policy` all present on real responses.

---

## 6. Rate limiting (capping how many requests a single caller can make in a given time window, to stop brute-force login attempts or API abuse/spam) — **CONFIRMED-CRITICAL**

No `@nestjs/throttler` (the standard NestJS rate-limiting package), no `express-rate-limit` (its plain-Express equivalent), nothing. Confirmed via dependency grep and package.json inspection. This matters most for:

- `POST /tenant` (create-tenant, unguarded — no login required — hits Keycloak's admin API — could be used to hammer Keycloak or spam-create realms/companies)
- Login/password-grant flows (brute-force risk sits mostly on Keycloak's own side, but the API has no throttle of its own on anything)

No caveats — doc is right, this is a real gap.

**Fixed 2026-07-06:** `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` (Redis-backed sliding window, reusing the existing `RedisService` connection) registered globally via `ThrottlerGuard`. `POST /tenant` additionally gets a much tighter override (`2/10s`, `5/min`) since it's unauthenticated by design and provisions a real Keycloak realm per call. Verified live: 3 rapid calls to `POST /tenant` return `201/400` (validation), `429`, `429`.

---

## 7. Secrets — **CONFIRMED-CRITICAL, found a concrete instance**

The doc's claim ("secrets rotation plan + no committed secrets audit") is validated with an actual example, not just a theoretical gap:

`apps/api/src/tenant/tenant.service.ts:99`:

```ts
secret: 'amdox-secret-123', // In prod, generate a secure UUID
```

This is the Keycloak client secret (a password-like value an OAuth/OIDC client uses to authenticate itself to the login server) used for **every tenant's** `amdox-erp-web` client, hardcoded and committed to git, with a comment acknowledging it should be fixed and never following through. Since the client is `publicClient: true` (confirmed same file, a few lines up — a "public client" is one Keycloak doesn't require a secret from at all, typically used for browser-based apps that can't keep a secret hidden anyway), this specific secret may not currently gate anything meaningful — but it's still a committed, shared, non-random "secret" that should not exist as a literal in source code.

- `.env` (the file convention for keeping real secrets out of source control) is correctly gitignored, no `.env` files are committed, no other hardcoded secrets found via grep — so this looks like a one-off oversight, not a systemic leak. Still worth a proper `trufflehog`/gitleaks (automated tools that scan a whole git history for anything secret-shaped — API keys, passwords, tokens — that got committed by accident) pass since my grep was a quick pattern match, not exhaustive.

**Fixed 2026-07-06:** the hardcoded literal replaced with `crypto.randomUUID()`, generated fresh per tenant instead of one shared value. The exhaustive git-history pass this called for now happens automatically on every push — see §8, TruffleHog is wired into CI.

---

## 8. CI / Trivy / Grype — **CONFIRMED** (this one the doc gets exactly right)

`.github/workflows` (the folder GitHub Actions, the CI system this repo would use, looks in for pipeline definitions) does not exist. There is no CI pipeline at all, so Trivy container scanning and Grype dependency auditing have nothing to run in. This is PLAT-03 (no CI) blocking PLAT-04's scanning sub-items — accurately captured already in the doc's own cross-reference.

**Fixed 2026-07-06:** `.github/workflows/ci.yml` added with 7 jobs — lint, typecheck (both apps), the tenant-scoping audit (§2.6/2.7) as a permanent gate, build, TruffleHog secret scanning, Snyk dependency scanning (gated on a `SNYK_TOKEN` repo secret — skips with a warning instead of failing when it isn't configured, since I can't provision that token myself), and Trivy (filesystem scan across the repo + an image scan of the existing `ml-service` Docker image — `apps/api`/`apps/web` have no production Dockerfile yet, a separate deployment gap, not something folded into this scan step). Every job's underlying command was run locally before being wired in: lint (0 errors), typecheck clean for both apps (fixing one unrelated pre-existing `apps/web` type bug found along the way — see the CI commit), the audit clean, and a full `pnpm run build` succeeding end-to-end.

**Updated 2026-07-09:** Snyk replaced with **Grype** (`anchore/scan-action@v7`) in the `dependency-scan` job. Snyk had been silently skipping on every run because `SNYK_TOKEN` was never configured — the scan step looked green but never actually audited dependencies. Grype is free/OSS (Apache 2.0), needs no account or token, scans the repo path on every push, fails only on fixable HIGH+ findings (`severity-cutoff: high`, `only-fixed: true`), and uploads SARIF to the GitHub Security tab.

---

## 9. Summary table

| #   | Item                    | Doc's claim  | My verdict                                                                                                                                                                                   | Real severity                                   | Status                       |
| --- | ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- |
| 1   | IDOR / tenant isolation | ⚠️ minor gap | **Understated** — auto-scoping middleware is broken (spoofable header), only used by 2/40 services; real protection is manual per-query filtering across 38 services, partially spot-checked | 🔴 High (architecture risk + unaudited surface) | ✅ Fixed (§2.2, §2.6, §2.7)  |
| 2   | CSRF                    | ❌           | **Overstated** — no cookie-based auth exists, so classic CSRF has no exploit path today                                                                                                      | 🟡 Low (CORS allowlist still worth doing)       | ✅ CORS allowlist added (§3) |
| 3   | XSS / DOMPurify         | ❌           | **Overstated** — zero raw-HTML render paths found; DOMPurify would sanitize nothing                                                                                                          | 🟢 Very low currently                           | No action needed (§4)        |
| 4   | CSP headers             | ❌           | Confirmed, real                                                                                                                                                                              | 🟡 Medium (defense-in-depth)                    | ✅ Fixed (§5)                |
| 5   | Helmet.js               | ❌           | Confirmed, real                                                                                                                                                                              | 🟠 Medium-high (cheap fix, no excuse)           | ✅ Fixed (§5)                |
| 6   | Rate limiting           | ❌           | Confirmed, real                                                                                                                                                                              | 🟠 Medium-high                                  | ✅ Fixed (§6)                |
| 7   | Secrets audit           | ❌           | Confirmed, found a live example (`amdox-secret-123`)                                                                                                                                         | 🟠 Medium-high                                  | ✅ Fixed (§7)                |
| 8   | CI/Trivy/Grype          | ❌           | Confirmed, matches PLAT-03                                                                                                                                                                   | 🟡 Blocked on CI existing at all                | ✅ Fixed (§8)                |

**Headline finding not in the original checklist at all:** the tenant-isolation story was more fragile than "de facto guard" suggested. Fixed via an automated, permanent audit script rather than a one-time manual pass — see §2.6/§2.7.

---

## 10. Decisions (2026-07-07) — all items closed out

1. **IDOR depth**: automate rather than hand-audit. Built `audit-tenant-scoping.ts`, ran it, triaged all 77 findings by hand, fixed the 2 genuine gaps, wired it into CI as a permanent gate. See §2.6.
2. ~~**Scope of the tenant-context middleware fix**~~ — **Done (2026-07-06).** Turned out the broken middleware was dead code, never wired in; the real active mechanism (`TenantContextInterceptor`) was already correctly implemented. Deleted the dead file. See §2.2 for the full correction.
3. **Migrate the 38 services onto the safe auto-scoping `prisma` export**: yes, phased — `notification.service.ts` first as proof-of-pattern, verified (tsc, audit script, live smoke test), then the remaining 37 in one batch once the pattern was proven safe. Every existing explicit `tenantId` filter was kept, never removed (background jobs need it regardless of which client is imported). See §2.7.
4. **CORS**: locked down to an explicit `FRONTEND_URL` allowlist. See §3.
5. **Priority order**: followed the suggested order — Helmet → CORS → rate limiting → hardcoded secret → tenant-context middleware → IDOR audit/migration → CSP (bundled with Helmet) → CI pipeline → TruffleHog/Grype/Trivy (in the same CI pipeline). All done.

---

## 11. Changelog

- **2026-07-06** — Initial audit pass. Verified all 6 Day 20 claims against code, found the IDOR/tenant-isolation gap is more serious and structurally different than described, found CSRF/XSS claims overstated relative to actual architecture, confirmed Helmet/rate-limiting/CI gaps as-is, found one concrete hardcoded secret. Nothing fixed yet — awaiting decisions in §10.
- **2026-07-06** — Fixed the tenant-context middleware bug (§2.2), and corrected the finding in the process: the broken file was never actually wired up (dead code, no `app.use()`/`.configure()` anywhere), and the real active mechanism (`TenantContextInterceptor`, global `APP_INTERCEPTOR`) was already correct — reads only `req.user.tenantId`, no header fallback, runs after guards so `req.user` is genuinely populated. Deleted the dead `tenant-context.middleware.ts` file so it can't mislead future readers or get accidentally wired in. `tsc --noEmit` clean, server boots and responds normally. Item 2 of §10 is now resolved; items 1, 3, 4, 5 still open.
- **2026-07-09** — Replaced Snyk with Grype in `.github/workflows/ci.yml` `dependency-scan` job (§8). Snyk had been skipping silently on every CI run (`SNYK_TOKEN` never set). Grype runs on every push with no token, fails on fixable HIGH+ only, uploads SARIF.
- **2026-07-06/07** — Decisions taken (§10) and every remaining item fixed in priority order: Helmet + CSP (§5), CORS allowlist (§3), Redis-backed rate limiting via `@nestjs/throttler` (§6), hardcoded Keycloak secret replaced with `crypto.randomUUID()` (§7), the full automated IDOR audit finding and fixing 2 real cross-tenant gaps out of 77 candidates across 26 files (§2.6), all 38 services migrated onto the safe `prisma` export with a permanent CI guard against regression (§2.7), and a full CI pipeline with TruffleHog/Grype/Trivy wired in (§8) — including fixing an unrelated pre-existing `apps/web` typecheck failure (`react-grid-layout` v1/v2 type mismatch) that would otherwise have made the new pipeline fail on day one for a reason unconnected to this audit. Every fix verified live (not just `tsc`/lint) before committing: real cross-tenant attack attempts blocked, security headers present on real responses, rate limits triggering after N requests, a full monorepo build succeeding end-to-end. All 8 items in §9 are now closed. Full implementation log with commits, files, and exact verification commands: §12.

---

## 12. Implementation log — commits, files touched, exact verification

Every commit below is on `feature/add-vendors-tab`. Each fix was verified against the _running_ system, not just `tsc`/lint — see the specific commands/results per item.

### `77b27e6` — fix: remove dead, buggy tenant-context middleware

- **Deleted:** `apps/api/src/common/middleware/tenant-context.middleware.ts`
- **Verification:** confirmed via `grep` that nothing referenced the class anywhere (no `.configure()`, no `app.use()`); `tsc --noEmit` clean; server restarted and `/health/live` still returned 200.

### `ae5ad60` — feat: Helmet + CSP, CORS allowlist, Redis-backed rate limiting

- **Added:** `helmet` and `@nestjs/throttler` + `@nest-lab/throttler-storage-redis` dependencies
- **Changed:** `apps/api/src/main.ts` (helmet + CSP + Permissions-Policy + CORS allowlist), `apps/api/src/app.module.ts` (`ThrottlerModule` + global `ThrottlerGuard`), `apps/api/src/tenant/tenant.controller.ts` (`@Throttle` override on `createTenant`), `.env.example` (`FRONTEND_URL`)
- **Verification (live, against the running server):**

  ```
  curl -s -D - http://localhost:3001/health/live | grep -iE "content-security|strict-transport|x-frame|referrer-policy|permissions-policy"
  → all 5 headers present with the expected values

  curl -s -D - -H "Origin: https://evil.example.com" http://localhost:3001/health/live | grep -i access-control-allow-origin
  → absent (blocked)
  curl -s -D - -H "Origin: http://localhost:3000" http://localhost:3001/health/live | grep -i access-control-allow-origin
  → Access-Control-Allow-Origin: http://localhost:3000 (allowed)

  for i in 1 2 3 4; do curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3001/tenant -d '{...}'; done
  → 400, 400, 429, 429   (throttle engaged after 2 calls, matching the configured override)
  ```

### `8bb8299` — fix: replace hardcoded Keycloak secret; add automated tenant-scoping audit

- **Changed:** `apps/api/src/tenant/tenant.service.ts` (`randomUUID()` instead of the literal `'amdox-secret-123'`)
- **Added:** `apps/api/scripts/audit-tenant-scoping.ts` (the TS-AST scanner), `apps/api/package.json` (`audit:tenant-scoping` script)
- **Fixed as part of the same commit** (found while running the new script): `purchase.service.ts` (`receiveGoods()` — added a warehouse-ownership check before the stock lookup), `inventory.service.ts` (`recordMovement()` — added product+warehouse ownership checks); ~30 files annotated with `// tenant-scope-ok: <reason>` for verified-safe patterns
- **Verification (live):**
  ```
  # real cross-tenant attack attempt
  curl -X POST /scm/inventory/movements -H "Authorization: Bearer <company-a token>" \
    -d '{"productId": "<real>", "warehouseId": "<belongs to company-b>", ...}'
  → before fix: would have written to company-b's StockLevel row
  → after fix:  404 "Warehouse not found"
  # confirmed via direct DB query: 0 rows in company-b's StockLevel referencing the test warehouse
  ```

### `44b3a49` — refactor: migrate all 38 services onto the safe auto-scoping prisma export

- **Changed:** 38 files across `finance/`, `hr/`, `scm/`, `pm/`, `bi/`, `forecast/`, `audit/`, `auth/`, `notification/` — `import { PrismaClient } from '@amdox/db'` → `import { prisma } from '@amdox/db'`, removed the `private prisma = new PrismaClient()` field, `this.prisma.` → `prisma.` throughout. Every existing explicit `tenantId` filter kept unchanged.
- **Fixed:** `inventory.service.ts` — `consumeFifoCostLayers()`'s `tx: Prisma.TransactionClient` parameter type no longer matched the `$extends()`-wrapped client's transaction type; changed to `type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]` derived directly from the client so it can't drift out of sync
- **Extended:** `audit-tenant-scoping.ts` with a second permanent check — fails if `new PrismaClient()` reappears anywhere in `apps/api/src`
- **Verification (live):**
  ```
  curl /health/ready → {"status":"ready","db":"connected","keycloak":"connected","redis":"connected", ...}
  # full module smoke test (all 200s): GL accounts, AP invoices, AR sales orders, HR employees/
  # departments/leave/payroll, SCM vendors/products/inventory, PM projects, BI dashboards,
  # Forecast products, Audit logs, GDPR requests, Notifications
  # write-path test: created, updated, and deleted a real Department through the migrated service — all succeeded
  ```

### `896c0c8` — feat: add CI pipeline with security scanning

- **Added:** `.github/workflows/ci.yml` (7 jobs: lint, typecheck, tenant-scoping-audit, build, secret-scan, dependency-scan, container-scan)
- **Fixed (unrelated pre-existing bug, found while dry-running the pipeline locally):** `apps/web/src/components/bi/grid-layout-wrapper.tsx` — `react-grid-layout` v2 renamed `Layout` to mean the _array_ type (`readonly LayoutItem[]`), not a single item as in v1; the code was still written for v1 semantics, and a stale `@types/react-grid-layout` v1 package was also still installed alongside v2's own bundled types. Removed the stale types package, fixed the type usage.
- **Also:** added `.turbo/` to `.gitignore` (pre-existing gap, unrelated to this session's other work, noticed while verifying the build)
- **Verification (every job's command run locally before committing the workflow):**
  ```
  pnpm run lint            → 2 successful, 2 total (0 errors, warnings only)
  pnpm --filter api exec tsc --noEmit   → clean
  pnpm --filter web exec tsc --noEmit   → clean (after the grid-layout-wrapper fix)
  pnpm --filter api run audit:tenant-scoping   → clean
  pnpm run build           → 3 successful, 3 total (db, api, web)
  ```

### `13f9501` — docs: close out security-hardening-audit.md

- This document, updated to reflect every fix above.
