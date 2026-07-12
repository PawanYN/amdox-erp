# Frontend–Backend Wiring & Testing Plan

> **Purpose:** Verify every module is correctly wired between the web app and API, and establish a repeatable testing strategy.  
> **Last updated:** 2026-07-10  
> **Branch context:** `feat/complete-pdf-gaps` (includes `/api/v1` prefix, GraphQL, search, GDPR, HR compliance)  
> **Phase 1:** ✅ Complete — see [`docs/wiring-audit.md`](./wiring-audit.md)  
> **Phase 2:** ✅ Complete — P0-1…P0-5 fixed (2026-07-10)  
> **Phase 3:** ✅ Complete — P1-1…P1-6 stub/partial UI wired (2026-07-10)  
> **Phase 4:** ✅ Complete — backend-only features wired (2026-07-10)  
> **Phase 5:** ✅ Complete — 9 suites, 64/64 pass with `admin@companya.in` (2026-07-10)  
> **Phase 7:** 🔄 In progress — see [`docs/phase7-e2e-log.md`](./phase7-e2e-log.md)

---

## Current State (Summary)

| Layer                | Status                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------- |
| **Frontend ↔ API**   | ~98% wired — sales orders, intercompany, AP payments, GraphQL stats, reorder automation |
| **Remaining gaps**   | Settings General (no save), PO New button, minor UX polish                              |
| **Backend-only**     | None critical — all Phase 4 routes have UI                                              |
| **Unit/e2e tests**   | **None** (0 `*.spec.ts` / `*.test.ts` files)                                            |
| **Functional tests** | 9 JS suites — **64/64 pass** locally (`node run-authenticated.js`); not yet in CI       |
| **CI**               | Lint, typecheck, build, security scans only — **no API or UI tests**                    |
| **Wiring audit**     | ✅ [`docs/wiring-audit.md`](./wiring-audit.md) — Phase 4 updates applied                |

### Module wiring at a glance

| Module        | Overall | Notes                                                                |
| ------------- | ------- | -------------------------------------------------------------------- |
| Finance       | WIRED   | Sales orders + intercompany + AP payments (Phase 4)                  |
| HR            | WIRED\* | Leave `getMe()` + roles + reject; employees filter quirks            |
| SCM           | WIRED\* | Goods-receipt + reorder automation (P1/P4); PO New button still dead |
| Projects      | WIRED\* | Milestone due-date edit (P4); tasks lack create UI on tasks page     |
| BI            | WIRED   | `getDataBySource` fallback in widget loader (P4)                     |
| Forecast      | WIRED   | `/forecast` and `/scm/forecast`                                      |
| Settings      | WIRED\* | Audit verify + GDPR consent; General tab still no save               |
| Notifications | WIRED   | List, prefs, SSE, header bell                                        |
| Vendor Portal | WIRED   | Profile + shared `/api/v1` base                                      |
| Search        | WIRED   | Global search modal                                                  |

---

## Phase 1 — Wiring Audit Matrix (1 day) ✅ COMPLETE (2026-07-10)

> **Deliverable:** [`docs/wiring-audit.md`](./wiring-audit.md) — living checklist (page ↔ client ↔ backend).  
> **Result:** 26 ✅ / 12 ⚠️ / 3 ❌ across all dashboard modules. P0/P1 findings confirmed and linked to Phases 2–3.

### 1.1 Create `docs/wiring-audit.md` (living checklist) ✅

Full matrix lives in [`docs/wiring-audit.md`](./wiring-audit.md). Snapshot of critical rows:

