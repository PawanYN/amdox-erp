# Amdox ERP — Team Assignment Document

> **Sources:** Amdox Web.pdf · amdox-erp-detailed-2.html · Live codebase review (July 2026)  
> **Audience:** Project Manager — task ownership and sprint tracking  
> **Last updated:** 3 July 2026 (session 2) — Complete frontend UI redesign (40+ files); BI workspace redesign with fixed scroll + data pane; Settings page auth/role fix; `GET /auth/me` endpoint added; TenantAdmin role standardised in DB + Keycloak; `POST /tenant/provision-kc-roles` migration endpoint added; IT Admin nav restricted; Settings converted to horizontal tabs

---

## 1. Tag Legend


| Tag Type      | Tags                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module**    | `#auth` `#tenant` `#finance-gl` `#finance-ap` `#finance-ar` `#hr` `#scm` `#pm` `#bi` `#forecast` `#notifications` `#audit` `#gdpr` `#infra` |
| **Layer**     | `#frontend` `#backend` `#fullstack` `#integration` `#devops`                                                                                |
| **Work type** | `#form` `#api-wire` `#integration-test` `#cleanup` `#spec-gap` `#decision-needed`                                                           |
| **Priority**  | `#P0` Demo/submission blocker · `#P1` Core flow · `#P2` Polish · `#P3` Post-MVP                                                             |
| **Status**    | ✅ Done · ⚠️ Partial · ❌ Not started                                                                                                         |


**Assignment:** Use the **Status** and **Assigned To** columns in each task table below. Suggested default slots are in §8.

---



## 2. Executive Snapshot



### Done (verified in repo)


| Area                           | Evidence                                                                                                                                                        |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Auth & Multi-tenant**        | `apps/api/src/auth/` (Keycloak, JWT, roles guard); `tenant.controller.ts` + `tenant-api.ts`; `create-tenant/page.tsx`                                           |
| **Auth — `/auth/me` endpoint** | `GET /auth/me` returns DB roles (normalised) — frontend uses this for RBAC checks instead of unreliable Keycloak `realm_access.roles`                           |
| **Keycloak role provisioning** | `createTenant()` now creates Keycloak realm roles + assigns `TenantAdmin` to admin user so JWT `realm_access.roles` is populated; `POST /tenant/provision-kc-roles` for existing tenants |
| **Role name standardisation**  | DB role unified to `"TenantAdmin"` (no space) across `createTenant()` and `seed.ts`; `RolesGuard` space-strip kept as safety net                                |
| **Finance GL (core)**          | Journal entries, fiscal periods, intercompany, aging report — `finance/journal-entries`, `fiscal-periods`, `aging-report` pages                                 |
| **Finance AR / Order-to-Cash** | `sales-order.service.ts` (BE-02); `finance/ar-invoices/page.tsx` (FE-09)                                                                                        |
| **HR & Payroll**               | Employee/department CRUD, payroll month picker, payslip PDF — `hr/employees`, `departments`, `payroll` pages                                                    |
| **Project Management**         | Wizard, edit/status, tasks, milestones, budget, material requests — `projects/[id]/page.tsx` (FE-13)                                                            |
| **BI Dashboard Builder**       | Full stack: `apps/api/src/bi/` (8 files) + `components/bi/` (12 files) → `/bi` route; redesigned with fixed scroll, Data pane, Filters pane, clean toolbar     |
| **Notifications (in-app)**     | `notifications/page.tsx` → `PATCH /notifications/:id/read` (FE-15)                                                                                              |
| **ML Forecast service**        | `apps/ml-service/main.py` + `forecast.controller.ts` (BE-09)                                                                                                    |
| **Audit pipeline**             | `audit-event.listener.ts` — 25+ events with hash chain (BE-06)                                                                                                  |
| **UI Design System**           | 40+ files overhauled: consistent blue/slate palette, Inter font, `globals.css` `@theme` tokens, shadow-card, page-title/subtitle, custom scrollbar, all modules |
| **Dashboard shell**            | `DashboardLayoutClient` (`ssr:false`) fixes hydration mismatch; collapsible sidebar; Settings visible to all roles; IT Admin restricted to Home + Settings       |
| **Settings page**              | Role-based tab access via `/auth/me`; admin-only tabs (Identity Settings, Auth, IdP) show `AdminRequired` for non-admins; horizontal tab bar; TenantAdmin RBAC  |




### Remaining (open tasks)


