# Amdox ERP — Team Assignment Document

> **Sources:** Amdox Web.pdf · amdox-erp-detailed-2.html · Live codebase review (July 2026)  
> **Audience:** Project Manager — assign to 6 team members (no names, tasks only)  
> **Last updated:** 2 July 2026

---

## 1. Tag Legend


| Tag Type      | Tags                                                                                                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Module**    | `#auth` `#tenant` `#finance-gl` `#finance-ap` `#finance-ar` `#hr` `#scm` `#pm` `#bi` `#forecast` `#notifications` `#audit` `#gdpr` `#infra` |
| **Layer**     | `#frontend` `#backend` `#fullstack` `#integration` `#devops`                                                                                |
| **Work type** | `#form` `#api-wire` `#integration-test` `#cleanup` `#spec-gap` `#decision-needed`                                                           |
| **Priority**  | `#P0` Demo/submission blocker · `#P1` Core flow · `#P2` Polish · `#P3` Post-MVP                                                             |


**Assignment:** Use the **Assigned To** column in each task table below. Suggested default slots are in §8 — replace with team member names when ready.

---



## 2. Executive Snapshot


| Area                          | Status        | Gap summary                                           |
| ----------------------------- | ------------- | ----------------------------------------------------- |
| Auth & Multi-tenant           | ✅ Mostly done | Keycloak OIDC, tenant context, create-tenant          |
| Finance GL/AP                 | ⚠️ Partial    | List pages wired; create/post forms missing           |
| Finance AR / Order-to-Cash    | ⚠️ Partial    | Aging live; no Sales Order module; no AR UI           |
| HR & Payroll                  | ⚠️ Partial    | CRUD/run works; payslip PDF not wired                 |
| SCM                           | ⚠️ Partial    | PO flow works; vendor/product/inventory forms missing |
| Project Management            | ✅ Strong      | Wizard, material requests, budget bridges done        |
| BI / Forecast / Notifications | ⚠️ Partial    | KPI dashboard exists; builder & forecast UI missing   |
| Platform / Deploy             | ❌ Not started | Live demo URL, CI/CD, security hardening              |


---



## 3. Master Task List — Frontend


| ID    | Tags                                          | Task                                 | Acceptance criteria                                                                          | Priority | Assigned To |
| ----- | --------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------- | -------- | ----------- |
| FE-01 | `#frontend` `#scm` `#form`                    | Vendor CRUD modal on `/scm/vendors`  | Add/Edit/Delete via `POST/PATCH/DELETE /scm/vendors`; refresh table; remove console.log stub | P0       | shraddha    |
| FE-02 | `#frontend` `#scm` `#decision-needed`         | Resolve Vendor Phone/Rating mismatch | Remove UI columns OR backend adds fields to `Vendor` model remove rating , keep phone no.    | P1       | shraddha    |
| FE-03 | `#frontend` `#scm` `#form` `#api-wire`        | Product catalog admin page           | CRUD for `POST/PATCH/DELETE /scm/products`                                                   | P1       |             |
| FE-04 | `#frontend` `#scm` `#form` `#api-wire`        | Inventory admin forms                | Warehouse, stock movement, reorder rules via `/scm/inventory/*`                              | P1       |             |
| FE-05 | `#frontend` `#scm` `#api-wire`                | Wire "Raise PR" on inventory page    | Call backend reorder/requisition (not local state only)                                      | P1       |             |
| FE-06 | `#frontend` `#finance-gl` `#form` `#api-wire` | New GL Account form                  | "New Account" → modal → `POST /finance/gl/accounts`                                          | P0       |             |
| FE-07 | `#frontend` `#finance-gl` `#form` `#api-wire` | Create Journal Entry form            | Save/Post → `POST /finance/gl/journal-entries`                                               | P0       |             |
| FE-08 | `#frontend` `#finance-ap` `#form` `#api-wire` | Invoice OCR upload UI                | File upload → `POST /finance/ap/invoices/upload`                                             | P1       |             |
| FE-09 | `#frontend` `#finance-ar` `#form` `#api-wire` | AR invoice + payment UI              | Forms for `POST /finance/ar/invoices` and `POST /finance/ar/payments`                        | P1       |             |
| FE-10 | `#frontend` `#hr` `#form` `#api-wire`         | Payslip PDF download                 | Wire modal to `GET /hr/payroll/:payslipId/payslip`                                           | P1       |             |
| FE-11 | `#frontend` `#hr` `#form` `#api-wire`         | Employee edit/delete actions         | Row actions → `PATCH/DELETE /hr/employees/:id`                                               | P1       |             |
| FE-12 | `#frontend` `#hr` `#form`                     | Department admin page                | CRUD for `/hr/departments`                                                                   | P2       |             |
| FE-13 | `#frontend` `#pm` `#form`                     | Project edit / status change UI      | Edit metadata; lifecycle Planning → Active → Closed                                          | P2       |             |
| FE-14 | `#frontend` `#forecast` `#api-wire`           | Forecast train button on inventory   | Per-SKU → `POST /forecast/products/:id/train`                                                | P2       |             |
| FE-15 | `#frontend` `#notifications` `#api-wire`      | Mark notification as read            | Wire `PATCH /notifications/:id/read`                                                         | P2       |             |
| FE-16 | `#frontend` `#cleanup`                        | Replace hardcoded `localhost:3001`   | Use `apiClient` / `hr-api.ts` across HR/home/payroll pages                                   | P1       |             |
| FE-17 | `#frontend` `#cleanup`                        | Remove dead mock imports             | Clean `@/lib/mock/hr` and `@/lib/mock/it` where APIs exist                                   | P2       |             |
| FE-18 | `#frontend` `#hr`                             | Payroll period selector              | Replace hardcoded `2026-06` with month picker                                                | P2       |             |