| Module        | Page / Feature                               | API client                                      | Backend route                               | Status | Notes                                                   |
| ------------- | -------------------------------------------- | ----------------------------------------------- | ------------------------------------------- | ------ | ------------------------------------------------------- |
| Finance       | Chart of Accounts                            | `financeApi.getAccounts` + `getAccountBalances` | `GET …/accounts`, `GET …/accounts/balances` | ✅     | Live posted JE balances (P0-4)                          |
| Finance       | Journal Entries                              | `financeApi`                                    | `POST/GET .../journal-entries`              | ✅     |                                                         |
| Finance       | Fiscal Periods                               | `financeApi`                                    | `GET/POST .../fiscal-periods`               | ✅     |                                                         |
| Finance       | AP Invoices                                  | `financeApi`                                    | `GET/POST .../ap/invoices`                  | ⚠️     | OCR wired; vendor name shows ID                         |
| Finance       | AR Invoices                                  | `financeApi`                                    | `GET/POST .../ar/invoices`                  | ✅     |                                                         |
| Finance       | Aging Report                                 | `financeApi`                                    | `GET .../ar/aging-report`                   | ✅     |                                                         |
| HR            | Employees                                    | `hrApi`                                         | `GET/POST .../employees`                    | ⚠️     | Hides `EMP-100`; default DOB                            |
| HR            | Org Chart                                    | `hrApi`                                         | `GET .../employees`                         | ✅     |                                                         |
| HR            | Departments                                  | `hrApi`                                         | `GET/POST .../departments`                  | ✅     |                                                         |
| HR            | Leave Requests                               | `hrApi` (`getMe`, leave APIs)                   | `GET/PATCH .../leave/*`                     | ✅     | `getMe()` + roles (P0-5); `reject` route (P1-6)         |
| HR            | Attendance                                   | `hrApi`                                         | `GET/POST .../attendance/*`                 | ✅     |                                                         |
| HR            | Compliance                                   | `hrApi`                                         | `GET/PATCH .../hr/compliance/*`             | ✅     |                                                         |
| HR            | Payroll                                      | `hrApi`                                         | `GET/POST .../hr/payroll/*`                 | ✅     |                                                         |
| SCM           | Vendors                                      | `scmApi`                                        | `GET/POST .../scm/vendors`                  | ✅     |                                                         |
| SCM           | Products                                     | `scmApi`                                        | `GET/POST .../scm/products`                 | ✅     |                                                         |
| SCM           | Purchase Orders                              | `scmApi`                                        | `GET/POST .../scm/purchase-orders`          | ⚠️     | Receive wired; New PO button dead                       |
| SCM           | Goods Receipt                                | `scmApi.receiveGoods`                           | `POST .../purchase-orders/:id/receive`      | ✅     | Approved PO list + warehouse picker (P1-1)              |
| SCM           | Inventory                                    | `scmApi`                                        | `GET/POST .../scm/inventory/*`              | ⚠️     | Reorder automation UI missing                           |
| SCM           | AP Invoices                                  | `financeApi`                                    | `GET .../finance/ap/invoices`               | ⚠️     | Reject button unwired                                   |
| SCM           | Forecast                                     | `forecastApi`                                   | `GET/POST .../forecast/*`                   | ✅     |                                                         |
| Projects      | Overview / Resources / Budget / New / Detail | `pmApi`                                         | `GET/POST/PATCH .../pm/*`                   | ✅     |                                                         |
| Projects      | Tasks / Milestones                           | `pmApi`                                         | `.../pm/*`                                  | ⚠️     | No create-task UI; `updateMilestone` unused             |
| BI            | Workspace                                    | `biApi`                                         | `GET/POST/PATCH .../bi/*`                   | ✅     |                                                         |
| Forecast      | AI Forecast                                  | `forecastApi`                                   | `GET/POST .../forecast/*`                   | ✅     |                                                         |
| Settings      | Keycloak / Auth / IdP / GDPR DSR             | `tenantApi`, `auditApi`                         | various                                     | ✅     |                                                         |
| Settings      | General                                      | `tenantApi.getConfig`                           | `GET /tenant/config`                        | ⚠️     | Read-only; no Save                                      |
| Settings      | Audit                                        | `auditApi.getLogs`, `verifyChain`               | `GET /audit/logs`, `GET /audit/verify`      | ✅     | Verify chain button (P1-5)                              |
| Settings      | GDPR                                         | DSR + consent                                   | `…/gdpr/requests*`, `…/gdpr/consent`        | ✅     | Consent list/record (P1-4)                              |
| Notifications | List + prefs + SSE                           | `notificationApi`                               | list/read/prefs/stream                      | ✅     | Prefs grid + live SSE (P1-3)                            |
| Notifications | Header bell                                  | `notificationApi.list`                          | unread poll                                 | ✅     | Navigates + unread badge (P1-3)                         |
| Vendor Portal | Login / POs                                  | `vendorPortalApi`                               | `.../vendor-portal/*`                       | ✅     | Shared `API_BASE_URL` (P0-2); `getProfile` still unused |
| Search        | Global search                                | `searchApi.search`                              | `GET /api/v1/search`                        | ✅     | Modal + Ctrl/Cmd+K (P1-2)                               |

### 1.2 Smoke pass (manual) ✅ (partial — unauthenticated + health)

With API + web running (2026-07-10):

| Check                                 | Result                                                     |
| ------------------------------------- | ---------------------------------------------------------- |
| `GET /health/live` + `/health/ready`  | **200** — db, redis, elasticsearch, keycloak, ml connected |
| GraphQL `{ health }`                  | **ok**                                                     |
| All audited `/api/v1/*` module routes | **401** (mounted + auth guard)                             |
| Vendor portal without `/api/v1`       | **404** (confirms P0-2)                                    |
| Web dashboard routes                  | **200** HTML shells                                        |
| Authenticated Network-tab pass        | Deferred to Phase 7 (needs login session)                  |