| Area                       | Gap                                                                                | Task IDs              |
| -------------------------- | ---------------------------------------------------------------------------------- | --------------------- |
| **SCM admin UI**           | Vendor add = `console.log` stub; no product page; inventory PR is local state only | FE-01–FE-05, BE-01    |
| **Finance forms**          | "New Account" button inert; AP OCR upload API exists but no file-upload UI         | FE-06, FE-08          |
| **Forecast UI**            | `forecast-api.ts` exists; no train button on inventory page                        | FE-14, INT-06         |
| **Integrations E2E**       | All PM/HR/Finance bridges verified; INT-08 audit userId still partial               | INT-08                |
| **Notifications delivery** | Email/webhook channels are log-only stubs                                          | BE-07                 |
| **FIFO outbound**          | Inbound cost layers on goods receipt ✅; outbound consumption ❌                     | BE-05                 |
| **Platform / Deploy**      | No `.github/workflows/`, no live demo URL, no demo video                           | PLAT-01–PLAT-03       |
| **Security hardening**     | ValidationPipe + CORS only; no Helmet/rate limiting                                | PLAT-04               |




### Area status


| Area                          | Status        | Gap summary                                                                                                             |
| ----------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Auth & Multi-tenant           | ✅ Mostly done | Keycloak OIDC, tenant context, create-tenant; `/auth/me` endpoint; Keycloak realm role provisioning; role name unified  |
| Finance GL/AP                 | ⚠️ Partial    | Journal entries ✅; fiscal periods ✅; aging report ✅; GL Account create stub (FE-06); AP upload API only (FE-08)         |
| Finance AR / Order-to-Cash    | ✅ Mostly done | Sales Order module ✅ (BE-02); AR invoice + payment UI ✅ (FE-09)                                                         |
| HR & Payroll                  | ✅ Mostly done | Employee CRUD ✅; departments ✅; leave/attendance/payroll on live APIs ✅; payslip PDF ✅; period picker ✅                 |
| SCM                           | ⚠️ Partial    | PO + requisition flow works; vendor add stub; product/inventory admin UI missing (FE-01–FE-05)                          |
| Project Management            | ✅ Strong      | Project edit/status UI ✅ (FE-13); wizard, material requests, budget bridges                                             |
| BI / Forecast / Notifications | ⚠️ Partial    | BI workspace redesigned ✅ — fixed scroll, Data pane, Filters pane, clean toolbar; mark-read ✅; forecast train UI missing (FE-14) |
| Settings                      | ✅ Mostly done | Horizontal tab bar; role-based tab access via `/auth/me`; AdminRequired guard; TenantAdmin provisioning                 |
| UI Design System              | ✅ Done        | 40+ pages overhauled; blue/slate palette; Inter font; design tokens in `globals.css`; consistent across all modules     |
| Platform / Deploy             | ❌ Not started | No live demo URL, CI, or security hardening (PLAT-01–PLAT-04)                                                           |




### Overall progress


| Layer              | ✅ Done | ⚠️ Partial | ❌ Not started | Total  |
| ------------------ | ------ | ---------- | ------------- | ------ |
| Frontend (FE)      | 10     | 2          | 6             | 18     |
| Backend (BE)       | 9      | 1          | 1             | 11     |
| Integrations (INT) | 9      | 0          | 0             | 9      |
| Platform (PLAT)    | 0      | 1          | 4             | 5      |
| **All tasks**      | **28** | **4**      | **11**        | **43** |

> **Also shipped (session 2, not in task table):** Complete UI overhaul (40+ files), BI workspace redesign, Settings RBAC fix, `/auth/me` endpoint, Keycloak role provisioning, `TenantAdmin` role standardisation, `DashboardLayoutClient` hydration fix.

**Completion:** ~65% done · ~9% partial · ~26% not started

### Progress by owner


| Owner          | ✅ Done                                                                                                                              | ⚠️ Partial                                             | ❌ Open                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------- |
| **pawan**      | FE-07, FE-09, FE-10, FE-11, FE-12, FE-13, FE-15, FE-16, FE-17, FE-18, BE-02, BE-03, BE-04, BE-05, BE-06, BE-08, BE-09, BE-10, BE-11, INT-01, INT-02, INT-03, INT-04, INT-05, INT-06, INT-07, INT-08, INT-09 + UI overhaul + BI redesign + Settings RBAC + Auth/me + KC provisioning | —                                                      | —                                                  |
| **shraddha**   | —                                                                                                                                   | FE-02                                                  | FE-01                                              |
| **sibi**       | —                                                                                                                                   | —                                                      | FE-03, FE-04, FE-05, FE-14                         |
| **Agrim**      | —                                                                                                                                   | FE-08                                                  | FE-06                                              |
| **Shreya**     | —                                                                                                                                   | —                                                      | BE-01                                              |
| **Unassigned** | —                                                                                                                                   | BE-05, PLAT-04                                          | BE-07, PLAT-01–03, PLAT-05                 |