---



## 4. Master Task List — Backend


| ID    | Tags                                    | Task                               | Acceptance criteria                                               | Priority | Assigned To                               |
| ----- | --------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- | -------- | ----------------------------------------- |
| BE-01 | `#backend` `#scm` `#decision-needed`    | Vendor schema alignment            | Support FE-02: add **phone**/rating OR document out-of-scope      | P1       | Shreya- schema : vender table , add phone |
| BE-02 | `#backend` `#finance-ar` `#spec-gap`    | Order-to-Cash module (Sales Order) | Sales order → AR invoice → payment reconciliation (PDF Stage 7–9) | P1       |                                           |
| BE-03 | `#backend` `#finance-gl`                | Fiscal period close admin          | Verify `POST /finance/gl/fiscal-periods/open` and `.../close`     | P2       |                                           |
| BE-04 | `#backend` `#finance-gl` `#integration` | Intercompany transfer flow         | End-to-end verify multi-entity transfers (PDF F-02)               | P2       |                                           |
| BE-05 | `#backend` `#scm` `#integration`        | FIFO cost layer                    | Verify/implement costing on goods receipt                         | P2       |                                           |
| BE-06 | `#backend` `#audit`                     | Expand audit event coverage        | Extend beyond 4 events to HR/SCM/GL mutations                     | P2       |                                           |
| BE-07 | `#backend` `#notifications` `#spec-gap` | Real email/webhook delivery        | AWS SES / HMAC webhooks for vendor PO (PDF F-05, F-10)            | P3       |                                           |
| BE-08 | `#backend` `#scm` `#spec-gap`           | Vendor external portal             | Supplier-facing login/API (PDF Day 12)                            | P3       |                                           |
| BE-09 | `#backend` `#forecast` `#integration`   | ML service ops                     | Health-check NestJS → FastAPI; verify Prophet in Docker           | P2       |                                           |
| BE-10 | `#backend` `#bi`                        | BI dashboard builder API           | Stabilize widget CRUD for future FE builder                       | P2       |                                           |
| BE-11 | `#backend` `#auth`                      | RBAC enforcement audit             | Verify `@Roles()` on sensitive endpoints; role matrix doc         | P2       |                                           |


---



## 5. Cross-Module Integrations