Env note: `.env.example` / Docker defaults use `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1` (**P0-1** fixed).

---

## Phase 2 — Fix Critical Wiring Bugs (P0, ~1–2 days) ✅ COMPLETE (2026-07-10)

| #    | Issue                                                                              | Fix                                                                                           |
| ---- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| P0-1 | ~~`.env.example` sets `NEXT_PUBLIC_API_URL=http://localhost:3001` (no `/api/v1`)~~ | ✅ `http://localhost:3001/api/v1` in example + Docker docs                                    |
| P0-2 | ~~`vendor-portal-api.ts` uses base URL without `/api/v1`~~                         | ✅ Imports shared `API_BASE_URL` from `client.ts`                                             |
| P0-3 | ~~`testing/helpers/client.js` missing `/api/v1`~~                                  | ✅ `API_BASE=http://localhost:3001/api/v1`; suite 07 `POST /tenant`; health via `HEALTH_BASE` |
| P0-4 | ~~Account balances always `0` in Chart of Accounts UI~~                            | ✅ `GET …/gl/accounts/balances` + UI merge for table/KPIs                                     |
| P0-5 | ~~`lib/current-user.ts` hardcoded manager for leave approve~~                      | ✅ `hrApi.getMe()` + Keycloak roles; stub file deleted                                        |

### P0-4 detail: Account balances ✅

- **Endpoint:** `GET /api/v1/finance/gl/accounts/balances` → `[{ accountId, code, balance }]` (posted JE lines: debit − credit).
- **UI:** `financeApi.getAccountBalances()` joined into Chart of Accounts rows + asset/liability/equity KPIs (credit-normal types flipped for display).

### P0-5 detail: Leave manager identity ✅

- **Identity:** `hrApi.getMe()` for create + approve/reject `managerEmployeeId`.
- **Gate:** JWT roles `manager` / `tenant_admin` / `superadmin`.
- **Reject:** `PATCH /leave/:id/reject` (P1-6) via `hrApi.rejectLeaveRequest`; approve path unchanged.
- **Removed:** `apps/web/src/lib/current-user.ts`.

> **Local note:** If your real `.env` still has `NEXT_PUBLIC_API_URL` without `/api/v1`, update it to match `.env.example` and restart the web app.

---

## Phase 3 — Complete Partial / Stub UI (P1, ~2–3 days) ✅ COMPLETE (2026-07-10)

| #    | Gap                       | Resolution                                                                      |
| ---- | ------------------------- | ------------------------------------------------------------------------------- |
| P1-1 | `/scm/goods-receipt` stub | ✅ Approved/partially-received PO list + warehouse picker + `receiveGoods`      |
| P1-2 | Global search inert       | ✅ `GlobalSearch` modal (`searchApi.search`); Ctrl/Cmd+K and `/`                |
| P1-3 | Notif prefs + SSE         | ✅ Prefs grid + SSE live updates; header bell → `/notifications` + unread badge |
| P1-4 | GDPR consent              | ✅ Consent Records in Settings → Compliance (`listConsents` / `recordConsent`)  |
| P1-5 | Audit verify unused       | ✅ **Verify chain** button; status from `{ valid, brokenAt? }`                  |
| P1-6 | Leave reject route        | ✅ `PATCH /leave/:id/reject` alias + `hrApi.rejectLeaveRequest`                 |

---

## Phase 4 — Backend-Only Features (P2, optional) ✅ COMPLETE (2026-07-10)

| Feature                                    | Backend route                               | Frontend                                                            |
| ------------------------------------------ | ------------------------------------------- | ------------------------------------------------------------------- |
| Sales Orders                               | `/api/v1/finance/sales-orders`              | ✅ `/finance/sales-orders` — list, create, generate AR invoice      |
| Intercompany transfers                     | `/api/v1/finance/gl/intercompany-transfers` | ✅ `/finance/intercompany` — list + create                          |
| AP manual create / payments / payment-runs | AP controller                               | ✅ Extended `/finance/invoices` — create, record payment, batch run |
| GraphQL dashboard stats                    | `/graphql`                                  | ✅ Platform Stats card on `/home` (`graphql-api.ts`)                |
| Reorder automation                         | `POST /api/v1/scm/automation/run-reorder`   | ✅ Button on `/scm/inventory`                                       |

### Dead API client code — resolved