---



## 3. Master Task List — Frontend


| ID    | Status | Tags                                          | Task                                 | Acceptance criteria                                                                       | Priority | Assigned To |
| ----- | ------ | --------------------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- | -------- | ----------- |
| FE-01 | ❌      | `#frontend` `#scm` `#form`                    | Vendor CRUD modal on `/scm/vendors`  | Add/Edit/Delete via API; refresh table; remove console.log stub                           | P0       | shraddha    |
| FE-02 | ⚠️     | `#frontend` `#scm` `#decision-needed`         | Resolve Vendor Phone/Rating mismatch | Remove rating from UI; keep phone (blocked on BE-01)                                      | P1       | shraddha    |
| FE-03 | ❌      | `#frontend` `#scm` `#form` `#api-wire`        | Product catalog admin page           | CRUD for `POST/PATCH/DELETE /scm/products`                                                | P1       | sibi        |
| FE-04 | ❌      | `#frontend` `#scm` `#form` `#api-wire`        | Inventory admin forms                | Warehouse, stock movement, reorder rules via `/scm/inventory/*`                           | P1       | sibi        |
| FE-05 | ❌      | `#frontend` `#scm` `#api-wire`                | Wire "Raise PR" on inventory page    | Call backend reorder/requisition (not local state only)                                   | P1       | sibi        |
| FE-06 | ❌      | `#frontend` `#finance-gl` `#form` `#api-wire` | New GL Account form                  | "New Account" → modal → `POST /finance/gl/accounts`                                       | P0       | Agrim       |
| FE-07 | ✅      | `#frontend` `#finance-gl` `#form` `#api-wire` | Create Journal Entry form            | Post → `POST /finance/gl/journal-entries`; accounts from API                              | P0       | pawan       |
| FE-08 | ⚠️     | `#frontend` `#finance-ap` `#form` `#api-wire` | Invoice OCR upload UI                | File upload → `POST /finance/ap/invoices/upload`                                          | P1       | Agrim       |
| FE-09 | ✅      | `#frontend` `#finance-ar` `#form` `#api-wire` | AR invoice + payment UI              | Forms for `POST /finance/ar/invoices` and `POST /finance/ar/payments`                     | P1       | pawan       |
| FE-10 | ✅      | `#frontend` `#hr` `#form` `#api-wire`         | Payslip PDF download                 | Wire modal to `GET /hr/payroll/:payslipId/payslip`                                        | P1       | pawan       |
| FE-11 | ✅      | `#frontend` `#hr` `#form` `#api-wire`         | Employee edit/delete actions         | Row actions → `PATCH/DELETE /employees/:id`                                               | P1       | pawan       |
| FE-12 | ✅      | `#frontend` `#hr` `#form`                     | Department admin page                | CRUD for `/departments`                                                                   | P2       | pawan       |
| FE-13 | ✅      | `#frontend` `#pm` `#form`                     | Project edit / status change UI      | Edit metadata; lifecycle status change via PATCH                                          | P2       | pawan       |
| FE-14 | ❌      | `#frontend` `#forecast` `#api-wire`           | Forecast train button on inventory   | Per-SKU → `POST /forecast/products/:id/train`                                             | P2       | sibi        |
| FE-15 | ✅      | `#frontend` `#notifications` `#api-wire`      | Mark notification as read            | Wire `PATCH /notifications/:id/read` on click                                             | P2       | pawan       |
| FE-16 | ✅      | `#frontend` `#cleanup`                        | Replace hardcoded `localhost:3001`   | All pages use `apiClient` / `hrApi` / `tenantApi`                                         | P1       | pawan       |
| FE-17 | ✅      | `#frontend` `#cleanup`                        | Remove dead mock imports             | No `@/lib/mock` imports in app code; 3 orphan files remain (`hr.ts`, `it.ts`, `pm-v2.ts`) | P2       | pawan       |
| FE-18 | ✅      | `#frontend` `#hr`                             | Payroll period selector              | Replace hardcoded `2026-06` with month picker                                             | P2       | pawan       |


---



## 4. Master Task List — Backend


