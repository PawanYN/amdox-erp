# Amdox ERP — Security Hardening Audit (PLAT-04 / Day 20)

**Started:** 2026-07-06
**Trigger:** `team_assignment.md`'s Day 20 section lists 6 broad claims (CSRF ❌, XSS/DOMPurify/CSP ❌, IDOR ⚠️, Helmet ❌, rate limiting ❌, secrets audit ❌, CI/Trivy/Snyk ❌). Rather than accept these at face value, this document verifies each one against the actual code, records what's confirmed vs. overstated vs. understated, and tracks decisions as we work through them together.
**Status:** Living document — first pass complete, several items need your decision before fixing. See §10.

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

---

## 3. CSRF (Cross-Site Request Forgery — tricking a logged-in user's browser into firing an authenticated request to your site without them meaning to, usually by abusing the fact that browsers auto-attach cookies) — **OVERSTATED** given the current architecture

The doc marks this ❌ with no qualification, implying a live gap. In practice:

- Auth is **pure Bearer JWT** via `Authorization` header (`keycloak.strategy.ts:43` — `ExtractJwt.fromAuthHeaderAsBearerToken()`) — meaning every request has to explicitly attach `Authorization: Bearer <token>` in JavaScript code; it's not cookie/session-based (the older, more CSRF-prone pattern where the browser automatically resends a stored cookie on every request, including ones triggered by a malicious third-party page).
- Frontend never sends `credentials: 'include'` (the fetch-API setting that tells the browser "also attach cookies to this cross-site request") on any fetch (`grep` across `apps/web/src` — zero matches), so it isn't relying on cookies for cross-origin (a request from one website to a different website's server) auth either.