| Client                               | Method                      | Resolution |
| ------------------------------------ | --------------------------- | ---------- |
| `scmApi.runReorderAutomation`        | ✅ Inventory page button    |
| `pmApi.updateMilestone`              | ✅ Milestones due-date edit |
| `biApi.getDataBySource`              | ✅ BI widget data fallback  |
| `vendorPortalApi.getProfile`         | ✅ Vendor portal header     |
| `searchApi` / `auditApi.verifyChain` | ✅ Wired in Phase 3         |

`biApi.listReports` remains a duplicate alias of `getReports` (harmless).

---

## Phase 5 — Test Infrastructure Repair (P0, ~1 day)

### 5.1 Fix existing functional tests

Location: `testing/suites/`

```bash
cd testing && pnpm test
```

| Suite                        | Coverage                                  | Action                                 |
| ---------------------------- | ----------------------------------------- | -------------------------------------- |
| `01-health.test.js`          | `/health/live`, `/ready`, `/db`           | Verify (paths correct — no `/api/v1`)  |
| `02-finance-gl.test.js`      | GL accounts, JE, fiscal periods, AR aging | Fix `API_BASE` prefix                  |
| `03-hr-payroll.test.js`      | employees, leave, attendance, payroll     | Fix prefix; add compliance             |
| `04-scm.test.js`             | vendors, products, PO, inventory          | Fix prefix                             |
| `05-pm.test.js`              | projects, tasks, milestones, budgets      | Fix prefix; add task reschedule        |
| `06-forecast.test.js`        | train + predict                           | Fix prefix                             |
| `07-auth-rbac.test.js`       | auth, tenant, RBAC                        | Fix prefix + tenant path               |
| `08-smoke-p2p-chain.test.js` | full P2P chain                            | Fix prefix                             |
| `09-audit.test.js`           | audit logs, GDPR list                     | Fix prefix; extend GDPR fulfill/export |

**Test client fix** (`testing/helpers/client.js`):

```javascript
const API_BASE = process.env.API_BASE || 'http://localhost:3001/api/v1';
```

Health checks should still use `http://localhost:3001/health/*` (no prefix).

### 5.2 Add missing suites

| New suite                  | Covers                                          |
| -------------------------- | ----------------------------------------------- |
| `10-search.test.js`        | `GET /search`, `POST /search/reindex`           |
| `11-gdpr-full.test.js`     | DSR create → fulfill → export ZIP               |
| `12-graphql.test.js`       | `{ health }`, authenticated `{ employeeCount }` |
| `13-vendor-portal.test.js` | login → list POs → acknowledge                  |
| `14-notifications.test.js` | list, mark-read, preferences                    |

### 5.3 API verify scripts

```bash
pnpm --filter api run verify:p2p          # P2P flow script
pnpm --filter api run audit:tenant-scoping  # already in CI
```

---

## Phase 6 — CI Integration (P1, ~1 day)

Add a `test-functional` job to `.github/workflows/ci.yml`:

```yaml
test-functional:
  needs: [build]
  services:
    postgres: ...
    redis: ...
  steps:
    - docker compose up -d postgres redis keycloak elasticsearch
    - prisma db push && seed
    - start API in background (port 3001)
    - cd testing && pnpm test
```

**Later (P2):**

- k6 load test on nightly schedule (`testing/load/k6-load-test.js`)
- Playwright e2e: login + one page per module
- NestJS e2e with `supertest` for P2P, GDPR, payroll

---

## Phase 7 — Manual E2E Checklist (per release) 🔄 IN PROGRESS (2026-07-10)

> **Log:** [`docs/phase7-e2e-log.md`](./phase7-e2e-log.md) — first pass with `admin@companya.in` / `company-a`.

### Auth & tenant

- [x] Login as `admin@companya.in` / `Admin123!` (tenant `company-a`)
- [x] Settings → General tab loads
- [ ] Settings → Identity Settings (Keycloak config)
- [x] `/api/v1/auth/me` returns tenant + roles

### Finance

- [x] Create account → appears in Chart of Accounts
- [ ] Open fiscal period → post balanced journal entry → listed
- [ ] Upload AP invoice (OCR mock) → approve → GL journal posted _(Suite 08 covers API)_
- [ ] AR invoice create + record payment
- [x] Aging report loads with data

### HR

- [ ] Add employee → org chart shows hierarchy
- [ ] Clock in/out on attendance page
- [ ] Submit leave → approve as manager (real user, not stub)
- [ ] Run payroll for current period
- [ ] Statutory compliance save + tax slab CRUD

### SCM

- [ ] Create vendor + product
- [ ] Create PO → approve → vendor notification (Mailpit at `:8025`)
- [ ] Receive goods → inventory updates
- [ ] Reorder rule + low-stock PR flow