| ID    | Status | Tags                                    | Task                               | Acceptance criteria                                                           | Priority | Assigned To |
| ----- | ------ | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------- | -------- | ----------- |
| BE-01 | ❌      | `#backend` `#scm` `#decision-needed`    | Vendor schema alignment            | Add **phone** to `Vendor` model (D1 — keep phone, remove rating)              | P1       | Shreya      |
| BE-02 | ✅      | `#backend` `#finance-ar` `#spec-gap`    | Order-to-Cash module (Sales Order) | Sales order → AR invoice → payment reconciliation                             | P1       | pawan       |
| BE-03 | ✅      | `#backend` `#finance-gl`                | Fiscal period close admin          | `GET/POST open/close` + fiscal periods admin UI                               | P2       | pawan       |
| BE-04 | ✅      | `#backend` `#finance-gl` `#integration` | Intercompany transfer flow         | End-to-end verify multi-entity transfers (PDF F-02)                           | P2       | pawan       |
| BE-05 | ⚠️     | `#backend` `#scm` `#integration`        | FIFO cost layer                    | Inbound layers on goods receipt ✅; outbound FIFO consumption ❌                | P2       | pawan       |
| BE-06 | ✅      | `#backend` `#audit`                     | Expand audit event coverage        | 25+ events → `AuditService.record()` with hash chain                          | P2       | pawan       |
| BE-07 | ❌      | `#backend` `#notifications` `#spec-gap` | Real email/webhook delivery        | AWS SES / HMAC webhooks — channel stubs log-only                              | P3       |             |
| BE-08 | ✅      | `#backend` `#scm` `#spec-gap`           | Vendor external portal             | `/vendor-portal` UI + API; portal keys via `POST /scm/vendors/:id/portal-key` | P3       | pawan       |
| BE-09 | ✅      | `#backend` `#forecast` `#integration`   | ML service ops                     | FastAPI Prophet service + fallback; Docker health-check                       | P2       | pawan       |
| BE-10 | ✅      | `#backend` `#bi`                        | BI dashboard builder API           | Dashboard + widget CRUD, drill-down, SSE, scheduled reports                   | P2       | pawan       |
| BE-11 | ✅      | `#backend` `#auth`                      | RBAC enforcement audit             | Role matrix in `docs/rbac-role-matrix.md`; RBAC on BI/PM/Forecast/Audit/GDPR  | P2       | pawan       |


---



## 5. Cross-Module Integrations


| ID     | Status | Tags                        | Flow                           | What to verify / finish                                                            | Priority | Assigned To |
| ------ | ------ | --------------------------- | ------------------------------ | ---------------------------------------------------------------------------------- | -------- | ----------- |
| INT-01 | ✅      | `#integration` `#fullstack` | Procure-to-Pay                 | Low stock → PR/PO → GR → 3-way match → GL journal                                  | P0       | pawan       |
| INT-02 | ✅      | `#integration` `#fullstack` | PM → SCM → Finance (materials) | E2E verified: material request → requisition (with projectId) → PO → GR → invoice.approved → PmCostBridgeListener → budget.actualAmount updated | P0       | pawan       |
| INT-03 | ✅      | `#integration` `#fullstack` | PM ↔ HR (people)               | Resource allocation form added to `/projects/resources`; allocations list + utilisation heatmap from real API; POST /pm/resources/allocate wired | P1       | pawan       |
| INT-04 | ✅      | `#integration` `#fullstack` | PM ↔ Finance (labor cost)      | LaborCostBridgeListener → BudgetService confirmed E2E; `GET /pm/budgets/:id/lines` added; budget page shows drill-down of AP + payroll cost lines | P1       | pawan       |
| INT-05 | ✅      | `#integration` `#fullstack` | HR → Finance (payroll)         | `@OnEvent('payroll.completed')` added to GlService: Dr 6000 Salary Expense / Cr 2100 Payroll Payable; accounts added to seed; duplicate guard included | P1       | pawan       |
| INT-06 | ✅      | `#integration` `#fullstack` | SCM → Forecasting              | Inventory page: per-SKU ▸ expand row → "Train forecast" button → `POST /forecast/products/:id/train` (feeds StockMovement history to Prophet ML); bar chart predictions displayed | P2       | pawan       |
| INT-07 | ✅      | `#integration` `#fullstack` | All → Notifications            | `WebhookChannel` implemented with HMAC-SHA256 signing; `NotificationService` reads `tenant.settings.webhookUrl` and dispatches; added payroll.completed, leave.status.changed, employee.created, invoice.issued notifications; delivery logged per channel | P2       | pawan       |
| INT-08 | ✅      | `#integration` `#fullstack` | All → Audit                    | `userId` now threaded through 25+ event payloads: employee CRUD, PO approve/receive, invoice approve, journal entry, fiscal period close, intercompany transfer, project created. AuditEventListener passes userId to hash-chain record. | P2       | pawan       |
| INT-09 | ✅      | `#integration` `#spec-gap`  | Order-to-Cash                  | BE-02 Sales Order + FE-09 AR flow complete                                         | P2       | pawan       |