Classic CSRF exploits a browser's _automatic_ attachment of cookies to cross-site requests. Since nothing here uses cookies for auth, a malicious site cannot forge an authenticated request — it has no way to make the victim's browser attach their Bearer token (the token lives in the Keycloak JS adapter's in-memory state, not anywhere a cross-site page can read or trigger). **A dedicated CSRF token/middleware would be solving a problem this architecture doesn't currently have.**

**Caveat that keeps this from being a clean "not needed":** `main.ts:24` — `app.enableCors()` (CORS = Cross-Origin Resource Sharing, the browser rule that normally blocks website A's JavaScript from calling website B's API unless B explicitly allows it) is called with **no options at all**. Nest/Express's `cors` package default is `origin: true` (reflect and allow _any_ calling website) with `credentials` (whether cookies are allowed to ride along) defaulting to `false`. Since credentials are off by default and nothing sends them, this isn't currently a working exploit chain — but it does mean any website in the world can call this API cross-origin (subject to the caller having a valid Bearer token some other way). Recommend: explicit CORS allowlist (a specific list of approved website addresses, instead of "allow everyone") regardless, as defense-in-depth and because it's one line.

---

## 4. XSS (Cross-Site Scripting — an attacker sneaking their own `<script>`/HTML into a page so it runs in another user's browser, e.g. via a comment field that isn't escaped before being displayed) / DOMPurify (a library that strips dangerous HTML/scripts out of untrusted content before displaying it) / CSP (Content Security Policy — a browser-enforced header telling it "only run scripts from these trusted sources, nowhere else") — **partially OVERSTATED, CSP gap is real**

- `dangerouslySetInnerHTML` (React's escape hatch for injecting raw HTML directly into the page, bypassing React's normal automatic escaping): **zero occurrences** anywhere in `apps/web/src`.
- Raw `.innerHTML =` assignment (the plain-JavaScript equivalent, also bypasses escaping): **zero occurrences**.

React escapes all interpolated content by default (meaning if you render `{someVariable}` in JSX, React automatically converts any `<`, `>`, `"` etc. into harmless text instead of live HTML), so the typical stored/reflected XSS vector (rendering un-sanitized user input as HTML) doesn't have an entry point in this codebase today. **DOMPurify would have nothing to sanitize** — there's no raw-HTML-rendering call site for it to guard. Adding it now would be a no-op unless a future feature introduces a raw-HTML render path (rich text editor, HTML email preview, etc.), in which case it should be added _at that time_.

**CSP headers are a separate, real gap** — even with React's escaping, a Content-Security-Policy is defense-in-depth (an extra safety layer that limits the damage _if_ something else goes wrong) against any _future_ injection point (a bug, a dependency, a compromised script). Currently `main.ts` sets no security headers at all (see §5, this is really the same fix as Helmet). **CONFIRMED gap**, but bundle it with Helmet rather than treating "DOMPurify" and "CSP" as equally urgent — they're not the same risk tier.

---

## 5. Helmet.js (a popular Express middleware that sets a bundle of security-related HTTP response headers in one line, instead of configuring each by hand) — **CONFIRMED-CRITICAL, straightforward fix**

`grep helmet` across `apps/api` → nothing. `main.ts` sets no security headers (`HSTS` — forces browsers to only ever use HTTPS with this site; `X-Frame-Options` — stops the site being embedded in a hidden iframe on another page, a clickjacking defense; `Referrer-Policy` — controls how much of your URL leaks to other sites when you click a link away from it; `Permissions-Policy` — lets you disable browser features like camera/mic access by default; CSP, described above) at all. This is a real, cheap-to-fix gap — `helmet()` as Express middleware is a ~5 line change. No caveats here; the doc is right.

---

## 6. Rate limiting (capping how many requests a single caller can make in a given time window, to stop brute-force login attempts or API abuse/spam) — **CONFIRMED-CRITICAL**

No `@nestjs/throttler` (the standard NestJS rate-limiting package), no `express-rate-limit` (its plain-Express equivalent), nothing. Confirmed via dependency grep and package.json inspection. This matters most for:

- `POST /tenant` (create-tenant, unguarded — no login required — hits Keycloak's admin API — could be used to hammer Keycloak or spam-create realms/companies)
- Login/password-grant flows (brute-force risk sits mostly on Keycloak's own side, but the API has no throttle of its own on anything)

No caveats — doc is right, this is a real gap.

---

## 7. Secrets — **CONFIRMED-CRITICAL, found a concrete instance**

The doc's claim ("secrets rotation plan + no committed secrets audit") is validated with an actual example, not just a theoretical gap:

`apps/api/src/tenant/tenant.service.ts:99`:

```ts
secret: 'amdox-secret-123', // In prod, generate a secure UUID
```

This is the Keycloak client secret (a password-like value an OAuth/OIDC client uses to authenticate itself to the login server) used for **every tenant's** `amdox-erp-web` client, hardcoded and committed to git, with a comment acknowledging it should be fixed and never following through. Since the client is `publicClient: true` (confirmed same file, a few lines up — a "public client" is one Keycloak doesn't require a secret from at all, typically used for browser-based apps that can't keep a secret hidden anyway), this specific secret may not currently gate anything meaningful — but it's still a committed, shared, non-random "secret" that should not exist as a literal in source code.

- `.env` (the file convention for keeping real secrets out of source control) is correctly gitignored, no `.env` files are committed, no other hardcoded secrets found via grep — so this looks like a one-off oversight, not a systemic leak. Still worth a proper `trufflehog`/gitleaks (automated tools that scan a whole git history for anything secret-shaped — API keys, passwords, tokens — that got committed by accident) pass since my grep was a quick pattern match, not exhaustive.

---

## 8. CI (Continuous Integration — an automated pipeline that runs tests/checks every time code is pushed, before it's allowed to merge) / Trivy (a tool that scans Docker container images for known security vulnerabilities in their installed packages) / Snyk (a tool that scans your app's dependencies — npm packages — for known vulnerabilities) — **CONFIRMED** (this one the doc gets exactly right)

`.github/workflows` (the folder GitHub Actions, the CI system this repo would use, looks in for pipeline definitions) does not exist. There is no CI pipeline at all, so Trivy container scanning and Snyk dependency auditing have nothing to run in. This is PLAT-03 (no CI) blocking PLAT-04's scanning sub-items — accurately captured already in the doc's own cross-reference.

---

## 9. Summary table

| #   | Item                    | Doc's claim  | My verdict                                                                                                                                                                                   | Real severity                                   |
| --- | ----------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | IDOR / tenant isolation | ⚠️ minor gap | **Understated** — auto-scoping middleware is broken (spoofable header), only used by 2/40 services; real protection is manual per-query filtering across 38 services, partially spot-checked | 🔴 High (architecture risk + unaudited surface) |
| 2   | CSRF                    | ❌           | **Overstated** — no cookie-based auth exists, so classic CSRF has no exploit path today                                                                                                      | 🟡 Low (CORS allowlist still worth doing)       |
| 3   | XSS / DOMPurify         | ❌           | **Overstated** — zero raw-HTML render paths found; DOMPurify would sanitize nothing                                                                                                          | 🟢 Very low currently                           |
| 4   | CSP headers             | ❌           | Confirmed, real                                                                                                                                                                              | 🟡 Medium (defense-in-depth)                    |
| 5   | Helmet.js               | ❌           | Confirmed, real                                                                                                                                                                              | 🟠 Medium-high (cheap fix, no excuse)           |
| 6   | Rate limiting           | ❌           | Confirmed, real                                                                                                                                                                              | 🟠 Medium-high                                  |
| 7   | Secrets audit           | ❌           | Confirmed, found a live example (`amdox-secret-123`)                                                                                                                                         | 🟠 Medium-high                                  |
| 8   | CI/Trivy/Snyk           | ❌           | Confirmed, matches PLAT-03                                                                                                                                                                   | 🟡 Blocked on CI existing at all                |

**Headline finding not in the original checklist at all:** the tenant-isolation story is more fragile than "de facto guard" suggests. It currently _works_ only because the 38 raw-Prisma services happen to filter manually and (in my sample) correctly — not because any structural guarantee prevents a mistake.

---

## 10. Open questions for you (please answer before I start fixing)

1. **IDOR depth**: do you want me to go through all ~38 raw-`PrismaClient` files' full query surface (every `findMany`/`findFirst`/`update`/`delete`) looking for missing `tenantId` filters, or is the sample in §2.5 enough to act on the _architectural_ fix (repair the middleware, decide whether to migrate services onto the safe `prisma` export) without a full manual line-by-line audit of every service?
2. ~~**Scope of the tenant-context middleware fix**~~ — **Done (2026-07-06).** Turned out the broken middleware was dead code, never wired in; the real active mechanism (`TenantContextInterceptor`) was already correctly implemented. Deleted the dead file. See §2.2 for the full correction.
3. **Do you want the 38 services migrated onto the safe auto-scoping `prisma` export**, or do you consider the current "manual `tenantId` in every query" approach acceptable going forward once double-checked? This is a much bigger, riskier refactor than the other fixes here — worth deciding deliberately rather than me just doing it.
4. **CORS**: lock down to an explicit allowlist (e.g. `FRONTEND_URL` env var, i.e. one specific approved address instead of "anyone") even though it's not currently exploitable? (I'd recommend yes — it's one line and removes a "why is this wildcard open" question from any future pen-test.)
5. **Priority order** — my suggested order, cheapest/highest-confidence first: Helmet → CORS allowlist → rate limiting (`nestjs-throttler`) → fix the `amdox-secret-123` hardcode → fix tenant-context middleware → (decide on) broader IDOR audit/migration → CSP → CI pipeline (PLAT-03, larger and somewhat separate from PLAT-04) → trufflehog/Snyk/Trivy (need CI to exist first). Agree, or reorder?

---

## 11. Changelog

- **2026-07-06** — Initial audit pass. Verified all 6 Day 20 claims against code, found the IDOR/tenant-isolation gap is more serious and structurally different than described, found CSRF/XSS claims overstated relative to actual architecture, confirmed Helmet/rate-limiting/CI gaps as-is, found one concrete hardcoded secret. Nothing fixed yet — awaiting decisions in §10.
- **2026-07-06** — Fixed the tenant-context middleware bug (§2.2), and corrected the finding in the process: the broken file was never actually wired up (dead code, no `app.use()`/`.configure()` anywhere), and the real active mechanism (`TenantContextInterceptor`, global `APP_INTERCEPTOR`) was already correct — reads only `req.user.tenantId`, no header fallback, runs after guards so `req.user` is genuinely populated. Deleted the dead `tenant-context.middleware.ts` file so it can't mislead future readers or get accidentally wired in. `tsc --noEmit` clean, server boots and responds normally. Item 2 of §10 is now resolved; items 1, 3, 4, 5 still open.