| ID     | Tags                        | Flow                           | What to verify / finish                                      | Priority | Assigned To |
| ------ | --------------------------- | ------------------------------ | ------------------------------------------------------------ | -------- | ----------- |
| INT-01 | `#integration` `#fullstack` | Procure-to-Pay                 | Low stock → PR/PO → GR → 3-way match → GL journal            | P0       |             |
| INT-02 | `#integration` `#fullstack` | PM → SCM → Finance (materials) | Material request → requisition → PO → PM budget update       | P0       |             |
| INT-03 | `#integration` `#fullstack` | PM ↔ HR (people)               | Resource allocation + utilisation heatmap from real data     | P1       |             |
| INT-04 | `#integration` `#fullstack` | PM ↔ Finance (labor cost)      | Payroll bridge → PM actualAmount → budget.overrun alert      | P1       |             |
| INT-05 | `#integration` `#fullstack` | HR → Finance (payroll)         | Payroll run → `payroll.completed` → GL salary journal        | P1       |             |
| INT-06 | `#integration` `#fullstack` | SCM → Forecasting              | Historical data feeds ML train; forecast on inventory        | P2       |             |
| INT-07 | `#integration` `#fullstack` | All → Notifications            | PO created, invoice approved, budget overrun → in-app alerts | P2       |             |
| INT-08 | `#integration` `#fullstack` | All → Audit                    | Key mutations in Settings → Audit Logs with hash chain       | P2       |             |
| INT-09 | `#integration` `#spec-gap`  | Order-to-Cash                  | Blocked until BE-02 + FE-09                                  | P2       |             |


---



## 6. Platform & Submission Tasks


| ID      | Tags                | Task                      | Notes                                   | Priority | Assigned To |
| ------- | ------------------- | ------------------------- | --------------------------------------- | -------- | ----------- |
| PLAT-01 | `#devops`           | Deploy live demo URL      | 30% of submission weight                | P0       |             |
| PLAT-02 | `#devops`           | Record 5–7 min demo video | Finance → SCM → HR → PM walkthrough     | P0       |             |
| PLAT-03 | `#devops`           | GitHub Actions CI         | Lint + build + API smoke test           | P1       |             |
| PLAT-04 | `#backend` `#infra` | Security hardening        | Helmet, rate limiting, validation audit | P1       |             |
| PLAT-05 | `#devops`           | K8s / observability / PWA | Post-MVP per PDF spec                   | P3       |             |


---



## 7. Forms Checklist — Model by Model


| Model / Screen              | Backend API | Frontend Form | Status                       | Task ID    | Assigned To |
| --------------------------- | ----------- | ------------- | ---------------------------- | ---------- | ----------- |
| Vendor                      | ✅ CRUD      | ❌             | Stub (console.log)           | FE-01      |             |
| Product                     | ✅ CRUD      | ❌             | No page                      | FE-03      |             |
| Warehouse / Stock / Reorder | ✅           | ❌             | Missing                      | FE-04      |             |
| Purchase Order              | ✅           | ⚠️            | Create from requisition only | OK for MVP |             |
| Goods Receipt               | ✅ via PO    | ⚠️            | Placeholder page             | Optional   |             |
| AP Invoice (OCR)            | ✅           | ⚠️            | Approve only                 | FE-08      |             |
| GL Account                  | ✅           | ❌             | Button stub                  | FE-06      |             |
| Journal Entry               | ✅           | ⚠️            | UI only, not saving          | FE-07      |             |
| AR Invoice / Payment        | ✅           | ❌             | No UI                        | FE-09      |             |
| Employee                    | ✅ create    | ⚠️            | No edit/delete               | FE-11      |             |
| Department                  | ✅           | ❌             | Dropdown only                | FE-12      |             |
| Leave Request               | ✅           | ✅             | Done                         | —          |             |
| Attendance                  | ✅           | ⚠️            | Admin list only              | Optional   |             |
| Payroll Run                 | ✅           | ✅             | Done                         | —          |             |
| Payslip PDF                 | ✅           | ❌             | Mock modal                   | FE-10      |             |
| Project                     | ✅ create    | ⚠️            | No edit                      | FE-13      |             |
| Task / Milestone / Budget   | ✅           | ✅             | Done                         | —          |             |
| Material Request            | ✅           | ✅             | Done                         | —          |             |
| Tenant / SSO Settings       | ⚠️          | ⚠️            | Mixed mock + real            | FE-17      |             |
| GDPR DSR                    | ✅           | ⚠️            | Settings tab                 | QA         |             |
| Forecast Train              | ✅           | ❌             | No UI                        | FE-14      |             |
| BI Custom Dashboard         | ✅ CRUD      | ❌             | KPI page only                | P3         |             |