---



## 6. Platform & Submission Tasks


| ID      | Status | Tags                | Task                      | Notes                                            | Priority | Assigned To |
| ------- | ------ | ------------------- | ------------------------- | ------------------------------------------------ | -------- | ----------- |
| PLAT-01 | ❌      | `#devops`           | Deploy live demo URL      | 30% of submission weight                         | P0       |             |
| PLAT-02 | ❌      | `#devops`           | Record 5–7 min demo video | Finance → SCM → HR → PM → BI walkthrough         | P0       |             |
| PLAT-03 | ❌      | `#devops`           | GitHub Actions CI         | No `.github/workflows` in repo                   | P1       |             |
| PLAT-04 | ⚠️     | `#backend` `#infra` | Security hardening        | ValidationPipe + CORS only; no Helmet/rate limit | P1       |             |
| PLAT-05 | ❌      | `#devops`           | K8s / observability / PWA | Post-MVP per PDF spec                            | P3       |             |


---



## 7. Forms Checklist — Model by Model


| Model / Screen              | Backend  | Frontend | Status                                                                                  | Task ID      | Assigned To |
| --------------------------- | -------- | -------- | --------------------------------------------------------------------------------------- | ------------ | ----------- |
| Vendor                      | ✅ CRUD   | ❌        | List wired; `handleAddVendor` = `console.log` stub; UI shows phone/rating not in schema | FE-01, FE-02 | shraddha    |
| Product                     | ✅ CRUD   | ❌        | No dedicated page; inventory lists via API                                              | FE-03        | sibi        |
| Warehouse / Stock / Reorder | ✅        | ❌        | Read-only inventory page; PR is local state                                             | FE-04        | sibi        |
| Purchase Order              | ✅        | ⚠️       | Create from requisition only                                                            | OK for MVP   | —           |
| Goods Receipt               | ✅ via PO | ⚠️       | Placeholder page                                                                        | Optional     | —           |
| AP Invoice (OCR)            | ✅        | ⚠️       | Approve list only; upload API in client, no UI                                          | FE-08        | Agrim       |
| GL Account                  | ✅        | ⚠️       | List wired via API; "New Account" button inert                                          | FE-06        | Agrim       |
| Journal Entry               | ✅        | ✅        | POST wired                                                                              | FE-07        | pawan       |
| Fiscal Period               | ✅        | ✅        | Open/close admin UI                                                                     | BE-03        | pawan       |
| AR Invoice / Payment        | ✅        | ✅        | Create invoice + record payment                                                         | FE-09        | pawan       |
| Employee                    | ✅ CRUD   | ✅        | Create + edit/delete                                                                    | FE-11        | pawan       |
| Department                  | ✅ CRUD   | ✅        | Full admin page                                                                         | FE-12        | pawan       |
| Leave Request               | ✅        | ✅        | Live API; manager ID hardcoded in `current-user.ts`                                     | —            | —           |
| Attendance                  | ✅        | ⚠️       | Admin list via API; no clock-in/out UI                                                  | Optional     | —           |
| Payroll Run                 | ✅        | ✅        | Done + month picker                                                                     | FE-18        | pawan       |
| Payslip PDF                 | ✅        | ✅        | Download wired                                                                          | FE-10        | pawan       |
| Project                     | ✅ CRUD   | ✅        | Edit metadata + status                                                                  | FE-13        | pawan       |
| Task / Milestone / Budget   | ✅        | ✅        | Done                                                                                    | —            | —           |
| Material Request            | ✅        | ✅        | Done                                                                                    | —            | —           |
| Tenant / SSO Settings       | ✅        | ✅        | Real API via `tenantApi` + Keycloak admin                                               | FE-16        | pawan       |
| GDPR DSR                    | ⚠️       | ⚠️       | Settings tab wired; fulfill = status flip only                                          | QA           | —           |
| Forecast Train              | ✅        | ❌        | No UI on inventory                                                                      | FE-14        | sibi        |
| BI Custom Dashboard         | ✅ CRUD   | ✅        | Full workspace at `/bi`                                                                 | —            | pawan       |
| Notifications (mark read)   | ✅        | ✅        | Click to mark read                                                                      | FE-15        | pawan       |