### Projects

- [ ] Create project + tasks with dates
- [ ] D3 Gantt drag reschedule persists
- [ ] Achieve milestone

### Cross-cutting

- [x] In-app notifications appear
- [ ] GDPR DSR create → fulfill → download ZIP
- [x] Search returns vendors/products
- [x] `GET /health/ready` — db, redis, elasticsearch, keycloak, ml all connected
- [x] GraphQL `{ health }` returns `ok`

---

## Phase 8 — Documentation Sync (0.5 day)

- [ ] Update `docs/project_status.md` with wiring matrix results
- [ ] Fix stale paths in `apps/web/src/lib/api/contracts.ts`
- [ ] Archive or delete unused `apps/web/src/lib/mock/*`
- [ ] Document env vars in `.env.example`:
  - `NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1`
  - `OCR_PROVIDER=mock|textract`
  - `SMS_WEBHOOK_URL`
  - `ELASTICSEARCH_URL`

---

## Recommended Execution Order

```
Week 1 (foundation)
├── Phase 1: Wiring audit matrix (docs/wiring-audit.md) ✅ DONE 2026-07-10
├── Phase 2: P0 wiring bugs (env, vendor-portal, balances, current-user) ✅ DONE 2026-07-10
└── Phase 5: Fix test client + run all 9 suites locally ✅ DONE 2026-07-10

Week 2 (completeness)
├── Phase 3: Stub pages (goods-receipt, search, GDPR consent) ✅ DONE 2026-07-10
├── Phase 4: Backend-only features ✅ DONE 2026-07-10
├── Phase 5: New test suites 10–14 ← NEXT
└── Phase 7: Manual E2E checklist pass 🔄 IN PROGRESS (see phase7-e2e-log.md)

Week 3 (automation)
├── Phase 6: CI functional test job
├── Phase 8: Docs update
└── Phase 4: Backend-only features (only if in scope)
```

---

## Success Criteria

| Metric                                 | Target                            |
| -------------------------------------- | --------------------------------- |
| Dashboard pages wired to live API      | 45/45 (no stubs)                  |
| API client ↔ route mismatches          | 0                                 |
| Functional test suites passing locally | 14/14                             |
| Functional tests in CI                 | Yes, on every PR                  |
| Manual E2E checklist                   | 100% pass before release          |
| Known P0 bugs                          | ✅ 0 (P0-1…P0-5 fixed 2026-07-10) |

---

## API Client Inventory

| Client file            | Backend areas                                                  |
| ---------------------- | -------------------------------------------------------------- |
| `client.ts`            | Shared fetch; base `http://localhost:3001/api/v1`              |
| `hr-api.ts`            | employees, departments, attendance, leave, payroll, compliance |
| `finance-api.ts`       | GL, AR, AP (partial — no payments/runs)                        |
| `scm-api.ts`           | products, vendors, POs, inventory, requisitions                |
| `pm-api.ts`            | projects, tasks, milestones, budgets, resources                |
| `bi-api.ts`            | dashboards, widgets, KPIs, SSE, reports                        |
| `forecast-api.ts`      | ML forecast train/predict                                      |
| `tenant-api.ts`        | tenant config, Keycloak admin (partial)                        |
| `notification-api.ts`  | list, mark-read only                                           |
| `audit-api.ts`         | audit logs, GDPR (partial)                                     |
| `search-api.ts`        | search (unused)                                                |
| `vendor-portal-api.ts` | vendor portal (partial; base URL risk)                         |

---

## Known Env / Routing Rules

| Surface    | URL pattern                                  |
| ---------- | -------------------------------------------- |
| REST API   | `http://localhost:3001/api/v1/*`             |
| Health     | `http://localhost:3001/health/*` (no prefix) |
| GraphQL    | `http://localhost:3001/graphql` (no prefix)  |
| Swagger    | `http://localhost:3001/api-docs`             |
| Bull Board | `http://localhost:3001/admin/queues`         |
| Web        | `http://localhost:3000`                      |
| Mailpit    | `http://localhost:8025`                      |

**Rule:** `NEXT_PUBLIC_API_URL` must include `/api/v1` for all `apiClient` calls to work.

---

## References

- **Wiring audit (Phase 1):** [`docs/wiring-audit.md`](./wiring-audit.md)
- Backend controllers: `apps/api/src/**/**.controller.ts`
- Frontend API clients: `apps/web/src/lib/api/*.ts`
- Functional tests: `testing/suites/*.test.js`
- CI workflow: `.github/workflows/ci.yml`
- Project status (stale): `docs/project_status.md`