---



## 8. Assignment for 6 Team Slots


| Slot       | Assigned To | Focus area           | Task IDs                                 | Layer               |
| ---------- | ----------- | -------------------- | ---------------------------------------- | ------------------- |
| **Slot 1** |             | SCM & Inventory UI   | FE-01, FE-02, FE-03, FE-04, FE-05, FE-14 | Frontend            |
| **Slot 2** |             | Finance UI           | FE-06, FE-07, FE-08, FE-09               | Frontend            |
| **Slot 3** |             | HR & API cleanup     | FE-10, FE-11, FE-12, FE-16, FE-17, FE-18 | Frontend            |
| **Slot 4** |             | PM & Notifications   | FE-13, FE-15, BI polish                  | Frontend            |
| **Slot 5** |             | Backend integrations | BE-01, BE-02, BE-05, BE-06, BE-09, BE-11 | Backend             |
| **Slot 6** |             | QA, E2E & DevOps     | INT-01–INT-08, PLAT-01–PLAT-04           | Full-stack / DevOps |


---



## 9. Sprint Plan


| Sprint       | Priority | Task IDs                                      | Goal                                                                    | Assigned To |
| ------------ | -------- | --------------------------------------------- | ----------------------------------------------------------------------- | ----------- |
| **Sprint 1** | P0       | FE-01, FE-06, FE-07, INT-01, PLAT-01, PLAT-02 | Demo-ready: vendor form, GL forms, Procure-to-Pay E2E, live URL + video |             |
| **Sprint 2** | P1       | FE-03–FE-05, FE-08–FE-11, INT-02–INT-05       | Core completeness: SCM admin, AP OCR, AR, HR polish, PM bridges         |             |
| **Sprint 3** | P2       | BE-02, FE-14, BE-06, PLAT-03, PLAT-04         | Spec depth: Order-to-Cash, forecast, audit, CI + security               |             |


---



## 10. PM Decisions Required


| #   | Decision              | Option A                   | Option B                 | Impacts              | Owner   |
| --- | --------------------- | -------------------------- | ------------------------ | -------------------- | ------- |
| D1  | Vendor Phone/Rating   | Remove from UI             | Extend DB schema         | FE-02, BE-01         | done    |
| D2  | Goods Receipt page    | Info-only (receive via PO) | Dedicated GR form        | SCM UX               | GR form |
| D3  | Order-to-Cash scope   | Skip for MVP               | Build Sales Order module | BE-02, FE-09, INT-09 |         |
| D4  | Vendor portal / email | Defer to Phase 2           | Build now                | BE-07, BE-08         |         |
| D5  | BI dashboard builder  | KPI page only              | Drag-drop builder        | Large FE effort      |         |


---



## 11. PDF Requirement → Task Mapping


| PDF Requirement | Description                        | Remaining Task IDs         | Assigned To |
| --------------- | ---------------------------------- | -------------------------- | ----------- |
| F-02            | GL — period close, intercompany    | FE-06, FE-07, BE-03, BE-04 |             |
| F-03            | AP/AR — OCR, payment runs          | FE-08, FE-09               |             |
| F-05            | SCM — vendor portal, vendor notify | FE-01–FE-05, BE-07, BE-08  |             |
| F-06            | AI demand forecasting              | FE-14, BE-09, INT-06       |             |
| F-07            | PM — Gantt, milestone alerts       | FE-13, INT-02–INT-04       |             |
| F-08            | BI — dashboard builder             | KPI done; builder = P3     |             |
| F-09            | Audit & GDPR                       | BE-06, INT-08              |             |
| F-10            | Notification engine                | FE-15, BE-07               |             |
| §9              | Submission deliverables            | PLAT-01, PLAT-02           |             |


---

*Update this document when a task moves from Partial → Done. Cross-reference* `docs/project_status.md` *for detailed evidence.*