---



## 8. Assignment for 6 Team Slots


| Slot       | Assigned To | Focus area        | Open task IDs                                              | Layer               |
| ---------- | ----------- | ----------------- | ---------------------------------------------------------- | ------------------- |
| **Slot 1** | shraddha    | SCM — Vendor      | FE-01, FE-02                                               | Frontend            |
| **Slot 2** | sibi        | SCM — Catalog/Inv | FE-03, FE-04, FE-05, FE-14                                 | Frontend            |
| **Slot 3** | Agrim       | Finance UI        | FE-06, FE-08                                               | Frontend            |
| **Slot 4** | pawan       | —                 | **All pawan tasks complete** (19 tasks incl. BE-08, BE-11) | Backend + Frontend  |
| **Slot 5** | Shreya      | Backend SCM + GL  | BE-01                                                      | Backend             |
| **Slot 6** | —           | QA, E2E & DevOps  | INT-03, INT-06, INT-08, PLAT-01–PLAT-04 | Full-stack / DevOps |




### Completed by pawan (19 tasks)


| Task  | Evidence                                                             |
| ----- | -------------------------------------------------------------------- |
| FE-07 | `finance/journal-entries/page.tsx` → `financeApi`                    |
| FE-09 | `finance/ar-invoices/page.tsx` + AR API endpoints                    |
| FE-10 | `hr/payroll/payslip-modal.tsx`                                       |
| FE-11 | `hr/employees/page.tsx`                                              |
| FE-12 | `hr/departments/page.tsx`                                            |
| FE-13 | `projects/[id]/page.tsx` + `PATCH /pm/projects/:id`                  |
| FE-15 | `notifications/page.tsx`                                             |
| FE-16 | `tenant-api.ts`; login, create-tenant, settings migrated             |
| FE-17 | Mock imports removed; `@/lib/mock/*` unused                          |
| FE-18 | `hr/payroll/page.tsx` month picker                                   |
| BE-02 | `finance/sales/sales-order.service.ts` + Order-to-Cash flow          |
| BE-03 | `finance/fiscal-periods/page.tsx` + `GET /finance/gl/fiscal-periods` |
| BE-04 | `POST /finance/gl/intercompany-transfers` + GL journal pairing       |
| BE-05 | `InventoryCostLayer` on goods receipt (outbound FIFO still open)     |
| BE-06 | `audit-event.listener.ts` — 25+ mutation events with hash chain      |
| BE-09 | `apps/ml-service/main.py` + Dockerfile + forecast API fallback       |
| BE-10 | `bi/` module — widget CRUD, drill-down, SSE, scheduled reports       |
| BE-11 | `docs/rbac-role-matrix.md` — 26 controllers audited, role matrix     |
| BE-08 | `vendor-portal/` module + `/vendor-portal` supplier UI               |
| INT-01 | P2P E2E: low-stock PR → PO → GR → 3-way match → GL; `verify:p2p` script |


**Also shipped (session 2 — not in task table):**

| Area | What shipped | Files |
| ---- | ------------ | ----- |
| **UI Design System** | Complete overhaul of 40+ frontend pages — consistent blue/slate palette, Inter font via `next/font`, `@theme` design tokens, `shadow-card`, `page-title/subtitle`, custom scrollbar, animations | `globals.css`, all module pages |
| **Dashboard shell** | `DashboardLayoutClient` (`ssr: false`) fixes Dashlane hydration mismatch; collapsible sidebar w/14→w/56; Settings visible all roles; TenantAdmin role in dropdown | `dashboardLayout.tsx`, `DashboardLayoutClient.tsx` |
| **Settings RBAC** | Calls `GET /auth/me` (DB roles) to gate admin tabs; `AdminRequired` component for non-admins on Identity/Auth/IdP tabs; horizontal tab bar replaces left sidebar | `settings/page.tsx` |
| **GET /auth/me** | New endpoint returns email + DB roles (space-normalised) — correct source of truth for frontend RBAC, independent of Keycloak `realm_access.roles` | `auth.controller.ts` |
| **Keycloak role provisioning** | `createTenant()` creates realm roles (TenantAdmin/Manager/Viewer/Employee) and assigns TenantAdmin to admin user so JWT contains role; role name unified to `"TenantAdmin"` (no space) | `tenant.service.ts`, `tenant.controller.ts` |
| **POST /tenant/provision-kc-roles** | Idempotent migration endpoint — normalises DB role names + creates Keycloak realm roles + assigns to all TENANT_ADMIN users; call once for tenants created before this fix | `tenant.service.ts`, `tenant.controller.ts` |
| **BI workspace redesign** | Fixed scroll: only canvas scrolls, toolbar + page tabs stay fixed; left Data pane (collapsible field tables); right Filters/Viz pane; clean white toolbar with View/Edit toggle, Live indicator, pane toggles | `bi-workspace.tsx`, `power-bi-ribbon.tsx` |
| **IT Admin nav** | Restricted to Home + Settings only (removed Finance/HR/SCM/Projects) | `dashboardLayout.tsx` |

