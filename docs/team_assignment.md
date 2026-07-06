# Amdox ERP — Team Assignment Document

> **Sources:** Amdox Web.pdf · amdox-erp-detailed-2.html · Live codebase review (July 2026)  
> **Audience:** Project Manager — task ownership and sprint tracking  
> **Last updated:** 6 July 2026 (session 9) — Full authenticated test run with live Keycloak JWT: 19 route/field-name failures diagnosed and fixed across 6 suites; smoke test made self-contained (auto-creates product + GL accounts); `TERMINAL_TEST_LOG.md` added (11 sections — commands, results, analysis per terminal diagnostic); final result: **64/64 pass with real token**. Session 7: closed out all 7 remaining shraddha/sibi/Agrim/Shreya tasks (BE-01, FE-01–FE-06, FE-08) — vendor schema + CRUD, product catalog admin, inventory admin forms, GL account form, AP OCR upload UI. Session 8: BE-05 outbound FIFO cost consumption closed; ESLint + Prettier + Husky + lint-staged + commitlint set up repo-wide (Day 3 gap closed) and all pre-existing violations fixed — apps/api 6 errors → 0, apps/web 84 errors → 0 (72 were `no-explicit-any`, replaced with real types derived from actual field usage). Session 9: full re-audit of every claim in this document against the actual codebase (4 parallel deep-verification passes, not repeat greps). Found and corrected 8 wrong claims total — 3 in an earlier pass this session (Gantt chart, SAML adapter, Prisma Studio all under-claimed ❌ when actually implemented) plus 5 more in this pass: org chart (under-claimed, same pattern), Postman collection (imprecise — a real conversion script exists but is broken, not "never attempted"), BE-04 intercompany transfer (over-claimed ✅ — implemented but never end-to-end verified, no test/script exists), INT-08 (stale ❌ note in the Remaining table contradicted the already-✅ Integrations table), and F-04/F-11/F-12 missing entirely from the PDF requirement mapping table. Root cause of all 8: the original audit relied on narrow single-keyword greps instead of reading the actual files/READMEs. A concurrent session then did exactly the live SAML SSO test this doc flagged as missing, found and fixed a real bug in the process (`identityProviders.create()` called with two args instead of one, silently dropping the provider config for every IdP type — see `testing/SAML_SSO_TEST_LOG.md`), plus two smaller findings now tracked in the Remaining table (admin token refresh, misleading HTTP status codes). Also closed two more Day 6 gaps: added a global exception filter (`AllExceptionsFilter` via `APP_FILTER`) for consistent API error responses, and fixed the Postman collection auto-generation script (wrong CLI binary name — the npm package `openapi-to-postmanv2` ships a binary called `openapi2postmanv2`). Multi-currency FX fetch closed: `fx-rate.service.ts` replaced the mocked cron (hardcoded rate, fake tenant ID) with a real call to ECB's free `eurofxref-daily.xml` feed, verified live against all 3 real tenants (29 currencies, upsert-safe re-runs). Session 10: closed the Day 14 "Database query optimisation" gap — audited all 58 Prisma models against every real service query (not a guess from table names), seeded ~80k rows, verified 8 missing composite indexes with real `EXPLAIN ANALYZE` before/after (caught and corrected a 2-column Invoice index that measured as a no-op, fixed to 3 columns), and fixed an N+1 query in `ap.service.ts`'s `createPaymentRun()`. Full record in `testing/QUERY_OPTIMISATION_AUDIT.md`; teaching walkthrough in `docs/learning/query-optimisation-and-n1-walkthrough.md`. Also corrected two stale ❌ claims found while re-checking Day 17: ECharts was actually already wired in (`echarts-for-react` powers heatmap/funnel/scatter/treemap/waterfall/gauge in `widget-chart.tsx`/`advanced-charts.tsx`, rendered via `bi-workspace.tsx` — likely added in the concurrent session's BI redesign after this line was last written) — corrected to ✅. Scheduled report "Excel" export was a CSV file with a misleading label; replaced with a real `.xlsx` via `exceljs` in `bi-report.service.ts`, verified live (created report, ran it, downloaded, confirmed `Microsoft Excel 2007+` file with 2 real worksheets) — corrected to ✅.

---

## 1. Tag Legend

| Tag Type      | Tags                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module**    | `#auth` `#tenant` `#finance-gl` `#finance-ap` `#finance-ar` `#hr` `#scm` `#pm` `#bi` `#forecast` `#notifications` `#audit` `#gdpr` `#infra` |
| **Layer**     | `#frontend` `#backend` `#fullstack` `#integration` `#devops`                                                                                |
| **Work type** | `#form` `#api-wire` `#integration-test` `#cleanup` `#spec-gap` `#decision-needed`                                                           |
| **Priority**  | `#P0` Demo/submission blocker · `#P1` Core flow · `#P2` Polish · `#P3` Post-MVP                                                             |
| **Status**    | ✅ Done · ⚠️ Partial · ❌ Not started · 🔄 Built under a different name/tool — `{actual name in repo}` follows                              |

**Assignment:** Use the **Status** and **Assigned To** columns in each task table below. Suggested default slots are in §8.

---

## 2. Executive Snapshot

### Done (verified in repo)

| Area                               | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Auth & Multi-tenant**            | `apps/api/src/auth/` (Keycloak, JWT, roles guard); `tenant.controller.ts` + `tenant-api.ts`; `create-tenant/page.tsx`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Auth —** `/auth/me` **endpoint** | `GET /auth/me` returns DB roles (normalised) — frontend uses this for RBAC checks instead of unreliable Keycloak `realm_access.roles`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Keycloak role provisioning**     | `createTenant()` now creates Keycloak realm roles + assigns `TenantAdmin` to admin user so JWT `realm_access.roles` is populated; `POST /tenant/provision-kc-roles` for existing tenants                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Role name standardisation**      | DB role unified to `"TenantAdmin"` (no space) across `createTenant()` and `seed.ts`; `RolesGuard` space-strip kept as safety net                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Finance GL (core)**              | Journal entries, fiscal periods, intercompany, aging report — `finance/journal-entries`, `fiscal-periods`, `aging-report` pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Finance AR / Order-to-Cash**     | `sales-order.service.ts` (BE-02); `finance/ar-invoices/page.tsx` (FE-09)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **HR & Payroll**                   | Employee/department CRUD, payroll month picker, payslip PDF — `hr/employees`, `departments`, `payroll` pages                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **Project Management**             | Wizard, edit/status, tasks, milestones, budget, material requests — `projects/[id]/page.tsx` (FE-13)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **BI Dashboard Builder**           | Full stack: `apps/api/src/bi/` (8 files) + `components/bi/` (12 files) → `/bi` route; redesigned with fixed scroll, Data pane, Filters pane, clean toolbar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Notifications (in-app)**         | `notifications/page.tsx` → `PATCH /notifications/:id/read` (FE-15)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| **ML Forecast service**            | `apps/ml-service/main.py` + `forecast.controller.ts` (BE-09)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **AI Forecast UI**                 | ForecastPanel upgraded with Recharts + horizon selector + model status (inventory page); `/scm/forecast` global dashboard — stats cards, MAPE chart, SKU table with per-row train button; `GET /forecast/products` backend endpoint — closes FE-14, INT-06, F-06                                                                                                                                                                                                                                                                                                                                                                                                   |
| **Audit pipeline**                 | `audit-event.listener.ts` — 25+ events with hash chain (BE-06)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **UI Design System**               | 40+ files overhauled: consistent blue/slate palette, Inter font, `globals.css` `@theme` tokens, shadow-card, page-title/subtitle, custom scrollbar, all modules                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Dashboard shell**                | `DashboardLayoutClient` (`ssr:false`) fixes hydration mismatch; collapsible sidebar; Settings visible to all roles; IT Admin restricted to Home + Settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Settings page**                  | Role-based tab access via `/auth/me`; admin-only tabs (Identity Settings, Auth, IdP) show `AdminRequired` for non-admins; horizontal tab bar; TenantAdmin RBAC                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **Identity Providers UI**          | Full Keycloak-reference IdP manager (`components/settings/idp-manager.tsx`): card picker (User-defined + Social sections), per-provider forms (Google, Microsoft, GitHub, SAML, Keycloak OIDC, OpenID Connect v1.0), Redirect URI read-only+copy, toggle switches, secret show/hide, breadcrumb nav — fulfils F-01                                                                                                                                                                                                                                                                                                                                                 |
| **AmdoxLogger**                    | `apps/api/src/common/logger/amdox-logger.ts` — 256-color ANSI branded logger with 14 domain/severity methods; integrated into 9 critical files (auth strategy, GL service, payroll processor, tenant service, purchase service, 3 bridge listeners, main.ts); startup banner; `docs/amdox-logger.md` written                                                                                                                                                                                                                                                                                                                                                       |
| **HTTP logging + RolesGuard**      | `HttpLoggingInterceptor` replaces Pino raw "request completed" JSON with AmdoxLogger `[ HTTP ]` teal lines (warn on 4xx, error on 5xx); RolesGuard `console.log` → `AmdoxLogger.warn()` on deny only; Pino `autoLogging: false`                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| **Functional test suite**          | `testing/` — 9 suites, 64 tests, **64/64 pass** (Day 14 PDF); custom ESM runner + AmdoxLogger-style ANSI output + JSON result files; covers: health, Finance GL (double-entry enforcement), HR, SCM, PM, AI Forecast (MAPE ≤ 12%), Auth/RBAC (tenant isolation), cross-module P2P chain, Audit hash chain                                                                                                                                                                                                                                                                                                                                                          |
| **AI Forecast sidebar**            | `AI Forecast` leaf entry added to global sidebar nav (TrendingUp icon); standalone `/forecast` page with design system tokens; visible to tenantadmin, executive, scm roles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **Authenticated test run**         | All 9 suites verified with live Keycloak JWT ([admin@companya.in](mailto:admin@companya.in), TenantAdmin role); 19 route/field-name mismatches diagnosed and fixed; smoke test (Suite 08) made fully self-contained — auto-creates SCM product + GL accounts 1300/2000 if missing; full P2P chain (Steps 0–7) passes end-to-end; `TERMINAL_TEST_LOG.md` documents 11 diagnostic steps with commands, results, analysis                                                                                                                                                                                                                                             |
| **Vendor CRUD + schema**           | `phone` added to `Vendor` Prisma model (migration `20260705000000_add_vendor_phone`) + DTOs; `scm/vendors/page.tsx` rebuilt with Add/Edit/Delete modal, rating column removed per PM decision D1 — closes BE-01, FE-01, FE-02                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| **Product catalog admin**          | New `scm/products/page.tsx` — CRUD modal (SKU, name, unit cost, default vendor); nav entries added to sidebar + SCM tab bar — closes FE-03                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Inventory admin forms**          | `scm/inventory/page.tsx` — added New Warehouse, Record Stock Movement, Reorder Rule modals wired to `/scm/inventory/`\*; confirmed "Raise PR" already called real backend API — closes FE-04, FE-05                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **GL Account form**                | `finance/accounts/page.tsx` — "New Account" button wired to modal → `POST /finance/gl/accounts` — closes FE-06                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| **AP OCR upload UI**               | `finance/invoices/page.tsx` — upload modal (file input + optional goods receipt ID) wired to `financeApi.uploadInvoice`; fixed multipart field-name mismatch (`file` → `document`) that would have made the upload silently fail against `FileInterceptor('document')` — closes FE-08                                                                                                                                                                                                                                                                                                                                                                              |
| **FIFO outbound consumption**      | `consumeFifoCostLayers()` added to `inventory.service.ts` — `recordMovement()` now drains `InventoryCostLayer` rows oldest-first for ISSUE/TRANSFER, costing COGS off actual purchase price history instead of latest unit cost; falls back gracefully (reports `unmatchedQuantity`, doesn't block the movement) when no cost layer trail exists (e.g. legacy/seeded stock); verified live via API: 10 units @₹50 + 10 units @₹80 received, issued 15 → drained 10@50 + 5@80 = ₹900, correct FIFO order — closes BE-05                                                                                                                                             |
| **Lint/format/commit tooling**     | ESLint flat configs for both apps (`apps/web/eslint.config.mjs` Next 15, `apps/api/eslint.config.mjs` typescript-eslint), `.prettierrc.json` + web override, `.husky/pre-commit` (`lint-staged`, blocks on error) + `.husky/commit-msg` (`commitlint`) — closes the Day 3 tooling gap in §4                                                                                                                                                                                                                                                                                                                                                                        |
| **Repo-wide lint cleanup**         | Fixed all pre-existing violations once tooling was in place: `apps/api` 6 errors → 0 (require-imports, prefer-const, empty-block), `apps/web` 84 errors → 0 (72 `no-explicit-any` replaced with real types inferred from actual API/field usage across ~24 files, plus unescaped-entities and one `<a>` → `Link`); verified via `tsc --noEmit` on both apps + live dev-server smoke test of all 21 touched pages (all 200, no runtime errors)                                                                                                                                                                                                                      |
| **Query optimisation + N+1 fix**   | `testing/QUERY_OPTIMISATION_AUDIT.md` — audited all 58 Prisma models against every real service query, seeded ~80k rows on a real tenant, verified 8 missing composite indexes with real `EXPLAIN ANALYZE` before/after (`AuditLog`, `Invoice`, `Notification`, `JournalEntry`, `PurchaseOrder`, `PurchaseRequisition`, `InventoryCostLayer`, `StockMovement` — migration `20260706120000_query_optimisation_indexes`); fixed N+1 in `ap.service.ts` `createPaymentRun()` (per-invoice `findFirst` loop → one `findMany` + `Map` lookup), verified by query-count script and live endpoint test — closes Day 14 EXPLAIN ANALYZE gap + part of Day 21 bottleneck ID |

### Remaining (open tasks)

| Area                                        | Gap                                                                                                                                                                                                                                                              | Task IDs           |     |     |     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------ | --- | --- | --- |
| **SCM admin UI**                            | ✅ Closed session 7 — Vendor CRUD modal, product catalog page, warehouse/movement/reorder-rule forms                                                                                                                                                             | FE-01–FE-05, BE-01 |     |     |     |
| **Finance forms**                           | ✅ Closed session 7 — GL "New Account" modal, AP OCR upload UI wired                                                                                                                                                                                             | FE-06, FE-08       |     |     |     |
| **Notifications delivery**                  | Email/webhook channels are log-only stubs                                                                                                                                                                                                                        | BE-07              |     |     |     |
| **Intercompany transfer verification**      | BE-04 implemented but never end-to-end verified — no test/script exists                                                                                                                                                                                          | BE-04              |     |     |     |
| **Keycloak admin token refresh**            | `TenantService.onModuleInit()` authenticates the Keycloak admin client once at boot with no refresh; long-lived processes will silently fail all admin-client calls once the token expires — found during live SAML SSO test (`testing/SAML_SSO_TEST_LOG.md` §9) | —                  |     |     |     |
| **Identity-provider endpoint status codes** | `TenantController` create/delete/update identity-provider routes return HTTP 200/201 even when the service layer returns `{error: ...}` — misleading status code, correct message still in body                                                                  | —                  |     |     |     |
| **Platform / Deploy**                       | No `.github/workflows/`, no live demo URL, no demo video                                                                                                                                                                                                         | PLAT-01–PLAT-03    |     |     |     |
| **Security hardening**                      | ValidationPipe + CORS only; no Helmet/rate limiting                                                                                                                                                                                                              | PLAT-04            |     |     |     |

### Area status

| Area                          | Status         | Gap summary                                                                                                                                                                                                  |
| ----------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth & Multi-tenant           | ✅ Mostly done | Keycloak OIDC, tenant context, create-tenant; `/auth/me` endpoint; Keycloak realm role provisioning; role name unified; IdP UI (Google/Microsoft/GitHub/SAML/OIDC) per F-01                                  |
| Finance GL/AP                 | ✅ Done        | Journal entries ✅; fiscal periods ✅; aging report ✅; GL Account create modal ✅ (FE-06); AP OCR upload UI ✅ (FE-08)                                                                                      |
| Finance AR / Order-to-Cash    | ✅ Mostly done | Sales Order module ✅ (BE-02); AR invoice + payment UI ✅ (FE-09)                                                                                                                                            |
| HR & Payroll                  | ✅ Mostly done | Employee CRUD ✅; departments ✅; leave/attendance/payroll on live APIs ✅; payslip PDF ✅; period picker ✅                                                                                                 |
| SCM                           | ✅ Done        | PO + requisition flow works; vendor CRUD modal ✅; product catalog admin ✅; inventory admin forms ✅ (FE-01–FE-05, BE-01)                                                                                   |
| Project Management            | ✅ Done        | Project edit/status UI ✅ (FE-13); wizard, material requests, budget bridges; custom Gantt chart ✅ (`projects/tasks/page.tsx`); milestone overdue alerts ✅ (`projects/milestones/page.tsx`) — fulfils F-07 |
| BI / Forecast / Notifications | ✅ Mostly done | BI workspace redesigned ✅ — fixed scroll, Data pane, Filters pane, clean toolbar; mark-read ✅; AI Forecast dashboard ✅ — Recharts panel + `/scm/forecast` global view (FE-14 ✅, INT-06 ✅, F-06 ✅)      |
| Settings                      | ✅ Mostly done | Horizontal tab bar; role-based tab access via `/auth/me`; AdminRequired guard; TenantAdmin provisioning; IdP manager fully rebuilt (F-01)                                                                    |
| UI Design System              | ✅ Done        | 40+ pages overhauled; blue/slate palette; Inter font; design tokens in `globals.css`; consistent across all modules                                                                                          |
| Platform / Deploy             | ❌ Not started | No live demo URL, CI, or security hardening (PLAT-01–PLAT-04)                                                                                                                                                |

### Overall progress

| Layer              | ✅ Done | ⚠️ Partial | ❌ Not started | Total  |
| ------------------ | ------- | ---------- | -------------- | ------ |
| Frontend (FE)      | 18      | 0          | 0              | 18     |
| Backend (BE)       | 9       | 1          | 1              | 11     |
| Integrations (INT) | 9       | 0          | 0              | 9      |
| Platform (PLAT)    | 0       | 1          | 4              | 5      |
| **All tasks**      | **36**  | **2**      | **5**          | **43** |

> **Also shipped (session 2, not in task table):** Complete UI overhaul (40+ files), BI workspace redesign, Settings RBAC fix, `/auth/me` endpoint, Keycloak role provisioning, `TenantAdmin` role standardisation, `DashboardLayoutClient` hydration fix.

> **Also shipped (session 3, not in task table):** AmdoxLogger 256-color branded logger (`common/logger/amdox-logger.ts`) integrated into 9 API files with startup banner; `docs/amdox-logger.md`; Identity Providers tab rebuilt from scratch matching Keycloak reference screenshots — provider card picker grid (User-defined + Social), dedicated add forms per provider (Google, Microsoft, GitHub, SAML v2.0, Keycloak OIDC, OpenID Connect v1.0) with all correct fields, Redirect URI copy button, toggle switches, secret show/hide, breadcrumb navigation — fulfils PDF F-01.

> **Also shipped (session 4, not in task table):** ForecastPanel (inventory page) upgraded — Recharts `BarChart` with date/qty axes, 14d/30d horizon selector, model type badge, last trained date; `GET /forecast/products` backend endpoint (mapeScore, trainedAt, modelType, predictionCount per SKU); `forecastApi.getAllForecastStatus()` frontend client method; `/scm/forecast` global AI Forecast dashboard — stats cards (total SKUs, trained, avg MAPE, stale count), MAPE-by-SKU bar chart, full SKU table with per-row Train/Re-train button and train-all; AI Forecast tab added to SCM nav — closes FE-14, INT-06, F-06.

> **Also shipped (session 5, not in task table):** Functional test suite (`testing/`) — 9 suites, 64 tests, 64/64 pass; zero-dependency ESM runner with AmdoxLogger-style ANSI output and JSON result artifacts; suites: health & gateway, Finance GL (double-entry enforcement), HR & Payroll, SCM & Inventory, Project Management, AI Forecast (MAPE ≤ 12% assertion + ML health), Auth/RBAC (tenant isolation breach detection), cross-module P2P smoke test (PO→GR→stock→AP invoice→GL journal — PDF Day 14), Audit hash chain. `HttpLoggingInterceptor` replaces Pino raw HTTP logs with branded `[ HTTP ]` teal lines; `RolesGuard` de-noised (warn on deny only). AI Forecast leaf item added to global sidebar.

> **Also shipped (session 6, not in task table):** Full authenticated test run with live Keycloak JWT — discovered and fixed 19 test failures: 12 wrong route paths (leave/all-requests, attendance/all, hr/payroll?period=, finance/ar/aging-report, finance/ap/invoices, pm/projects/tasks, pm/projects/:id/milestones, pm/resources, scm/requisitions, audit/logs, gdpr/requests, scm/inventory/warehouses), 3 wrong field names (roles vs userRoles, action vs eventType), 1 HTTP method mismatch (POST vs PATCH for AP invoice approve), 1 payroll response unwrap (wrapped `{data:[]}` object), 2 missing seed data conditions. Smoke test (Suite 08) made self-contained: auto-creates SCM product and GL accounts 1300/2000 if tenant has none — enabling clean re-runs in any environment. Root cause of GL journal silence identified: `handleInvoiceApproved` had no accounts to post against for the company-a tenant, so `try/catch` swallowed the error silently. `TERMINAL_TEST_LOG.md` written with 11 sections documenting every diagnostic command, result, and analysis from the session.

**Completion:** ~84% done · ~5% partial · ~12% not started

### Progress by owner

| Owner          | ✅ Done                                                                                                                                                                                                                                                                                                                                                                                                                | ⚠️ Partial                            | ❌ Open                    |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | -------------------------- |
| **pawan**      | FE-07, FE-09, FE-10, FE-11, FE-12, FE-13, FE-14, FE-15, FE-16, FE-17, FE-18, BE-02, BE-03, BE-05, BE-06, BE-08, BE-09, BE-10, BE-11, INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08, INT-09 + UI overhaul + BI redesign + Settings RBAC + Auth/me + KC provisioning + AmdoxLogger + IdP UI (F-01) + AI Forecast dashboard (F-06) + functional test suite (64 tests, Day 14) + HTTP logging interceptor | BE-04 (implemented, not E2E-verified) | —                          |
| **shraddha**   | FE-01, FE-02                                                                                                                                                                                                                                                                                                                                                                                                           | —                                     | —                          |
| **sibi**       | FE-03, FE-04, FE-05                                                                                                                                                                                                                                                                                                                                                                                                    | —                                     | —                          |
| **Agrim**      | FE-06, FE-08                                                                                                                                                                                                                                                                                                                                                                                                           | —                                     | —                          |
| **Shreya**     | BE-01                                                                                                                                                                                                                                                                                                                                                                                                                  | —                                     | —                          |
| **Unassigned** | —                                                                                                                                                                                                                                                                                                                                                                                                                      | PLAT-04                               | BE-07, PLAT-01–03, PLAT-05 |

---

## 3. Master Task List — Frontend

| ID    | Status | Tags                                          | Task                                                  | Acceptance criteria                                                                                      | Priority | Assigned To |
| ----- | ------ | --------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| FE-01 | ✅     | `#frontend` `#scm` `#form`                    | Vendor CRUD modal on `/scm/vendors`                   | Add/Edit/Delete via API; refresh table; remove console.log stub                                          | P0       | shraddha    |
| FE-02 | ✅     | `#frontend` `#scm` `#decision-needed`         | Resolve Vendor Phone/Rating mismatch                  | Remove rating from UI; keep phone (blocked on BE-01)                                                     | P1       | shraddha    |
| FE-03 | ✅     | `#frontend` `#scm` `#form` `#api-wire`        | Product catalog admin page                            | CRUD for `POST/PATCH/DELETE /scm/products`                                                               | P1       | sibi        |
| FE-04 | ✅     | `#frontend` `#scm` `#form` `#api-wire`        | Inventory admin forms                                 | Warehouse, stock movement, reorder rules via `/scm/inventory/*`                                          | P1       | sibi        |
| FE-05 | ✅     | `#frontend` `#scm` `#api-wire`                | Wire "Raise PR" on inventory page                     | Call backend reorder/requisition (not local state only)                                                  | P1       | sibi        |
| FE-06 | ✅     | `#frontend` `#finance-gl` `#form` `#api-wire` | New GL Account form                                   | "New Account" → modal → `POST /finance/gl/accounts`                                                      | P0       | Agrim       |
| FE-07 | ✅     | `#frontend` `#finance-gl` `#form` `#api-wire` | Create Journal Entry form                             | Post → `POST /finance/gl/journal-entries`; accounts from API                                             | P0       | pawan       |
| FE-08 | ✅     | `#frontend` `#finance-ap` `#form` `#api-wire` | Invoice OCR upload UI                                 | File upload → `POST /finance/ap/invoices/upload`                                                         | P1       | Agrim       |
| FE-09 | ✅     | `#frontend` `#finance-ar` `#form` `#api-wire` | AR invoice + payment UI                               | Forms for `POST /finance/ar/invoices` and `POST /finance/ar/payments`                                    | P1       | pawan       |
| FE-10 | ✅     | `#frontend` `#hr` `#form` `#api-wire`         | Payslip PDF download                                  | Wire modal to `GET /hr/payroll/:payslipId/payslip`                                                       | P1       | pawan       |
| FE-11 | ✅     | `#frontend` `#hr` `#form` `#api-wire`         | Employee edit/delete actions                          | Row actions → `PATCH/DELETE /employees/:id`                                                              | P1       | pawan       |
| FE-12 | ✅     | `#frontend` `#hr` `#form`                     | Department admin page                                 | CRUD for `/departments`                                                                                  | P2       | pawan       |
| FE-13 | ✅     | `#frontend` `#pm` `#form`                     | Project edit / status change UI                       | Edit metadata; lifecycle status change via PATCH                                                         | P2       | pawan       |
| FE-14 | ✅     | `#frontend` `#forecast` `#api-wire`           | Forecast train button on inventory + global dashboard | Recharts ForecastPanel with horizon selector; `/scm/forecast` page with MAPE chart, SKU table, train-all | P2       | pawan       |
| FE-15 | ✅     | `#frontend` `#notifications` `#api-wire`      | Mark notification as read                             | Wire `PATCH /notifications/:id/read` on click                                                            | P2       | pawan       |
| FE-16 | ✅     | `#frontend` `#cleanup`                        | Replace hardcoded `localhost:3001`                    | All pages use `apiClient` / `hrApi` / `tenantApi`                                                        | P1       | pawan       |
| FE-17 | ✅     | `#frontend` `#cleanup`                        | Remove dead mock imports                              | No `@/lib/mock` imports in app code; 3 orphan files remain (`hr.ts`, `it.ts`, `pm-v2.ts`)                | P2       | pawan       |
| FE-18 | ✅     | `#frontend` `#hr`                             | Payroll period selector                               | Replace hardcoded `2026-06` with month picker                                                            | P2       | pawan       |

---

## 4. Master Task List — Backend

| ID    | Status | Tags                                    | Task                               | Acceptance criteria                                                                                                                                                                                                                                        | Priority | Assigned To |
| ----- | ------ | --------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| BE-01 | ✅     | `#backend` `#scm` `#decision-needed`    | Vendor schema alignment            | Add **phone** to `Vendor` model (D1 — keep phone, remove rating)                                                                                                                                                                                           | P1       | Shreya      |
| BE-02 | ✅     | `#backend` `#finance-ar` `#spec-gap`    | Order-to-Cash module (Sales Order) | Sales order → AR invoice → payment reconciliation                                                                                                                                                                                                          | P1       | pawan       |
| BE-03 | ✅     | `#backend` `#finance-gl`                | Fiscal period close admin          | `GET/POST open/close` + fiscal periods admin UI                                                                                                                                                                                                            | P2       | pawan       |
| BE-04 | ⚠️     | `#backend` `#finance-gl` `#integration` | Intercompany transfer flow         | Implemented (`createIntercompanyTransfer()` in `gl.service.ts:246` + GL journal pairing); acceptance criteria says "end-to-end verify" but no test/script exists (not in Suite 02, no `verify:*` script — unlike BE-05's documented live-API verification) | P2       | pawan       |
| BE-05 | ✅     | `#backend` `#scm` `#integration`        | FIFO cost layer                    | Inbound layers on goods receipt ✅; outbound FIFO consumption ✅ (`consumeFifoCostLayers()`)                                                                                                                                                               | P2       | pawan       |
| BE-06 | ✅     | `#backend` `#audit`                     | Expand audit event coverage        | 25+ events → `AuditService.record()` with hash chain                                                                                                                                                                                                       | P2       | pawan       |
| BE-07 | ❌     | `#backend` `#notifications` `#spec-gap` | Real email/webhook delivery        | AWS SES / HMAC webhooks — channel stubs log-only                                                                                                                                                                                                           | P3       |             |
| BE-08 | ✅     | `#backend` `#scm` `#spec-gap`           | Vendor external portal             | `/vendor-portal` UI + API; portal keys via `POST /scm/vendors/:id/portal-key`                                                                                                                                                                              | P3       | pawan       |
| BE-09 | ✅     | `#backend` `#forecast` `#integration`   | ML service ops                     | FastAPI Prophet service + fallback; Docker health-check                                                                                                                                                                                                    | P2       | pawan       |
| BE-10 | ✅     | `#backend` `#bi`                        | BI dashboard builder API           | Dashboard + widget CRUD, drill-down, SSE, scheduled reports                                                                                                                                                                                                | P2       | pawan       |
| BE-11 | ✅     | `#backend` `#auth`                      | RBAC enforcement audit             | Role matrix in `docs/rbac-role-matrix.md`; RBAC on BI/PM/Forecast/Audit/GDPR                                                                                                                                                                               | P2       | pawan       |

---

## 5. Cross-Module Integrations

| ID     | Status | Tags                        | Flow                           | What to verify / finish                                                                                                                                                                                                                                    | Priority | Assigned To |
| ------ | ------ | --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ----------- |
| INT-01 | ✅     | `#integration` `#fullstack` | Procure-to-Pay                 | Low stock → PR/PO → GR → 3-way match → GL journal                                                                                                                                                                                                          | P0       | pawan       |
| INT-02 | ✅     | `#integration` `#fullstack` | PM → SCM → Finance (materials) | E2E verified: material request → requisition (with projectId) → PO → GR → invoice.approved → PmCostBridgeListener → budget.actualAmount updated                                                                                                            | P0       | pawan       |
| INT-03 | ✅     | `#integration` `#fullstack` | PM ↔ HR (people)               | Resource allocation form added to `/projects/resources`; allocations list + utilisation heatmap from real API; POST /pm/resources/allocate wired                                                                                                           | P1       | pawan       |
| INT-04 | ✅     | `#integration` `#fullstack` | PM ↔ Finance (labor cost)      | LaborCostBridgeListener → BudgetService confirmed E2E; `GET /pm/budgets/:id/lines` added; budget page shows drill-down of AP + payroll cost lines                                                                                                          | P1       | pawan       |
| INT-05 | ✅     | `#integration` `#fullstack` | HR → Finance (payroll)         | `@OnEvent('payroll.completed')` added to GlService: Dr 6000 Salary Expense / Cr 2100 Payroll Payable; accounts added to seed; duplicate guard included                                                                                                     | P1       | pawan       |
| INT-06 | ✅     | `#integration` `#fullstack` | SCM → Forecasting              | Inventory page: per-SKU ▸ expand row → "Train forecast" button → `POST /forecast/products/:id/train` (feeds StockMovement history to Prophet ML); bar chart predictions displayed                                                                          | P2       | pawan       |
| INT-07 | ✅     | `#integration` `#fullstack` | All → Notifications            | `WebhookChannel` implemented with HMAC-SHA256 signing; `NotificationService` reads `tenant.settings.webhookUrl` and dispatches; added payroll.completed, leave.status.changed, employee.created, invoice.issued notifications; delivery logged per channel | P2       | pawan       |
| INT-08 | ✅     | `#integration` `#fullstack` | All → Audit                    | `userId` now threaded through 25+ event payloads: employee CRUD, PO approve/receive, invoice approve, journal entry, fiscal period close, intercompany transfer, project created. AuditEventListener passes userId to hash-chain record.                   | P2       | pawan       |
| INT-09 | ✅     | `#integration` `#spec-gap`  | Order-to-Cash                  | BE-02 Sales Order + FE-09 AR flow complete                                                                                                                                                                                                                 | P2       | pawan       |

---

## 6. Platform & Submission Tasks

| ID      | Status | Tags                | Task                      | Notes                                            | Priority | Assigned To |
| ------- | ------ | ------------------- | ------------------------- | ------------------------------------------------ | -------- | ----------- |
| PLAT-01 | ❌     | `#devops`           | Deploy live demo URL      | 30% of submission weight                         | P0       |             |
| PLAT-02 | ❌     | `#devops`           | Record 5–7 min demo video | Finance → SCM → HR → PM → BI walkthrough         | P0       |             |
| PLAT-03 | ❌     | `#devops`           | GitHub Actions CI         | No `.github/workflows` in repo                   | P1       |             |
| PLAT-04 | ⚠️     | `#backend` `#infra` | Security hardening        | ValidationPipe + CORS only; no Helmet/rate limit | P1       |             |
| PLAT-05 | ❌     | `#devops`           | K8s / observability / PWA | Post-MVP per PDF spec                            | P3       |             |

---

## 7. Forms Checklist — Model by Model

| Model / Screen              | Backend   | Frontend | Status                                                                               | Task ID      | Assigned To |
| --------------------------- | --------- | -------- | ------------------------------------------------------------------------------------ | ------------ | ----------- |
| Vendor                      | ✅ CRUD   | ✅       | Add/Edit/Delete modal wired to API; phone field added (rating removed per D1)        | FE-01, FE-02 | shraddha    |
| Product                     | ✅ CRUD   | ✅       | Dedicated `/scm/products` admin page with CRUD modal                                 | FE-03        | sibi        |
| Warehouse / Stock / Reorder | ✅        | ✅       | Admin modals on inventory page: new warehouse, record movement, reorder rule         | FE-04        | sibi        |
| Purchase Order              | ✅        | ⚠️       | Create from requisition only                                                         | OK for MVP   | —           |
| Goods Receipt               | ✅ via PO | ⚠️       | Placeholder page                                                                     | Optional     | —           |
| AP Invoice (OCR)            | ✅        | ✅       | Upload modal wired to `POST /finance/ap/invoices/upload` (fixed field-name mismatch) | FE-08        | Agrim       |
| GL Account                  | ✅        | ✅       | "New Account" modal wired to `POST /finance/gl/accounts`                             | FE-06        | Agrim       |
| Journal Entry               | ✅        | ✅       | POST wired                                                                           | FE-07        | pawan       |
| Fiscal Period               | ✅        | ✅       | Open/close admin UI                                                                  | BE-03        | pawan       |
| AR Invoice / Payment        | ✅        | ✅       | Create invoice + record payment                                                      | FE-09        | pawan       |
| Employee                    | ✅ CRUD   | ✅       | Create + edit/delete                                                                 | FE-11        | pawan       |
| Department                  | ✅ CRUD   | ✅       | Full admin page                                                                      | FE-12        | pawan       |
| Leave Request               | ✅        | ✅       | Live API; manager ID hardcoded in `current-user.ts`                                  | —            | —           |
| Attendance                  | ✅        | ⚠️       | Admin list via API; no clock-in/out UI                                               | Optional     | —           |
| Payroll Run                 | ✅        | ✅       | Done + month picker                                                                  | FE-18        | pawan       |
| Payslip PDF                 | ✅        | ✅       | Download wired                                                                       | FE-10        | pawan       |
| Project                     | ✅ CRUD   | ✅       | Edit metadata + status                                                               | FE-13        | pawan       |
| Task / Milestone / Budget   | ✅        | ✅       | Done                                                                                 | —            | —           |
| Material Request            | ✅        | ✅       | Done                                                                                 | —            | —           |
| Tenant / SSO Settings       | ✅        | ✅       | Real API via `tenantApi` + Keycloak admin                                            | FE-16        | pawan       |
| GDPR DSR                    | ⚠️        | ⚠️       | Settings tab wired; fulfill = status flip only                                       | QA           | —           |
| Forecast Train              | ✅        | ✅       | Recharts panel on inventory + `/scm/forecast` global dashboard                       | FE-14        | pawan       |
| BI Custom Dashboard         | ✅ CRUD   | ✅       | Full workspace at `/bi`                                                              | —            | pawan       |
| Notifications (mark read)   | ✅        | ✅       | Click to mark read                                                                   | FE-15        | pawan       |

---

## 8. Assignment for 6 Team Slots

| Slot       | Assigned To | Focus area        | Open task IDs                                              | Layer               |
| ---------- | ----------- | ----------------- | ---------------------------------------------------------- | ------------------- |
| **Slot 1** | shraddha    | SCM — Vendor      | **All complete** (FE-01, FE-02)                            | Frontend            |
| **Slot 2** | sibi        | SCM — Catalog/Inv | **All complete** (FE-03, FE-04, FE-05)                     | Frontend            |
| **Slot 3** | Agrim       | Finance UI        | **All complete** (FE-06, FE-08)                            | Frontend            |
| **Slot 4** | pawan       | —                 | **All pawan tasks complete** (19 tasks incl. BE-08, BE-11) | Backend + Frontend  |
| **Slot 5** | Shreya      | Backend SCM + GL  | **All complete** (BE-01)                                   | Backend             |
| **Slot 6** | —           | QA, E2E & DevOps  | INT-03, INT-06, INT-08, PLAT-01–PLAT-04                    | Full-stack / DevOps |

### Completed by pawan (19 tasks)

| Task   | Evidence                                                                                                                                                                                                          |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-07  | `finance/journal-entries/page.tsx` → `financeApi`                                                                                                                                                                 |
| FE-09  | `finance/ar-invoices/page.tsx` + AR API endpoints                                                                                                                                                                 |
| FE-10  | `hr/payroll/payslip-modal.tsx`                                                                                                                                                                                    |
| FE-11  | `hr/employees/page.tsx`                                                                                                                                                                                           |
| FE-12  | `hr/departments/page.tsx`                                                                                                                                                                                         |
| FE-13  | `projects/[id]/page.tsx` + `PATCH /pm/projects/:id`                                                                                                                                                               |
| FE-15  | `notifications/page.tsx`                                                                                                                                                                                          |
| FE-16  | `tenant-api.ts`; login, create-tenant, settings migrated                                                                                                                                                          |
| FE-17  | Mock imports removed; `@/lib/mock/*` unused                                                                                                                                                                       |
| FE-18  | `hr/payroll/page.tsx` month picker                                                                                                                                                                                |
| BE-02  | `finance/sales/sales-order.service.ts` + Order-to-Cash flow                                                                                                                                                       |
| BE-03  | `finance/fiscal-periods/page.tsx` + `GET /finance/gl/fiscal-periods`                                                                                                                                              |
| BE-04  | `POST /finance/gl/intercompany-transfers` + GL journal pairing (implemented, not end-to-end verified — no test/script exists)                                                                                     |
| BE-05  | `InventoryCostLayer` on goods receipt + `consumeFifoCostLayers()` in `inventory.service.ts` for outbound ISSUE/TRANSFER — verified via live API (10@₹50 + 10@₹80 → issue 15 drains oldest layer first, cost ₹900) |
| BE-06  | `audit-event.listener.ts` — 25+ mutation events with hash chain                                                                                                                                                   |
| BE-09  | `apps/ml-service/main.py` + Dockerfile + forecast API fallback                                                                                                                                                    |
| BE-10  | `bi/` module — widget CRUD, drill-down, SSE, scheduled reports                                                                                                                                                    |
| BE-11  | `docs/rbac-role-matrix.md` — 26 controllers audited, role matrix                                                                                                                                                  |
| BE-08  | `vendor-portal/` module + `/vendor-portal` supplier UI                                                                                                                                                            |
| INT-01 | P2P E2E: low-stock PR → PO → GR → 3-way match → GL; `verify:p2p` script                                                                                                                                           |

**Also shipped (not in task table):** BI workspace UI — full Power BI-style builder:

| Layer                            | Files                                                                                                                                                                                                                                                                                | Capabilities                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Frontend** (`components/bi/`)  | `bi-workspace.tsx`, `visualization-pane.tsx`, `widget-chart.tsx`, `widget-config-schema.ts`, `power-bi-ribbon.tsx`, `advanced-charts.tsx`, `power-bi-visual.tsx`, `slicer-bar.tsx`, `drill-down-panel.tsx`, `drill-through-pane.tsx`, `grid-layout-wrapper.tsx`, `power-bi-theme.ts` | Drag-drop grid, 10+ chart types, slicers, cross-filter, drill-down/through, SSE live KPIs, scheduled reports drawer |
| **API client**                   | `lib/api/bi-api.ts`, `lib/types/bi.ts`                                                                                                                                                                                                                                               | REST + SSE subscriber with reconnect                                                                                |
| **Backend** (`apps/api/src/bi/`) | `bi.controller.ts`, `bi.service.ts`, `bi-data.service.ts`, `bi-report.service.ts`, `bi-report.scheduler.ts`                                                                                                                                                                          | Dashboard/widget CRUD, 6 live data sources, drill-down, PDF/Excel reports, cron scheduler                           |
| **Route**                        | `app/(dashboard)/bi/page.tsx`                                                                                                                                                                                                                                                        | Renders `<BiWorkspace />`                                                                                           |

---

## 9. Sprint Plan

| Sprint       | Priority | Task IDs                                      | Goal                                                         | Status                                                                      |
| ------------ | -------- | --------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| **Sprint 1** | P0       | FE-01, FE-06, FE-07, INT-01, PLAT-01, PLAT-02 | Demo-ready: vendor form, GL forms, P2P E2E, live URL + video | ⚠️ **4/6** (FE-01 ✅, FE-06 ✅, FE-07 ✅, INT-01 ✅; PLAT-01, PLAT-02 open) |
| **Sprint 2** | P1       | FE-03–FE-05, FE-08–FE-11, INT-02–INT-05       | SCM admin, AP OCR, AR, HR polish, PM bridges                 | ✅ **11/11** (FE-03–05, FE-08–11 ✅; INT-02–05 all verified E2E)            |
| **Sprint 3** | P2       | BE-02, FE-14, BE-06, PLAT-03, PLAT-04, BE-11  | Order-to-Cash, forecast, audit, CI + security, RBAC          | ⚠️ **4/6** (BE-02, BE-06, BE-11, FE-14 ✅; PLAT-03, PLAT-04 open)           |

**Sprint 1 blockers:** PLAT-01, PLAT-02 (live demo URL + video — the only remaining P0s).

**Recent wins (outside sprint scope):** BI builder (F-08, BE-10 + 12 FE components), finance/HR mock→API cleanup (FE-16, FE-17), ML service (BE-09), intercompany (BE-04), fiscal periods (BE-03).

### Priority order for remaining work

| #   | Task(s)                 | Why                                                             |
| --- | ----------------------- | --------------------------------------------------------------- |
| 1   | PLAT-01, PLAT-02        | Only remaining Sprint 1 P0s — demo submission (live URL, video) |
| 2   | BE-07, PLAT-03, PLAT-04 | Email delivery, CI pipeline, security hardening                 |

~~BE-05~~ — ✅ closed session 7 (outbound FIFO cost consumption, `consumeFifoCostLayers()` in `inventory.service.ts`).

~~FE-01, BE-01, FE-06, FE-03–FE-05, FE-08~~ — ✅ closed session 7 (vendor CRUD + phone schema, GL account form, product/inventory admin forms, AP OCR upload).

---

## 10. PM Decisions Required

| #   | Decision              | Option A                   | Option B                 | Impacts         | Owner  | Status                                            |
| --- | --------------------- | -------------------------- | ------------------------ | --------------- | ------ | ------------------------------------------------- |
| D1  | Vendor Phone/Rating   | Remove from UI             | Extend DB schema         | FE-02, BE-01    | Shreya | ✅ Decided — keep phone, remove rating            |
| D2  | Goods Receipt page    | Info-only (receive via PO) | Dedicated GR form        | SCM UX          | —      | GR form                                           |
| D3  | Order-to-Cash scope   | Skip for MVP               | Build Sales Order module | BE-02, INT-09   | —      | ✅ Decided — built (BE-02 + FE-09)                |
| D4  | Vendor portal / email | Defer to Phase 2           | Build now                | BE-07, BE-08    | —      | ✅ Portal built (BE-08); email still stub (BE-07) |
| D5  | BI dashboard builder  | KPI page only              | Drag-drop builder        | Large FE effort | —      | ✅ Decided — shipped (`bi-workspace.tsx`)         |

---

## 11. PDF Requirement → Task Mapping (F-01–F-12)

| PDF  | Description                             | Remaining          | Status                                                                                                                                                                                                |
| ---- | --------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F-01 | Multi-Tenant Auth / SSO                 | —                  | ✅ Done — Keycloak OIDC/SAML, `/auth/me`, realm roles, IdP UI (Google/Microsoft/GitHub/SAML/OIDC forms)                                                                                               |
| F-02 | GL — period close, intercompany         | BE-04 verification | ⚠️ Partial — BE-03 ✅, BE-04 implemented but not end-to-end verified ⚠️, journal UI ✅, GL account form ✅ (FE-06)                                                                                    |
| F-03 | AP/AR — OCR, payment runs               | —                  | ✅ Done — FE-09 ✅, aging report ✅, AP OCR upload UI ✅ (FE-08), AP payment run ✅ (`recordPayment()` + `runPaymentBatch()`, verified live)                                                          |
| F-04 | HR & Payroll Engine                     | —                  | ✅ Done — Employee CRUD ✅, leave/attendance ✅, payroll run ✅, payslip PDF ✅ (matches "HR & Payroll" area status)                                                                                  |
| F-05 | SCM — vendor portal, notify             | BE-07              | ⚠️ Partial (BE-08 portal ✅, vendor/product/inventory admin UI ✅ FE-01–FE-05; email delivery still stub)                                                                                             |
| F-06 | AI demand forecasting                   | —                  | ✅ Done — BE-09 ✅, ml-service ✅, FE-14 ✅ (Recharts panel + `/scm/forecast` global dashboard)                                                                                                       |
| F-07 | PM — Gantt, milestone alerts            | —                  | ✅ Done — FE-13 ✅, custom Gantt in `projects/tasks/page.tsx` ✅, milestone overdue alerts in `projects/milestones/page.tsx` ✅ (previous "Partial" note was stale — INT-02–04 were already ✅ in §5) |
| F-08 | BI — dashboard builder                  | —                  | ✅ Done (BE-10 + bi-workspace)                                                                                                                                                                        |
| F-09 | Audit & GDPR                            | GDPR export/erase  | ⚠️ Partial (BE-06 ✅, audit API live)                                                                                                                                                                 |
| F-10 | Notification engine                     | BE-07 (FE-15 ✅)   | ⚠️ Partial (in-app ✅; email stub)                                                                                                                                                                    |
| F-11 | API Gateway & Webhooks (REST + GraphQL) | GraphQL            | ⚠️ Partial — REST + OpenAPI ✅ (`/api-docs`), webhooks ✅ (HMAC); GraphQL not built (matches §13 Tech Stack)                                                                                          |
| F-12 | Offline / PWA Support                   | Everything         | ❌ Not started — no service worker, no offline cache, no PWA manifest found                                                                                                                           |
| §9   | Submission deliverables                 | PLAT-01, PLAT-02   | ❌ Open                                                                                                                                                                                               |

---

---

## 12. Codebase Inventory (4 July 2026)

| Item                     | Count | Location                                                                                                                                     |
| ------------------------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard routes         | 29    | `apps/web/src/app/(dashboard)/**/page.tsx` (incl. `/forecast` standalone)                                                                    |
| API modules              | 11    | `auth`, `tenant`, `finance`, `hr`, `scm`, `pm`, `bi`, `forecast`, `audit`, `notification`, `health`                                          |
| BI frontend components   | 12    | `apps/web/src/components/bi/`                                                                                                                |
| BI backend files         | 8     | `apps/api/src/bi/`                                                                                                                           |
| Settings components      | 1     | `apps/web/src/components/settings/idp-manager.tsx`                                                                                           |
| ML service               | 1     | `apps/ml-service/main.py` + `Dockerfile`                                                                                                     |
| Logger utility           | 1     | `apps/api/src/common/logger/amdox-logger.ts` (15 methods incl. `http` domain)                                                                |
| Logger documentation     | 1     | `docs/amdox-logger.md`                                                                                                                       |
| HTTP logging interceptor | 1     | `apps/api/src/common/interceptors/http-logging.interceptor.ts`                                                                               |
| Test suites              | 9     | `testing/suites/01–09` — 64 tests, 64/64 pass                                                                                                |
| Test helpers             | 3     | `testing/helpers/client.js`, `assert.js`, `runner.js`                                                                                        |
| Test results (artifacts) | 5+    | `testing/results/*.json` — timestamped JSON per run (no-token + 2× authenticated runs)                                                       |
| Terminal test log        | 1     | `testing/TERMINAL_TEST_LOG.md` — 11 diagnostic sections: Keycloak auth, route discovery, response inspection, GL chain debug, fix validation |
| Orphan mock files        | 3     | `lib/mock/hr.ts`, `it.ts`, `pm-v2.ts` (no imports; safe to delete)                                                                           |
| GitHub Actions CI        | 0     | No `.github/workflows/` directory                                                                                                            |

### Test Suite Coverage (Day 14 — AMX-ERP-2026-04)

Run: `cd testing && node run-all.js` · With token: `TEST_TOKEN=<jwt> node run-all.js`

| Suite           | File                         | Tests            | What it covers                                                                                                                                                                                          |
| --------------- | ---------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 Health       | `01-health.test.js`          | 6                | live/ready/db endpoints, 401 guard, 404 unknown route                                                                                                                                                   |
| 02 Finance GL   | `02-finance-gl.test.js`      | 7                | GL accounts (codes 1000/2000/4000), journal entries, **double-entry enforcement** (unbalanced → 400), fiscal periods, aging report                                                                      |
| 03 HR & Payroll | `03-hr-payroll.test.js`      | 9                | Employees, departments, `/leave/all-requests`, `/attendance/all`, `/hr/payroll?period=`, payroll fields, validation                                                                                     |
| 04 SCM          | `04-scm.test.js`             | 9                | Vendors, products (id/sku/name), POs, `/scm/inventory/warehouses`, reorder rules, `/finance/ap/invoices`, PO validation                                                                                 |
| 05 PM           | `05-pm.test.js`              | 8                | Projects, `/pm/projects/tasks`, `/pm/projects/:id/milestones` (dynamic), `/pm/resources`, budgets (plannedAmount/actualAmount), `/scm/requisitions`                                                     |
| 06 AI Forecast  | `06-forecast.test.js`        | 6                | All-SKU forecast list, MAPE ≤ 12% assertion, per-product predictions, train endpoint, ML service health                                                                                                 |
| 07 Auth/RBAC    | `07-auth-rbac.test.js`       | 6                | /auth/me fields, `roles` array non-empty, tenantId present, **tenant isolation breach detection**, SuperAdmin RBAC                                                                                      |
| 08 Smoke P2P    | `08-smoke-p2p-chain.test.js` | 8                | **Day 14 cross-module chain:** auto-create product+GL accounts if missing → PO create → PATCH approve → GR → PO status RECEIVED → AP invoice auto-created → POST approve → GL journal posted + balanced |
| 09 Audit        | `09-audit.test.js`           | 5                | `/audit/logs` fields (`action`, `hash`), **hash chain integrity**, `/gdpr/requests`, notifications                                                                                                      |
| **Total**       |                              | **64 / 64 pass** |                                                                                                                                                                                                         |

### Key stubs still in code

| File                                     | Line | Issue                                                          |
| ---------------------------------------- | ---- | -------------------------------------------------------------- |
| `scm/inventory/page.tsx`                 | —    | Raise PR → `POST /scm/requisitions/from-low-stock` (INT-01 ✅) |
| `notification/channels/email.channel.ts` | —    | Log-only stub (inherits BE-07, still open)                     |

**Resolved session 7:** `scm/vendors/page.tsx` (`handleAddVendor` console.log stub → CRUD modal), `finance/accounts/page.tsx` ("New Account" button → modal wired to `POST /finance/gl/accounts`), `finance/invoices/page.tsx` (upload UI wired to `financeApi.uploadInvoice`, field-name mismatch `file`→`document` fixed to match backend `FileInterceptor('document')`).

---

_Update this document when a task moves from Partial → Done. Cross-reference_ `docs/project_status.md` _for detailed PDF requirement mapping._

---

## 13. Tech Stack — PDF Requirement vs. Actual Implementation

> Source: §3 "Technology Stack – Production Grade 2026" from `docs/Amdox Web.pdf`

| Category                 | PDF Requirement                                | Actual in Repo                                                                                           | Match                                                                                                                                                                                     |
| ------------------------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend Framework**   | Next.js 15 + React 19 + TypeScript 5.5         | Next.js 15 + React 19 + TypeScript                                                                       | ✅ Full match                                                                                                                                                                             |
| **UI Component Library** | shadcn/ui + Radix + Tailwind CSS 4             | Tailwind CSS 4 + custom design system (`globals.css` tokens, `shadow-card`, `page-title`)                | ⚠️ Tailwind ✅; shadcn/Radix not adopted — custom components used instead                                                                                                                 |
| **State Management**     | Zustand + React Query (TanStack v5)            | React `useState`/`useEffect` + direct `fetch` via `apiClient`                                            | ⚠️ No Zustand/React Query — local state only; sufficient for current scope                                                                                                                |
| **Data Visualisation**   | Recharts + ECharts + D3.js                     | Recharts (`BarChart`, `ResponsiveContainer`) + ECharts (`echarts-for-react`)                             | ⚠️ Recharts ✅ (forecast, BI widgets); ECharts ✅ (`widget-chart.tsx`/`advanced-charts.tsx` — heatmap/funnel/scatter/treemap/waterfall/gauge, wired into `bi-workspace.tsx`); D3 not used |
| **Backend Runtime**      | Node.js 22 LTS + TypeScript 5.5                | Node.js 24 + TypeScript (NestJS)                                                                         | ✅ Meets requirement (24 > 22 LTS)                                                                                                                                                        |
| **API Framework**        | NestJS 11 (modular monolith)                   | NestJS 11 — Auth, Finance, HR, SCM, PM, BI, Forecast, Audit, Notification modules                        | ✅ Full match                                                                                                                                                                             |
| **API Protocols**        | REST (OpenAPI 3.1) + GraphQL (Apollo v4)       | REST + OpenAPI via Swagger (`/api-docs`, `openapi-spec.json`); GraphQL not implemented                   | ⚠️ REST ✅; GraphQL not built                                                                                                                                                             |
| **Primary Database**     | PostgreSQL 17 + Prisma ORM                     | PostgreSQL + Prisma ORM (`packages/db`)                                                                  | ✅ Full match                                                                                                                                                                             |
| **Time-Series DB**       | TimescaleDB (extension)                        | Not implemented                                                                                          | ❌ Missing — audit logs in standard Postgres                                                                                                                                              |
| **Cache & Session**      | Redis 8 (Dragonfly-compatible) + ioredis       | Redis via BullMQ (`@nestjs/bullmq`); ioredis configured                                                  | ✅ Redis used for job queues; session store not explicitly wired                                                                                                                          |
| **Message Queue**        | BullMQ (Redis-backed)                          | BullMQ — `scm-events` queue (SCM), payroll processor queue                                               | ✅ Full match                                                                                                                                                                             |
| **AI / ML Services**     | Python 3.13 + FastAPI + scikit-learn + Prophet | Python FastAPI (`apps/ml-service/main.py`) + Prophet + statistical fallback                              | ✅ Full match                                                                                                                                                                             |
| **Search**               | Elasticsearch 8.15 / OpenSearch                | Not implemented                                                                                          | ❌ Missing — no full-text search                                                                                                                                                          |
| **File Storage**         | AWS S3 + CloudFront (or MinIO)                 | Not implemented                                                                                          | ❌ Missing — invoice attachments/payslip storage not wired                                                                                                                                |
| **Authentication**       | Keycloak 25 (OIDC/SAML) + JWT (RS256)          | Keycloak OIDC + `passport-jwt`; `keycloak.strategy.ts`; realm-per-tenant                                 | ✅ Full match                                                                                                                                                                             |
| **Email Delivery**       | AWS SES + Resend fallback                      | Log-only stub in `email.channel.ts` (BE-07 open)                                                         | ❌ Not implemented                                                                                                                                                                        |
| **Containerisation**     | Docker 27 multi-stage + Distroless base        | `Dockerfile` in `apps/ml-service/`; API/web Dockerfiles not confirmed                                    | ⚠️ ML service ✅; main services Dockerfile status unknown                                                                                                                                 |
| **Orchestration**        | Kubernetes 1.31 + Helm 3 charts                | Not implemented                                                                                          | ❌ Missing                                                                                                                                                                                |
| **CI/CD**                | GitHub Actions + ArgoCD                        | No `.github/workflows/` directory (PLAT-03 open)                                                         | ❌ Missing                                                                                                                                                                                |
| **Observability**        | OpenTelemetry + Prometheus + Grafana + Loki    | AmdoxLogger (custom 256-color terminal logger); `nestjs-pino` for structured logs; no Prometheus/Grafana | ⚠️ Logging ✅; metrics/tracing/dashboards missing                                                                                                                                         |
| **Security Scanning**    | Trivy + Snyk + OWASP ZAP                       | Not configured                                                                                           | ❌ Missing                                                                                                                                                                                |
| **Testing**              | Vitest + Playwright + k6 + Jest                | Custom ESM functional test runner (`testing/` — 9 suites, 64 tests); no Vitest/Playwright/k6             | ⚠️ Functional tests ✅; unit/E2E/load testing framework not set up                                                                                                                        |
| **IaC**                  | Terraform 1.9 + Terragrunt                     | Not implemented                                                                                          | ❌ Missing                                                                                                                                                                                |

### Match Summary

| Status        | Count | Categories                                                                                                         |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| ✅ Full match | 8     | Frontend, Backend runtime, NestJS, PostgreSQL+Prisma, BullMQ, ML service, Keycloak auth, Redis                     |
| ⚠️ Partial    | 6     | UI library, state management, data viz, REST (no GraphQL), observability (logging only), testing (functional only) |
| ❌ Missing    | 8     | TimescaleDB, Elasticsearch, S3 file storage, email delivery, K8s, CI/CD, security scanning, IaC                    |

**Overall tech stack match: ~55% (14/22 categories fully or partially met)**

> **Note:** Missing items (K8s, Terraform, Elasticsearch, TimescaleDB, CI/CD) are infrastructure/DevOps scope — they fall under PLAT-01–PLAT-05 and are expected post-MVP. Core application tech (NestJS, Prisma, Keycloak, BullMQ, Prophet ML, Recharts) is fully aligned with the PDF specification.

---

## 4. Granular 28-Day Execution Plan

### Week 1 – Foundation, Architecture & Authentication

#### Day 1 – Discovery & Planning

• Stakeholder requirements workshop (finance, HR, supply chain, IT)
• Competitor analysis matrix: SAP S/4HANA, Oracle NetSuite, Microsoft Dynamics 365, Odoo 17
• User story mapping + acceptance criteria in Notion / Jira
• Define MVP feature scope and de-scope list

> No repo artifact for this day — workshop/planning activities, not verifiable in code.

#### Day 2 – Architecture Design

• C4 diagrams: Context ✅ (`docs/c4/context.md`), Container ✅ (`docs/c4/container.md`), Component ✅ (`docs/c4/component.md`) (Excalidraw / Structurizr)
• Database ERD: Tenant ✅, User ✅, Role ✅, Account ✅, Transaction 🔄 {`JournalLine` — per-account debit/credit line tied to a `JournalEntry`}, JournalEntry ✅, Employee ✅, PurchaseOrder ✅, InventoryItem 🔄 {`Product` + `StockLevel`}, Notification ✅ (`docs/erd/database-erd.md` + `packages/db/prisma/schema.prisma`)
• API contract design (OpenAPI 3.1 spec skeleton) ✅ (`apps/api/openapi-spec.json`, auto-generated by `main.ts`)
• Decide on monorepo structure (Turborepo + pnpm workspaces) ✅ (`turbo.json`, `pnpm-workspace.yaml`)

#### Day 3 – Repository & DevOps Skeleton

• Turborepo monorepo: apps/web ✅, apps/api ✅, apps/ml-service ✅, packages/ui ✅, packages/db ✅ (all present)
• ESLint ✅ (flat configs added: `apps/web/eslint.config.mjs` — Next 15, `apps/api/eslint.config.mjs` — typescript-eslint/NestJS) + Prettier ✅ (`.prettierrc.json` root + web override for quote style) + Husky ✅ (`.husky/pre-commit`, `.husky/commit-msg`) + lint-staged ✅ (`.lintstagedrc.json`, blocks commit on lint error) + commitlint ✅ (`commitlint.config.js`, conventional commits) — closed session 8
• Docker Compose local dev stack: Postgres ✅, Redis ✅, Keycloak ✅, Elasticsearch ✅ (all in `infra/docker/docker-compose.yml`)
• .env.example ✅ (root + `packages/db/.env.example`) + secret management strategy (Vault / AWS Secrets Manager) ❌ (plain `.env` only)

#### Day 4 – Authentication & Multi-Tenancy

• Keycloak realm setup: OIDC configuration ✅, SAML adapter ✅ — `idp-manager.tsx` builds a real Keycloak SAML config → `POST /tenant/identity-providers` → `tenantService.createIdentityProvider()` → `kcAdminClient.identityProviders.create()`; **live-tested end-to-end** via a real external-IdP SAML SSO round-trip (signed AuthnRequest → login → signed SAMLResponse → broker validation → OIDC token, no browser, documented in `testing/SAML_SSO_TEST_LOG.md`), which caught and fixed a real bug in the process: `identityProviders.create({realm}, provider)` was called with two arguments but the client library only accepts one, silently dropping the provider config for **every** IdP type (Google/Microsoft/GitHub/SAML/OIDC), not just SAML — fixed to `identityProviders.create({realm, ...provider})`; realm-per-tenant strategy ✅ (`docs/adr/003-realm-per-tenant-isolation.md`, `createTenant()`)
• NestJS auth module: passport-jwt ✅ (`auth/strategies/keycloak.strategy.ts`), RBAC guard ✅ (`auth/guards/roles.guard.ts`), tenant context middleware ✅ (`common/middleware/tenant-context.middleware.ts`)
• User table + TenantUser join with roles (SuperAdmin ✅, TenantAdmin ✅, Manager ✅, Viewer ✅) — modelled as `User`/`UserRole`/`Role`, all 4 roles seeded in `prisma/seed.ts`
• Refresh token rotation + blacklist (Redis SET) ✅ (`RefreshToken` model + `blacklist:${token}` key in `auth.controller.ts`)

#### Day 5 – Core Domain Models & Database

• Prisma schema: all core entities with indexes ✅, soft-delete ✅ (`deletedAt`), created_at/updated_at ✅ — consistent pattern across all models
• Row-level security strategy: tenantId filter injected at query layer ✅ (`packages/db/src/client.ts` — `$extends` auto-injects `tenantId`)
• Database migrations pipeline ✅ (`prisma/migrations/` — 15+ migrations) + seeder scripts ✅ (`prisma/seed.ts`)
• Prisma Studio setup for internal dev inspection ✅ — documented in `README.md` § "Database Management & Tools" → "Visual Database Browser (Prisma Studio)" with the exact command (`npx pnpm --filter @amdox/db exec prisma studio`) and access URL (`localhost:5555`); no root-level `pnpm studio` script alias, but the capability is set up and documented for the dev team

#### Day 6 – API Gateway & Base Endpoints

• NestJS app bootstrap: global exception filters ✅ — added session 9 (`common/filters/all-exceptions.filter.ts`, registered via `APP_FILTER` in `app.module.ts`): every error produces a consistent `{statusCode, message, error, path, timestamp}` JSON shape; raw non-HttpException errors are masked to a generic message in production (real message shown in dev); verified live against all 4 real cases (404 routing, 401 auth, 400 validation array, service `NotFoundException`, raw unhandled `Error`), validation pipe (class-validator) ✅ (`main.ts` — `ValidationPipe({ whitelist: true })`), interceptors ✅ (`HttpLoggingInterceptor` + `TenantContextInterceptor` in `app.module.ts`)
• Health check endpoints: /health/live ✅, /health/ready ✅, /health/db ✅ (`health/health.controller.ts`)
• OpenAPI swagger UI served at /api-docs ✅ (`main.ts` — `SwaggerModule.setup('api-docs', ...)`)
• Postman collection auto-generated from OpenAPI spec ✅ — `openapi-spec.json` auto-generates on every boot; `pnpm postman` → `openapi2postmanv2` (fixed session 9: the script called the npm package name `openapi-to-postmanv2`, but the actual CLI binary the package ships is `openapi2postmanv2` — always failed regardless of whether the package was installed); verified end-to-end: generates a real 149-request, 18-folder collection from the live spec; `docs/Amdox-ERP-HR-Postman-Collection.json` remains a separate static, manually-scoped HR-only collection

#### Day 7 – Week 1 Review & Demo

• Internal demo: auth flow, multi-tenant isolation, API docs
• Fix any schema or auth edge cases
• Write ADRs (Architecture Decision Records) for key choices ⚠️ Partial — only 1 exists (`docs/adr/003-realm-per-tenant-isolation.md`)

> First two items are workshop/QA activities — no standalone repo artifact.

### Week 2 – Finance, HR & Supply Chain Modules

#### Day 8–9 – Financial Ledger & AP/AR

• General Ledger: chart of accounts ✅, journal entries ✅, double-entry validation ✅ (`gl.service.ts`; Suite 02 asserts unbalanced entries → 400)
• Multi-currency support: ECB daily FX fetch ✅ (`fx-rate.service.ts` — real HTTP call to ECB's free `eurofxref-daily.xml` feed, parsed and stored as `EUR → X` `ExchangeRate` rows per tenant, upserted so re-runs don't duplicate; verified live — 29 real currencies stored for all 3 tenants) + historical rates ✅ (`asOfDate` column, unique per tenant/currency-pair/day, accumulates a real history on each daily run)
• AP module: invoice creation ✅, 3-way PO/GR/Invoice matching ✅ (`invoice-matching.service.ts`), payment run logic ✅ — `ApService.recordPayment()` (single, mirrors AR) + `runPaymentBatch()` (batch, creates a real `PaymentRun` header, pays each selected invoice's outstanding balance, continues past per-invoice failures); `payment.made` GL listener posts Dr 2000 AP Payable / Cr 1000 Cash; audit event added; verified live — partial→full single payment, batch run against 2 invoices, GL entries and audit trail all correct
• AR module: customer invoicing ✅, payment recording ✅, aging report query ✅ (`ar.service.ts`)
• Period close locking mechanism with role-based override ✅ (`isLocked` field + `closeFiscalPeriod()`, `@Roles('TenantAdmin')`)

#### Day 10 – HR Core & Employee Lifecycle

• Employee CRUD: personal info ✅, employment contract ✅ (`EmploymentContract` model), department ✅, reporting hierarchy ✅ (`Employee.managerId` self-relation)
• Organisational chart (recursive CTE query in Postgres) 🔄 {`hr/employees/org-chart.tsx` — client-side tree built from `Employee.reportsToId`, rendered as nested boxes with connector lines, wired into `hr/employees/page.tsx` via a list/org-chart view toggle; not a Postgres recursive CTE, but the visual org chart works}
• Leave management: leave types ✅, accrual rules ✅ (`LeaveBalance`), approval workflow (state machine) ✅ (`hr/leave/leave-state-machine.ts`)
• Attendance module: clock-in/out API ✅ (`hr/attendance/attendance.controller.ts`), overtime calculation ✅ (`attendance.service.ts`)

#### Day 11 – Payroll Engine

• Gross-to-net payroll calculation engine (configurable tax slabs, statutory deductions) ✅ (`hr/payroll/tax-slab.service.ts`)
• Payroll run: batch processing via BullMQ (async, retry-safe) ✅ (`hr/payroll/payroll.processor.ts`)
• Payslip PDF generation (Puppeteer / pdfkit) ✅ (`hr/payroll/payslip-generator.ts` — uses `pdfkit`)
• Audit trail for every payroll mutation ✅ (`payroll.completed` event in `audit-event.listener.ts`)

#### Day 12–13 – Supply Chain & Inventory

• Purchase requisition → PO → goods receipt workflow ✅ (`requisition.service.ts` → `purchase.service.ts`)
• Vendor master data management ✅ (`vendor.service.ts`) + vendor portal API ✅ (`scm/vendor-portal/`)
• Inventory: real-time stock levels ✅ (`StockLevel`), FIFO costing ✅ (`consumeFifoCostLayers()` in `inventory.service.ts`, BE-05), warehouse locations ✅ (`Warehouse.location`)
• Reorder point automation: trigger PO draft when stock < threshold ✅ (`scm/automation/reorder.service.ts`)
• Supplier email notification via BullMQ ✅ (`scm-events` queue) + AWS SES ❌ (`email.channel.ts` is a log-only stub — BE-07)

#### Day 14 – Integration Testing & Bug Fixes

• Integration tests for all Week 2 modules (Vitest + Supertest) 🔄 {custom ESM test runner in `testing/` — 9 suites, 64 tests, not Vitest/Supertest}
• Database query optimisation (EXPLAIN ANALYZE on critical queries) ✅ (`testing/QUERY_OPTIMISATION_AUDIT.md` — audited all 58 models against real service queries, seeded ~80k rows, verified 8 missing composite indexes with real `EXPLAIN ANALYZE` before/after — e.g. AuditLog 6.26ms→0.22ms, Invoice 2.56ms→0.28ms; migration `20260706120000_query_optimisation_indexes`)
• Cross-module smoke test: PO → inventory → AP invoice → GL journal entry ✅ (`testing/suites/08-smoke-p2p-chain.test.js`)

### Week 3 – AI/ML, BI Dashboard, Security & Notifications

#### Day 15–16 – AI Demand Forecasting Microservice

• Python FastAPI ML service: /train ✅, /predict ✅, /health ✅ endpoints (`apps/ml-service/main.py`)
• Prophet model for time-series SKU demand forecasting ✅ (`main.py` — `from prophet import Prophet`)
• LSTM model (PyTorch) as secondary model for high-volume SKUs ✅ — `main.py` trains a small `nn.LSTM` per SKU when history ≥60 points and total volume ≥500 units, else stays on Prophet; also fixed a bug this required: `ForecastModel` had no `productId` (one shared "active model" row per _tenant_), so every SKU's model type/MAPE collapsed into whichever was trained last — added `productId` (migration `20260706140000_forecast_model_product_scope`), verified live with two real products (`FORECAST-HIVOL` → LSTM, `FORECAST-LOVOL` → Prophet, correctly independent)
• Model versioning with MLflow (or simple file-based versioning) ✅ — file-based per PDF's explicit alternative: `main.py` writes `model_registry/{sku}/v{n}/{metadata.json, model.pt}` on every train, versions increment per SKU, `GET /models/{sku}/versions` lists history; persisted via a named Docker volume (`ml-model-registry`) so versions survive container restarts (verified)
• Weekly retraining job scheduled via BullMQ + Redis cron ✅ — `forecast-retrain.processor.ts`: `ForecastRetrainScheduler` registers a repeatable BullMQ job (cron `0 0 * * 0`, idempotent stable `jobId` so restarts don't duplicate it), `ForecastRetrainProcessor` loops every tenant and retrains all products with stock-movement history; verified live by manually enqueuing a job and confirming it reached BullMQ's `completed` set and bumped real `ForecastModel.trainedAt` rows
• NestJS forecasting module: consume ML service ✅ (`forecast/forecast.service.ts`), cache predictions in Redis ✅ — `getPredictions()` caches per tenant+product (6h TTL via existing `RedisService`), invalidated on retrain; verified live (key exists with correct TTL after a read, gone immediately after retrain)

#### Day 17 – Business Intelligence Dashboard

• Dashboard builder backend: widget configuration stored as JSON in Postgres ✅ (`Widget.config Json` field)
• Recharts ✅ + ECharts ✅ React components: bar ✅, line ✅, pie ✅, heatmap ✅, funnel ✅ (`echarts-for-react` wired into `widget-chart.tsx`/`advanced-charts.tsx`, rendered via `bi-workspace.tsx`; heatmap/funnel/scatter/treemap/waterfall/gauge on ECharts, bar/line/pie on Recharts)
• Drill-down: click chart segment → filtered data table ✅ (`components/bi/drill-down-panel.tsx`)
• Scheduled report job: generate PDF ✅ / Excel ✅ (real `.xlsx` via `exceljs` — `bi-report.service.ts`, verified live: created report, ran it, downloaded, confirmed `Microsoft Excel 2007+` file with 2 real worksheets) + email delivery ❌ (channel wired to `EmailChannel.send()` but that channel is still a log-only stub — BE-07, needs real AWS SES credentials)
• Real-time metric refresh via Server-Sent Events (SSE) ✅ (`bi.controller.ts` — `@Sse('metrics/stream')`)

#### Day 18 – Project Management Module

• Project CRUD: milestones ✅, tasks ✅, dependencies (DAG validation) ✅ (`pm/project/project.service.ts`)
• Gantt chart rendering (react-gantt or custom D3 implementation) ✅ — custom implementation in `projects/tasks/page.tsx`: date-range header, per-task horizontal bars positioned by start/end date (CSS grid + absolute position), status-colored legend, dependency labels ("after X")
• Resource allocation: assign employees to tasks ✅, utilisation heatmap ✅ (`projects/resources/page.tsx`)
• Budget tracking: planned vs actual with variance alerts ✅ (`plannedAmount`/`actualAmount` fields + budget page); milestone alerts ✅ — dedicated `projects/milestones/page.tsx` (overdue tracking, "Overdue — action required" banners, badge counts) + overview page overdue badges

#### Day 19 – Notification & Event Engine

• Event bus: domain events emitted via NestJS EventEmitter2 ✅ (used across product/payroll/invoice events)
• Notification service: in-app (SSE / Socket.io) ❌ (stored + polled via `/notifications`, not push), email (SES) ❌ (stub), webhook (signed HMAC) ✅ (`notification/channels/webhook.channel.ts` — HMAC-SHA256)
• User notification preferences per channel and event type ✅ (`NotificationPreference` model)
• BullMQ dead-letter queue + retry dashboard (Bull Board UI) ❌ (neither found)

#### Day 20 – Security Hardening

• OWASP Top 10 checklist: CSRF ❌, XSS (DOMPurify ❌ + CSP headers ❌), IDOR checks ⚠️ (tenantId auto-scoping in `client.ts` acts as a de facto guard, no explicit IDOR test suite)
• Helmet.js: HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy ❌ (not installed)
• Rate limiting: redis-based sliding window (nestjs-throttler) ❌
• Input validation: class-validator on all DTOs ✅ (`main.ts` — global `ValidationPipe`); Zod on frontend forms ❌
• Secrets rotation plan + no committed secrets audit (trufflehog scan) ❌
• Trivy container scan + Snyk dependency audit integrated in CI ❌ (no CI pipeline exists — PLAT-03)

#### Day 21 – Performance & Load Testing

• k6 load test: 2,000 concurrent virtual users, 10-minute steady state ❌
• Identify bottlenecks: N+1 queries, missing indexes, Redis cache gaps ⚠️ (N+1 in `ap.service.ts` `createPaymentRun()` found + fixed — one `findMany` instead of a per-invoice loop; missing indexes found + fixed (8 composite indexes, see Day 14 above); Redis cache gaps ❌ not addressed)
• Postgres read replicas strategy for BI/reporting queries ❌
• React frontend: Lighthouse score >= 90 (performance, accessibility) ❌ (not run/recorded)
• Bundle analysis: webpack-bundle-analyzer, code splitting strategy ❌

> Bottleneck identification (N+1 + missing indexes) done as part of the Day 14 query optimisation pass; the rest of this day's items (k6 load test, read replicas, Lighthouse, bundle analysis) were not found in the repo.

### Week 4 – Deployment, Observability & Final Polish

#### Day 22 – Containerisation

• Multi-stage Dockerfiles for all services (Distroless final stage) ❌ (`infra/docker/Dockerfile.api`, `Dockerfile.web`, and `Dockerfile.ml` are all 0-byte empty files/dead duplicates; the real ML Dockerfile lives at `apps/ml-service/Dockerfile`, single-stage `python:3.11-slim`, not distroless)
• docker-compose.prod.yml with health checks and resource limits ❌ (file exists but is empty)
• Container image scanning with Trivy in CI pipeline ❌
• .dockerignore optimisation for minimal build context ✅ (root `.dockerignore` — excludes `node_modules/`, `.next/`, `dist/`, `.turbo/`)

#### Day 23 – Kubernetes Manifests & Helm Charts

• Helm chart: Deployment, Service, ConfigMap, Secret (Sealed Secrets), Ingress, HPA, PDB ❌
• Istio virtual services + destination rules for canary deployment ❌
• Namespace isolation per environment (dev / staging / prod) ❌
• minikube / kind local cluster validation ❌

> Nothing in this day was found — PLAT-05, explicitly post-MVP scope.

#### Day 24 – CI/CD Pipeline

• GitHub Actions matrix: lint → unit test → integration test → build → docker push → deploy ❌
• ArgoCD application manifest for GitOps continuous delivery ❌
• Smoke test suite triggered post-deployment ❌
• Slack notifications for pipeline success/failure ❌

> No `.github/workflows/` directory exists at all — PLAT-03 open.

#### Day 25 – Cloud Deployment

• Frontend: Vercel (Next.js) or AWS CloudFront + S3 ❌
• Backend: AWS EKS / Railway / Fly.io (staging first, then prod) ❌
• Postgres: RDS Aurora Serverless v2 / Supabase ❌
• Redis: ElastiCache / Upstash ❌
• Custom domain + Let's Encrypt TLS (cert-manager) ❌
• DNS / CDN configuration + WAF rules ❌

> Nothing deployed — PLAT-01 open, no live demo URL.

#### Day 26 – Observability Stack

• OpenTelemetry SDK instrumentation (traces, metrics, logs) across all services ❌
• Prometheus scrape configs + Grafana dashboards (latency, error rate, saturation) ❌
• Loki log aggregation + Grafana log explorer ❌
• PagerDuty / OpsGenie alerting for SLA breaches ❌
• Distributed trace sampling: 100% errors, 10% success ❌

> Structured logging exists instead (`AmdoxLogger` + `nestjs-pino`), but none of this day's specific tools are wired up.

#### Day 27 – Demo Video & Documentation

• Record 5–7 min scenario-based demo (multi-user, multi-module walkthrough) ❌ (no video — PLAT-02 open)
• Architecture diagram screenshot + deployment topology diagram ⚠️ (C4 diagrams exist as markdown in `docs/c4/`, plus `docs/erd/Data_Processing_and_Model.png`; no dedicated deployment topology diagram)
• README.md: local setup ✅, env vars ✅, architecture ⚠️ (brief), screenshots ❌, video link ❌ (`README.md`, 178 lines)
• Export project report to PDF (this document) ✅ (`docs/Amdox Web.pdf` — the source spec itself)

#### Day 28 – Final QA & Submission

• Cross-browser QA: Chrome, Firefox, Safari, Edge ❌
• Mobile responsive validation (375px, 768px, 1440px breakpoints) ❌
• Accessibility audit: ARIA labels, keyboard nav, colour contrast (WCAG 2.1 AA) ❌
• Final Lighthouse + k6 report screenshots ❌
• Submission package: PDF report ✅, GitHub repo ✅, live demo URL ❌, demo video ❌

> Submission is incomplete — PLAT-01/PLAT-02 remain the two hard blockers.