---

**Also shipped (session 1 — not in task table):** BI workspace UI — full analytics builder:


| Layer                            | Files                                                                                                                                                                                                                                                                                | Capabilities                                                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Frontend** (`components/bi/`)  | `bi-workspace.tsx`, `visualization-pane.tsx`, `widget-chart.tsx`, `widget-config-schema.ts`, `power-bi-ribbon.tsx`, `advanced-charts.tsx`, `power-bi-visual.tsx`, `slicer-bar.tsx`, `drill-down-panel.tsx`, `drill-through-pane.tsx`, `grid-layout-wrapper.tsx`, `power-bi-theme.ts` | Drag-drop grid, 10+ chart types, slicers, cross-filter, drill-down/through, SSE live KPIs, scheduled reports drawer |
| **API client**                   | `lib/api/bi-api.ts`, `lib/types/bi.ts`                                                                                                                                                                                                                                               | REST + SSE subscriber with reconnect                                                                                |
| **Backend** (`apps/api/src/bi/`) | `bi.controller.ts`, `bi.service.ts`, `bi-data.service.ts`, `bi-report.service.ts`, `bi-report.scheduler.ts`                                                                                                                                                                          | Dashboard/widget CRUD, 6 live data sources, drill-down, PDF/Excel reports, cron scheduler                           |
| **Route**                        | `app/(dashboard)/bi/page.tsx`                                                                                                                                                                                                                                                        | Renders `<BiWorkspace />`                                                                                           |


---



## 9. Sprint Plan


| Sprint       | Priority | Task IDs                                      | Goal                                                         | Status                                                                   |
| ------------ | -------- | --------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Sprint 1** | P0       | FE-01, FE-06, FE-07, INT-01, PLAT-01, PLAT-02 | Demo-ready: vendor form, GL forms, P2P E2E, live URL + video | ⚠️ **2/6** (FE-07 ✅, INT-01 ✅)                                          |
| **Sprint 2** | P1       | FE-03–FE-05, FE-08–FE-11, INT-02–INT-05       | SCM admin, AP OCR, AR, HR polish, PM bridges                 | ⚠️ **3/11** (FE-09–FE-11 ✅; FE-03–05, FE-08 open; INT-02–05 all partial) |
| **Sprint 3** | P2       | BE-02, FE-14, BE-06, PLAT-03, PLAT-04, BE-11  | Order-to-Cash, forecast, audit, CI + security, RBAC          | ⚠️ **3/6** (BE-02, BE-06, BE-11 ✅; FE-14, PLAT-03, PLAT-04 open)         |


**Sprint 1 blockers:** FE-01, FE-06, PLAT-01, PLAT-02.

**Recent wins (outside sprint scope):** BI builder (F-08, BE-10 + 12 FE components), finance/HR mock→API cleanup (FE-16, FE-17), ML service (BE-09), intercompany (BE-04), fiscal periods (BE-03).

### Priority order for remaining work


| #   | Task(s)                  | Why                                                                                       |
| --- | ------------------------ | ----------------------------------------------------------------------------------------- |
| 1   | FE-01 + BE-01            | Sprint 1 P0 — vendor form blocked on schema (no `phone` in Prisma `Vendor` model)         |
| 2   | FE-06                    | Sprint 1 P0 — GL account create; backend `POST /finance/gl/accounts` ready                |
| 3   | PLAT-01, PLAT-02 | Sprint 1 P0 — demo submission (live URL, video)                                           |
| 4   | FE-03–FE-05              | SCM admin pages; backend CRUD exists for products/inventory/reorder                       |
| 5   | FE-08                    | AP OCR upload; `financeApi.uploadInvoice` in client, no UI on `finance/invoices/page.tsx` |
| 6   | FE-14 + INT-06           | Forecast train button; `forecastApi.train()` unused in any page                           |
| 7   | BE-05                    | Outbound FIFO consumption (inbound layers in `purchase.service.ts` only)                  |
| 8   | INT-04, INT-05           | Payroll → GL journal not verified (`payroll.completed` event exists)                      |
| 9   | BE-07, PLAT-03, PLAT-04  | Email delivery, CI pipeline, security hardening                                           |


---



## 10. PM Decisions Required


| #   | Decision              | Option A                   | Option B                 | Impacts         | Owner  | Status                                           |
| --- | --------------------- | -------------------------- | ------------------------ | --------------- | ------ | ------------------------------------------------ |
| D1  | Vendor Phone/Rating   | Remove from UI             | Extend DB schema         | FE-02, BE-01    | Shreya | ✅ Decided — keep phone, remove rating            |
| D2  | Goods Receipt page    | Info-only (receive via PO) | Dedicated GR form        | SCM UX          | —      | GR form                                          |
| D3  | Order-to-Cash scope   | Skip for MVP               | Build Sales Order module | BE-02, INT-09   | —      | ✅ Decided — built (BE-02 + FE-09)                |
| D4  | Vendor portal / email | Defer to Phase 2           | Build now                | BE-07, BE-08    | —      | ✅ Portal built (BE-08); email still stub (BE-07) |
| D5  | BI dashboard builder  | KPI page only              | Drag-drop builder        | Large FE effort | —      | ✅ Decided — shipped (`bi-workspace.tsx`)         |


---



## 11. PDF Requirement → Task Mapping


| PDF  | Description                     | Remaining          | Status                                      |
| ---- | ------------------------------- | ------------------ | ------------------------------------------- |
| F-02 | GL — period close, intercompany | FE-06              | ⚠️ Partial (BE-03 ✅, BE-04 ✅, journal UI ✅) |
| F-03 | AP/AR — OCR, payment runs       | FE-08              | ⚠️ Partial (FE-09 ✅, aging report ✅)        |
| F-05 | SCM — vendor portal, notify     | FE-01–FE-05, BE-07 | ⚠️ Partial (BE-08 portal ✅; email stub)     |
| F-06 | AI demand forecasting           | FE-14, INT-06      | ⚠️ Partial (BE-09 ✅, ml-service ✅)          |
| F-07 | PM — Gantt, milestone alerts    | INT-02–INT-04      | ⚠️ Partial (FE-13 ✅)                        |
| F-08 | BI — dashboard builder          | —                  | ✅ Done (BE-10 + bi-workspace)               |
| F-09 | Audit & GDPR                    | GDPR export/erase  | ⚠️ Partial (BE-06 ✅, audit API live)        |
| F-10 | Notification engine             | BE-07 (FE-15 ✅)    | ⚠️ Partial (in-app ✅; email stub)           |
| §9   | Submission deliverables         | PLAT-01, PLAT-02   | ❌ Open                                      |


---

---



## 12. Codebase Inventory (3 July 2026)


| Item                   | Count | Location                                                                                            |
| ---------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Dashboard routes       | 27    | `apps/web/src/app/(dashboard)/**/page.tsx`                                                          |
| API modules            | 11    | `auth`, `tenant`, `finance`, `hr`, `scm`, `pm`, `bi`, `forecast`, `audit`, `notification`, `health` |
| BI frontend components | 12    | `apps/web/src/components/bi/`                                                                       |
| BI backend files       | 8     | `apps/api/src/bi/`                                                                                  |
| ML service             | 1     | `apps/ml-service/main.py` + `Dockerfile`                                                            |
| Orphan mock files      | 3     | `lib/mock/hr.ts`, `it.ts`, `pm-v2.ts` (no imports; safe to delete)                                  |
| GitHub Actions CI      | 0     | No `.github/workflows/` directory                                                                   |




### Key stubs still in code


| File                                     | Line  | Issue                                                   |
| ---------------------------------------- | ----- | ------------------------------------------------------- |
| `scm/vendors/page.tsx`                   | 41–43 | `handleAddVendor` → `console.log("Add Vendor clicked")` |
| `finance/accounts/page.tsx`              | 90    | "New Account" `<Button>` has no `onClick` handler       |
| `scm/inventory/page.tsx`                 | —     | Raise PR → `POST /scm/requisitions/from-low-stock` (INT-01 ✅) |
| `finance/invoices/page.tsx`              | —     | Approve list only; `financeApi.uploadInvoice` not used  |
| `notification/channels/email.channel.ts` | —     | Log-only stub (inherits BE-07)                          |


---

*Update this document when a task moves from Partial → Done. Cross-reference* `docs/project_status.md` *for detailed PDF requirement mapping.*