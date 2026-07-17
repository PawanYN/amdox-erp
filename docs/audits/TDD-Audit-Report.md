# TDD Compliance Audit — Amdox ERP vs. "AI-Powered Cloud ERP Suite" (AMX-ERP-2026-04)

**Audit date:** 11 July 2026 · **Scope:** entire monorepo (`apps/api`, `apps/web`, `apps/ml-service`, `packages/db`, `infra/`, CI) audited line-by-line against the TDD (`docs/Amdox Web.pdf`), covering F-01→F-12, the 28-day plan, the mandated design patterns, and the security framework.

> **STATUS UPDATE — end of 11 July (sprint Day 1):** the app is **live at https://erp.92-4-86-3.sslip.io**, the payroll double-payslip bug is fixed and proven, 22 unit tests + a CI job exist, and the full UX sprint (D1–D10) is done. Findings below are kept as originally written for the record; every resolved one carries a **[FIXED 11 July]** marker. Still open: demo video (Task G), and the post-deadline roadmap (Tasks E, F, observability, PWA).

---

## Part 1 — The Concept: One Company at the Center

The TDD describes a **multi-tenant SaaS ERP**: each _tenant_ is one company. Inside that company sit six kinds of users, each owning one slice of the business, and the whole point of an ERP is that **their data flows into each other automatically** instead of living in silos ("eliminate data silos across 6+ legacy systems").

### 1.1 The departments and what each one owns

| Department (TDD target user) | Owns                                                                                                                            | Their module(s)        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Finance Teams**            | The books: chart of accounts, journal entries, AP (money we owe vendors), AR (money customers owe us), fiscal periods, payments | F-02 GL, F-03 AP/AR    |
| **HR & Payroll Teams**       | People: employees, contracts, departments, leave, attendance, payroll, statutory compliance                                     | F-04                   |
| **Supply Chain Managers**    | Things: vendors, products, warehouses, stock, purchase requisitions → POs → goods receipts, reorder automation                  | F-05                   |
| **Project Managers**         | Work: projects, milestones, tasks (Gantt), people allocation, material needs, budgets                                           | F-07                   |
| **C-Suite / Executives**     | The overview: dashboards, KPIs, scheduled reports, AI forecasts                                                                 | F-06, F-08             |
| **IT Administrators**        | The platform: tenant config, SSO, roles, audit logs, GDPR, notification/webhook config                                          | F-01, F-09, F-10, F-11 |

### 1.2 How they connect — the real-world story

The TDD encodes the connections in Day 14's smoke test: **"PO → inventory → AP invoice → GL journal entry."** Here is the full life of one purchase, as a company would actually live it:

1. **A Project Manager needs material.** Working on "Factory Line Upgrade", the PM requests 50 motors from within the Projects module. The PM does _not_ create a purchase order — that is Supply Chain's job. The request crosses the department boundary as an event.
2. **Supply Chain turns the request into a Purchase Requisition** (who asked, for which project, which products, estimated cost). A supply-chain manager reviews it and creates a **Purchase Order** against a chosen vendor. Separately, the system itself raises requisitions when stock falls below a reorder threshold — no human needed.
3. **The PO is approved** by a Manager/TenantAdmin (RBAC — a Viewer cannot). On approval the **vendor is notified** by email and webhook, and can acknowledge the PO and post shipment notes through the **vendor portal**.
4. **Goods arrive.** A warehouse user records a **Goods Receipt** against the PO. Instantly: stock levels rise in that warehouse, a stock movement is logged, and a **FIFO cost layer** is created (that batch's quantity at that batch's price — so later consumption is costed accurately, oldest first).
5. **Finance takes over automatically.** The goods receipt triggers an **AP invoice**, which goes through the **3-way match**: does the Invoice match the PO (vendor, amount) and the GR (goods actually received)? Within tolerance → **auto-approved in seconds** (the TDD's "< 30s" criterion). Outside tolerance → parked for **manual Finance approval**. This is the control that stops the company paying for things it never ordered or never received — and critically, _Supply Chain cannot pay itself_: approval and payment live in Finance.
6. **The General Ledger updates itself.** Invoice approval posts a balanced journal entry (Dr Inventory 1300 / Cr Accounts Payable 2000). When Finance later runs a **payment run**, cash goes out (Dr AP 2000 / Cr Cash 1000). Every posting is double-entry validated and blocked if the fiscal period is closed.
7. **The project feels the cost.** Because the PO carried the `projectId`, the approved invoice amount lands in the **project's budget actuals** — and if actuals exceed plan by >10%, the PM gets an **overrun alert**.
8. **Everyone gets told.** Each step (PO created, goods received, invoice approved, budget overrun) emits an event that the **Notification Engine** fans out: in-app (live SSE), email, SMS, webhook — respecting each user's per-channel preferences.
9. **Everything is remembered.** Every mutation is written to a **hash-chained audit log** (tamper-evident), and GDPR data-subject requests can be raised and fulfilled by IT admins.

The other two company-wide loops work the same way:

- **Hire-to-pay (HR → Finance):** HR onboards an employee with a contract → attendance clock-in/out accumulates overtime → payroll run computes gross-to-net for everyone (async, in batches) → payslip PDFs generated → **`payroll.completed` posts salary expense to the GL** (Dr Salary Expense 6000 / Cr Payroll Payable 2100) and updates project labor costs. Leave requests flow through a state machine where only the _direct manager, HR, or admin_ can approve.
- **Order-to-cash (Sales → Finance):** a sales order/AR invoice is issued → GL posts revenue (Dr AR 1200 / Cr Revenue 4000) → customer payment received → GL posts cash (Dr Cash 1000 / Cr AR 1200) → the **aging report** shows who is overdue.
- **Demand loop (SCM → AI → SCM):** sales/stock history feeds the **ML service** (Prophet for normal SKUs, LSTM for high-volume ones) → SKU-level demand forecasts (cached, retrained weekly) → informs purchasing decisions and reorder settings.

**Key architectural principle the TDD demands and the code follows:** departments talk through **domain events**, not direct calls. PM never writes into SCM tables; SCM never approves invoices. Each module can even be licensed on/off per tenant (`ModuleGuard`).

---

## Part 2 — What Is Properly Implemented (verified in code)

### F-01 Multi-Tenant Auth (SSO) — ✅ Implemented (with deviations)

- Keycloak OIDC login; `KeycloakStrategy` maps the SSO subject to a local user + tenant + roles (`apps/api/src/auth/strategies/keycloak.strategy.ts`).
- The exact four TDD roles exist: **SuperAdmin, TenantAdmin, Manager, Viewer**, enforced by `RolesGuard` on every controller.
- Tenant isolation: `TenantContextInterceptor` injects `tenantId` via AsyncLocalStorage; **every** Prisma query filters by `tenantId` — and CI has a **custom "Tenant-scoping audit" job** that fails the build if a query is missing the filter. This goes beyond the TDD.
- Per-tenant **module licensing** (`ModuleGuard` + `erp-modules.ts`) — an extra layer the TDD didn't ask for but that fits the SaaS model.
- ~~⚠️ single shared realm~~ **Correction (11 July, found during deployment):** realm-per-tenant IS implemented — `tenant.service.ts` programmatically creates a dedicated Keycloak realm (named by tenant slug, with realm roles) for every new tenant, and the web login picks the realm from the tenant slug. The TDD's "realm-per-tenant strategy" is met.
- ⚠️ Remaining deviation: MFA and refresh-token rotation are delegated to Keycloak configuration rather than demonstrated in-app.

  [In simple words: Each client company really does get its own separate login space — the earlier version of this audit got that wrong. What's still true: extra login security (like OTP codes) is left to the login server's settings instead of being switched on and shown working.]

### F-02 Financial Ledger — ✅ Implemented (multi-currency half-done)

`apps/api/src/finance/gl/gl.service.ts` is the strongest module:

- **Double-entry enforced**: `createJournalEntry` rejects any entry where ΣDebits ≠ ΣCredits ("zero unbalanced entries" ✓).
- **Period close enforced**: posting into a locked `FiscalPeriod` throws; periods auto-open monthly.
- **Auto-posting listeners** with correct accounting and idempotency guards (duplicate check on `sourceModule + sourceId`):
  - `invoice.approved` → Dr 1300 Inventory / Cr 2000 AP
  - `invoice.issued` (AR) → Dr 1200 AR / Cr 4000 Revenue
  - `payment.received` → Dr 1000 Cash / Cr 1200 AR
  - `payment.made` → Dr 2000 AP / Cr 1000 Cash
  - `payroll.completed` → Dr 6000 Salary Expense / Cr 2100 Payroll Payable
- **Intercompany transfers** create balanced JEs ✓.
- **FX rates auto-fetched** daily from the ECB feed (cron, per-tenant `ExchangeRate` rows) ✓ …
- ❌ …but **the rates are never consumed**: no conversion happens anywhere (postings, invoices, reports). Documents have a `currencyId` column that is stored but not used in math. Multi-currency is _plumbed, not functional_.

  [In simple words: The system downloads the daily currency exchange rates correctly every day, but then never actually uses them. If an invoice comes in dollars and the books are in rupees, nothing converts the amount. So "multi-currency support" looks ready on the surface but does not really work yet.]

- ⚠️ Journal entries are created directly as `POSTED` (no draft→post workflow, no reversal entries) — acceptable simplification, worth knowing.

  [In simple words: Accounting entries go straight into the final books the moment they are created. There is no "draft" step where an accountant can review before it becomes official, and no clean way to reverse a wrong entry later.]

### F-03 AP/AR Automation — ✅ Implemented (matching is header-level)

- **Invoice OCR** (`ocr.service.ts`): real AWS **Textract AnalyzeExpense** integration (summary fields + line items + per-field confidence) with a mock fallback when no AWS credentials — the confidence score is stored on the invoice. Default mode is mock, so the "≥95% accuracy" criterion is only _demonstrated_, not proven.
- **3-way match** (`invoice-matching.service.ts` + inline in `ap.service.ts`): verifies PO exists, vendor matches, GR belongs to the PO, and invoice total is within **2% tolerance** of the PO total → **auto-approve synchronously** (meets "< 30s"). Manual approval endpoint as fallback ✓.
- ❌ The match is **header-total only** — the code itself says "In a real system, we'd check line-by-line quantities". Quantity-level matching against the GR is not done (and GR doesn't record received-quantity per line — see F-05).

  [In simple words: Before paying a vendor bill, the system only checks the bill's TOTAL amount against the purchase order total (allowing 2% difference). It does not check item by item. So if the vendor bills us for the wrong items — but the total price happens to match — the system would still approve the bill automatically.]

- **Payment runs** (`runPaymentBatch`): batch-settles approved invoices, per-invoice failure isolation, `PaymentRun` grouping, partial-payment states (`PARTIALLY_PAID`) ✓.
- **AR**: customer invoices, payment recording, **aging report** ✓. Plus a sales-order module (order-to-cash entry point).
- **Outbox pattern** used exactly as the TDD demands: approval/payment events written to `OutboxEvent` in the same DB transaction, consumed by a BullMQ worker (`finance/automation/outbox.processor.ts`).

### F-04 HR & Payroll — ✅ Implemented (saga compensation missing)

- Employee lifecycle: CRUD + employment **contracts**, departments, `managerId` hierarchy, soft-delete ✓.
- **Leave state machine** (`leave-state-machine.ts`): PENDING → APPROVED/REJECTED only; only the **direct manager, an HR approver, or TenantAdmin** may transition ✓ (the TDD's approval workflow).
- **Attendance**: clock-in/out with overtime-minute computation ✓.
- **Payroll engine** (`payroll.processor.ts` + `payroll-deductions.ts`) — the algorithm:
  1. HR triggers a run → job enqueued on the **BullMQ `payroll` queue** (async, "10k employees" scale).
  2. Employees processed in **chunks of 500** (memory-safe), joining the active contract for the period.
  3. Overtime pay = overtime hours × (salary/160) × **1.5**.
  4. **Gross-to-net**: PF (12% employee/employer, on basic), ESI (0.75%/3.25%, only under the ₹21,000 ceiling), Professional Tax, Labour Welfare Fund, gratuity accrual (employer-side), and **TDS from tenant-configurable tax slabs** — all rates come from the per-tenant Statutory Compliance config ✓ ("configurable tax slabs, statutory deductions").
  5. **Payslip PDF** per employee (pdfkit) uploaded to object storage (MinIO/S3) ✓.
  6. Run marked COMPLETED with `totalNetPay` → `payroll.completed` event → GL posting + labor-cost bridge into project budgets.
- ❌ **The TDD's payroll saga is not implemented.** The runbook says "Saga compensates: revert partial calculations" — but on a mid-run crash the code only marks the run FAILED and rethrows. Worse, a BullMQ **retry restarts from chunk 0 and re-inserts payslips already written** (no `skipDuplicates`, no per-run uniqueness check) → duplicate payslips and inflated `totalNetPay`. This is the most important correctness bug found in this audit.

  [In simple words: This is the most serious bug found. If a salary run crashes halfway (say after paying 300 of 600 employees), the system automatically retries — but it starts again from employee number 1 and does NOT remove the salary slips it already created in the first attempt. Result: some employees get TWO salary slips, and the company's total salary figure comes out wrong. The plan required an "undo half-done work before retrying" mechanism, which was never built. Fix this before trusting payroll.]

  **✅ [FIXED 11 July — Task A]** The processor now deletes the failed attempt's payslips before reprocessing (the compensation step). Proven with a live kill-and-retry test: before the fix, 21 employees → 42 payslips; after, exactly 21 with totals reconciling. Permanent proof script: `pnpm --filter api verify:payroll-retry`.

- ⚠️ Org chart is not the TDD's "recursive CTE in Postgres" — the tree is assembled from `managerId` client-side. Works for demo sizes.

  [In simple words: The company organisation chart works fine, but it is built inside the user's browser instead of by the database, which is what the plan asked for. For a small or medium company this is no problem; for a very large company with thousands of employees it may become slow.]

- ✅ **Correction (post-audit):** Leave **accrual rules** (Day 10) are now implemented — `LeaveAccrualService` + `LeaveAccrualScheduler` grant each active employee `leaveType.accrualRate` additional days per leave type on a monthly cron (`EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT`), on top of the leave request/approval workflow that already worked.

  [In simple words: Employees can apply for leave and managers can approve or reject it, and the system now also automatically adds earned leave to each employee's balance once a month, based on that leave type's configured accrual rate.]

### F-05 Supply Chain & Inventory — ✅ Implemented

- Full **requisition → PO → goods receipt** workflow ✓, with two requisition sources: PM material requests (event-driven) and **low-stock automation**.
- **PO lifecycle** with approval (role-gated), and on approval the **vendor is notified via email and webhook** ✓ (the exact F-05 acceptance criterion).
- **Vendor portal**: portal-key auth, PO acknowledgement, expected-delivery/shipment notes ✓.
- **Goods receipt** (in one transaction): stock movement + stock level upsert + **FIFO `InventoryCostLayer`** creation; outbound movements **consume layers oldest-first** (`consumeFifoCostLayers`) ✓ — this is real FIFO costing, not a label.
- **Reorder automation**: per-product `ReorderRule` (threshold + reorder qty), automated checks, duplicate-suppression (won't raise a second requisition while one is open) ✓.
- ⚠️ Deviations: reorder raises a **requisition**, TDD literally says "PO draft" (defensible — a requisition is the more correct document). `receiveGoods` always receives the **full PO** — the `PARTIALLY_RECEIVED` status exists in the schema but is unreachable, and GR lines/quantities aren't recorded (this is also what blocks line-level 3-way matching).

  [In simple words: Two things. (1) When stock runs low, the system creates a purchase *request* instead of a draft purchase *order* — a small wording difference from the plan, and actually the more proper business practice. (2) More importantly: when goods arrive from a vendor, the system always assumes the ENTIRE order arrived. There is no way to record "only half the boxes came today, the rest comes next week", even though the plan intended to support that.]

### F-06 AI Demand Forecasting — ✅ Implemented

- Python **FastAPI** service (`apps/ml-service/main.py`): `/predict`, `/health`, model-version endpoint. **Prophet** for normal SKUs; a real **PyTorch LSTM** kicks in for high-volume SKUs (≥60 history points, ≥500 total volume) ✓ — matches "LSTM as secondary model for high-volume SKUs" precisely.
- NestJS forecast module: predictions **cached in Redis**, cache invalidated on retrain, **weekly retraining** scheduled through BullMQ repeatable jobs ✓.
- MAPE is computed and returned per prediction; ⚠️ the "<12% on 90-day horizon" target is not monitored/enforced anywhere, and there's no MLflow (file/DB-based versioning instead — the TDD explicitly allows this).

  [In simple words: The AI forecast tells you how accurate it thinks it is, but nobody is watching that number. The plan set an accuracy target (less than 12% error), yet if the model quietly becomes less accurate over time, no alert fires and nothing checks it.]

### F-07 Project Management — ✅ Implemented

- Projects, milestones (overdue scheduler + alerts ✓), tasks with dependencies and **DAG cycle validation** (`wouldCreateCycle`) ✓, Gantt UI, resource allocation with **utilisation heatmap** (>40h/week = over-allocated) ✓.
- **Budget tracking**: planned vs actual with variance; **overrun flagged at actual > 110% of plan** — exactly the TDD's "alert when actual > budget by 10%" ✓. Actuals are fed automatically from approved project-linked AP invoices and payroll labor costs (the PM ↔ Finance bridges).
- Material requests to SCM + the new read-back **Items view** (project-linked requisitions with fulfillment status).

### F-08 Business Intelligence — ✅ Implemented (builder is basic)

- Dashboards + widget configuration persisted in Postgres ✓, KPI/drill-down data service, **scheduled reports generating real PDF (pdfkit) and Excel (exceljs) files** on a scheduler ✓.
- ⚠️ "Drag-and-drop dashboard builder" is a stored layout, not a full drag-drop editor; email delivery of finished reports depends on notification config.

  [In simple words: Dashboards can be created and their arrangement is saved, but you cannot yet freely drag charts around with the mouse to rearrange them, which is what the plan promised. Also, the scheduled PDF/Excel reports are generated fine, but whether they reach people's inboxes depends on email being configured.]

### F-09 Audit & Compliance — ✅ Implemented

- Global audit interceptor + event listener persist every mutation; **SHA-256 hash chaining with a GENESIS anchor and a chain-verification routine** (`hash-chain.service.ts`) — the TDD's "tamper detection via hash chaining" ✓.
- **GDPR module**: data-subject requests (create/fulfill/export download) + consent management ✓.
- ⚠️ Stored in regular Postgres, not TimescaleDB append-only.

  [In simple words: The audit history (the record of who did what and when) is kept in the normal database instead of the special history-optimised database named in the plan. The tamper-protection is still fully in place, so this is only a minor deviation.]

### F-10 Notification Engine — ✅ Implemented (exceeds spec)

- Channels: **in-app (persisted + live SSE)**, **email** (Nodemailer/Mailpit dev, SMTP prod), **SMS** (webhook provider), **webhook (HMAC-signed)** ✓.
- **Per-user, per-event, per-channel preferences** (opt-out model) ✓.
- BullMQ dispatch with **5 retry attempts + exponential backoff** (TDD asked 3 — exceeds), failed jobs kept as a **dead-letter view in Bull Board** at `/admin/queues` ✓.
- Read/unread filters + delete (added July 2026).

### F-11 API Gateway & Webhooks — ✅ Implemented

- OpenAPI/Swagger at `/api-docs`; **global `api/v1` prefix** (versioning) ✓; health endpoints ✓.
- **GraphQL (Apollo)** module with auth guard for BI-style queries ✓.
- Outbound **webhook subscriptions with HMAC signatures** ✓.
- Elasticsearch-backed search module (graceful degradation if ES is down).

### F-12 Offline / PWA — ❌ NOT IMPLEMENTED

No service worker, no manifest, no offline caching, no sync-on-reconnect. This is the only F-requirement with zero implementation.

[In simple words: The plan asked for the app to keep working partly even without internet — like a mobile app that shows your data offline and syncs when the connection returns. None of this exists. If the internet drops, the app simply stops working. This is the only one of the 12 required features that was never started.]

### Security hardening (Day 20) — ✅ Largely implemented

Helmet (CSP, HSTS etc.), global `ValidationPipe({ whitelist: true })` + class-validator DTOs everywhere, user-aware Redis rate limiting, CORS config, secret scanning (TruffleHog), dependency scan (Grype), container/filesystem scan (Trivy) — all wired **into CI**, plus the custom tenant-scoping audit. Not verified: DOMPurify/Zod on every frontend form.

### Deployment (Days 22–26) — 🟡 Half done

- ✅ Multi-stage Dockerfiles, dev + prod compose files, Helm chart with Deployment/Service/ConfigMap/Secret/**HPA/PDB/Ingress/Istio (canary)**, ArgoCD app manifest, kind-cluster validation.
- ❌ **No live public deployment** (the TDD's single highest-weighted deliverable at 30%), CI has no deploy stage, **no observability stack** (no OpenTelemetry/Prometheus/Grafana/Loki), no k6 load-test evidence.

  [In simple words: The app currently runs only on the developer's own machine. There is no public website link where anyone can open and use it — and that link alone carries the biggest share of the marks (30%). Also missing: automatic deployment when code changes, monitoring dashboards that show whether the app is healthy or slow, and proof that it can handle heavy traffic (2,000 users at once).]

  **✅ [PARTLY FIXED 11 July — Task B]** The app is now **publicly live at https://erp.92-4-86-3.sslip.io** with real HTTPS (Caddy + Let's Encrypt), verified end-to-end from outside (login → token → all module APIs). Full walkthrough: `docs/learning/PLAT-01-public-deployment-walkthrough.md`. Still open from this bullet: CI deploy stage, observability stack, k6 evidence.

---

## Part 3 — Deficiencies, Over-implementations, Wrong Implementations

### 3.1 Missing (ranked by impact)

1. **Automated tests: zero.** No `.spec.ts`/`.test.ts` anywhere. The TDD demands integration tests (Day 14, Vitest + Supertest), E2E (Playwright), and load tests (Day 21, k6). This is the largest single gap between plan and repo. **✅ [PARTLY FIXED 11 July — Task C]** 22 unit tests on the money paths + a CI job now exist; integration/E2E/load tests remain open.
2. **Live demo URL** — 30% of submission weight; everything runs only locally/kind. **✅ [FIXED 11 July — Task B]** Live at https://erp.92-4-86-3.sslip.io.
3. **F-12 PWA/offline** — entirely absent.
4. **Observability** (Day 26) — no tracing/metrics/log aggregation; only health endpoints and colored console logs.
5. **Multi-currency conversion** — rates fetched ✓ but never applied; no FX math on any document or report.
6. **Payroll saga compensation** — and the concrete retry-duplication bug described under F-04. **✅ [FIXED 11 July — Task A]**
7. **Line-level 3-way matching** + partial goods receipts (quantities per GR line).
8. **Leave accrual rules**; recursive-CTE org chart; MFA demonstration.

### 3.2 Over-implemented (not asked, but present)

These are _good_ extras — worth showcasing, not removing:

- **Per-tenant module licensing** (ModuleGuard) — turns the app into a genuinely sellable SaaS.
- **CI tenant-scoping audit** — an automated guard against the #1 multi-tenant vulnerability class (IDOR across tenants).
- **Sales-order module** (TDD only asked for AR invoicing).
- **Vendor portal UI** with portal keys (TDD asked only for a "vendor portal API").
- **GDPR consent management** beyond plain DSRs.

The only mild scope-creep concern: some of this effort (e.g., sales orders, portal polish) was spent while F-12, tests, and deployment — items with explicit evaluation weight — remain open.

### 3.3 Implemented differently than specified (the "wrongly implemented" check)

| Spec says                                 | Code does                                                           | Verdict                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 3-way match line-by-line qty/price        | Header total within 2% of PO total                                  | **Simplified** — control exists but weaker; won't catch a wrong-mix invoice with the right total |
| Payroll saga w/ compensating transactions | Mark FAILED + BullMQ retry, no compensation                         | ~~**Wrong**~~ **✅ FIXED 11 July** — compensation step wipes stale payslips before retry         |
| Reorder triggers "PO draft"               | Raises purchase requisition                                         | Semantically fine (arguably more correct)                                                        |
| Notification retry "up to 3x"             | 5 attempts w/ backoff                                               | Exceeds spec, harmless                                                                           |
| Org chart via recursive CTE               | Client-side tree from `managerId`                                   | Works; not the specified mechanism                                                               |
| Realm-per-tenant Keycloak                 | ~~Single realm~~ **Correction:** realm created per tenant at signup | **Meets spec** — audit's original finding was wrong (see F-01)                                   |
| Audit log in TimescaleDB                  | Postgres + hash chain                                               | Tamper-evidence kept; time-series engine dropped                                                 |
| CQRS read models                          | Direct aggregation queries                                          | Lightweight-CQRS claim is aspirational                                                           |
| GR supports partial receipt               | Always full receipt; `PARTIALLY_RECEIVED` unreachable               | Dead enum state                                                                                  |
| Journal entries draft→post                | Created directly as POSTED                                          | Simplification; no reversal mechanism                                                            |

**Segregation-of-duties check (the user's specific worry):** verified healthy. SCM creates POs and receives goods but **cannot approve or pay invoices** — invoice approval and payment runs live in Finance controllers behind Finance roles; the GL posts only from events. Payment without prior approval is rejected (`Invoice must be APPROVED before payment`). No module bypasses another's authority.

---

## Part 4 — Scoreboard: Done vs. Remaining

| Requirement                                     | Status                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------- |
| F-01 Multi-tenant auth/SSO                      | ✅ Done (realm-per-tenant + MFA delegated to Keycloak)                                  |
| F-02 Financial ledger                           | ✅ Done, except multi-currency _conversion_                                             |
| F-03 AP/AR automation                           | ✅ Done (matching header-level; OCR mock by default)                                    |
| F-04 HR & payroll                               | ✅ Done (saga compensation **fixed 11 July**; leave accrual **implemented post-audit**) |
| F-05 SCM & inventory                            | ✅ Done (full-receipt only)                                                             |
| F-06 AI forecasting                             | ✅ Done                                                                                 |
| F-07 Project management                         | ✅ Done                                                                                 |
| F-08 Business intelligence                      | ✅ Done (builder basic)                                                                 |
| F-09 Audit & GDPR                               | ✅ Done                                                                                 |
| F-10 Notifications                              | ✅ Done+                                                                                |
| F-11 API gateway & webhooks                     | ✅ Done                                                                                 |
| F-12 Offline/PWA                                | ❌ Not started                                                                          |
| Security hardening                              | ✅ Done                                                                                 |
| Docker/K8s/Helm/ArgoCD manifests                | ✅ Done                                                                                 |
| **Automated tests (unit/integration/E2E/load)** | 🟡 Unit tests + CI ✅ (11 July); integration/E2E/load open                              |
| **Live deployment URL**                         | ✅ **LIVE 11 July** — https://erp.92-4-86-3.sslip.io                                    |
| **Observability stack**                         | ❌ Not started                                                                          |
| Docs (README, ADRs, C4, ERD, API docs)          | ✅ Present                                                                              |
| Demo video                                      | ❌ Pending                                                                              |

[In simple words — what each remaining ❌/🟡 row above means:
— **Offline/PWA**: the app cannot work without internet at all; this planned feature was never started (deliberately de-scoped, see README roadmap).
— **Automated tests**: the salary math, accounting rules, and bill-matching are now automatically verified on every code change (22 tests in CI, added 11 July). Bigger end-to-end and heavy-load tests are still future work.
— **Observability stack**: there are no monitoring dashboards or automatic alerts. If the live app becomes slow or starts failing, nobody would know until a user complains.
— **Demo video**: the required 5–7 minute walkthrough video has not been recorded yet.]

**Bottom line (updated 11 July):** 11 of 12 functional requirements are genuinely implemented — mostly with real algorithms, not stubs. The original audit's verdict was "what's missing is proof, not features" — and most of that proof now exists: the app is **publicly deployed with HTTPS**, the one real correctness bug is **fixed and demonstrated**, and the money-path calculations are **guarded by CI-enforced tests**. What remains for full marks: the **demo video** (10%), and the documented roadmap items (PWA, observability, integration/load tests).

**Original priority order (all but one now done):** ① payroll-retry bug ✅ → ② public deployment ✅ → ③ money-path test suite ✅ → ④ **demo video ← you are here** → ⑤ PWA shell + observability if time remains.

---

## Part 5 — Innovation Opportunities

The TDD's executive summary promises three AI capabilities but only one (forecasting) became a numbered requirement. The other two — **anomaly detection** and **intelligent approval workflows** — are unclaimed innovation territory that would also close a promise the document already makes:

1. **GL anomaly detection** — flag journal entries that deviate from an account's historical pattern (amount z-score, unusual account pairing, off-hours posting). Data and hash-chained audit trail already exist; a scheduled job + notification event is enough for a credible v1.
2. **Intelligent approvals** — risk-score each AP invoice (vendor history, amount vs. PO variance, OCR confidence, duplicate-likeness) and auto-approve low-risk / route high-risk to a human. Extends the existing 3-way match into a genuine "AI approval workflow".
3. **Forecast-driven dynamic reorder points** — connect F-06 to F-05: instead of static `thresholdQty`, set reorder points from predicted demand over vendor lead time. Two already-built modules, one new edge between them — high demo value.
4. **Duplicate/fraud invoice detection** — fuzzy match on vendor + amount + date proximity before approval (classic real-world AP control, cheap to build).
5. **Cash-flow forecast** — combine AR aging (money coming in), AP due dates (going out), and payroll schedule into a 90-day cash projection on the executive dashboard. Pure aggregation of existing data; C-suite-facing wow factor.
6. **Natural-language BI** — "ask your data" box that translates questions to the existing GraphQL/BI queries via an LLM; positions the product as _AI-powered_ beyond forecasting.
7. **Payroll anomaly guard** — before a run completes, flag payslips whose net pay deviates >X% from the employee's trailing average; doubles as a safety net for the saga gap.
8. **Vendor scorecards** — on-time delivery %, price variance, acknowledgement latency from data the vendor portal already captures; feed the score into PO approval UI.

Items 1, 2 and 7 also strengthen the "Innovation & Problem Solving" evaluation category (15 points) while reusing the event bus, queues, and ML service you already have.

---

## Part 6 — Frontend / UX Audit: A User's-Eye Walkthrough

_Method: every one of the 43 screens was reviewed as if a real person from each department sat down to do their day's work — not as a developer checking code. The question throughout: can they do their job, do they see what other departments did, and where will they get confused?_

### 6.1 Does each target user actually have a home here?

The TDD names six user segments. Verdict per persona, walking their real screens:

**Supply Chain Manager — best-served user in the app.** Their nav (Vendors, Products, Inventory, Purchase Orders, Goods Receipt, AP Invoices, AI Forecast) mirrors their actual workday. On the Purchase Orders screen they see incoming requisitions **with the requesting project's name attached**, can convert one into a PO in a click, approve it, and receive goods — the full requisition→PO→receipt chain works from the UI without touching any other tool. Status chips (DRAFT/APPROVED/RECEIVED/MATCHED) use consistent colors across all SCM screens, so state is readable at a glance.

**Finance user — well-served, one bad moment.** Chart of Accounts, Journal Entries, AP/AR Invoices, Sales Orders, Intercompany, Fiscal Periods, Aging Report — all present. The journal-entry form is the single best piece of UX in the app: it shows **live Debit and Credit totals, tells you when the entry is unbalanced, and keeps the Save button disabled until Debits = Credits** — the double-entry rule is taught by the form itself, so a junior accountant physically cannot post a wrong-sum entry. Payment runs (single and batch) work from the invoice screen. The bad moment is described in 6.3 (#1).

**HR user — served.** Employees (with contracts), Departments, Org Chart, Leave Requests (approve/reject in place), Attendance, Statutory Compliance rates, Payroll trigger. Payroll runs asynchronously and the screen reflects run status.

**Plain employee — thinner but covered where it counts.** No dedicated self-service section, but the Home dashboard adapts: it shows **their own leave balance cards and their latest payslip** — the two things employees actually come for. Leave _application_ also works, and balances now accrue monthly (Part 2 F-04, implemented post-audit). Missing: payslip history (only the latest is surfaced).

**Executive — served.** Home KPI dashboard, BI dashboards with drill-down, scheduled PDF/Excel reports, AI Forecast — a director gets a real overview without asking anyone.

**IT Administrator — served, but hidden.** Everything lives inside **Settings tabs**: Keycloak/SSO config, identity provider, **the audit-log viewer with a "verify hash chain" tamper check button**, GDPR requests, compliance settings. Functional and role-gated (non-admins see an "admin required" notice) — but nothing in the main navigation hints that an audit viewer or GDPR console exists. An auditor visiting the app would never find them without being told. ⚠️

[In simple words: The admin tools are all there and work, but they are buried inside "Settings" like a cupboard nobody opens. A new administrator will not discover the audit-log or GDPR screens on their own — they should be visible menu items.]

### 6.2 The "no phone call needed" test — can departments coordinate purely through the UI?

This is the heart of an ERP: when Supply Chain receives goods, Finance should _see_ it happened without anyone calling anyone. Verdict: **mostly yes — state flows visibly across departments**:

- PM requests material → the request **appears on SCM's PO screen** labelled with the project name. SCM never needs to ask "who wanted this?"
- SCM receives goods → an AP invoice **appears on Finance's screen by itself**, already matched or awaiting review — Finance doesn't need to be told a delivery happened.
- Finance approves/pays → the project's budget bar and **"Budget overrun" badge** update on the PM's project page — the PM feels the spend without seeing an invoice.
- PM's own Items tab shows each material request's fulfillment status (REQUESTED → APPROVED → RECEIVED), closing the loop back to the requester.
- Every step fires a **notification (bell badge + live SSE push + optional email/SMS)**, and each user can tune which events reach them on which channel.
- Even the **vendor** — outside the company — participates without phone calls: the vendor portal lets them acknowledge POs and post expected delivery dates and shipment notes, which SCM then sees on the PO.

Two genuine blind spots keep it from a perfect score: ⚠️

[In simple words: Departments CAN see each other's work reflected in the screens, so day-to-day coordination truly does not need phone calls. But two things still force a conversation: (1) On the Finance invoice list you cannot see WHICH purchase order or goods receipt an invoice came from — the link exists in the database but is not shown in the table, so a Finance person verifying a bill may still have to walk over and ask SCM. (2) There is no activity timeline on documents — you can see a PO is APPROVED, but not who approved it, when, or why a match failed, unless you are an admin digging in the audit tab. Status is visible; the story behind it is not.]

### 6.3 Where users WILL get confused or make wrong entries (ranked)

1. ❌ **The AP invoice upload asks the user to paste a "Goods Receipt ID" by hand.** It is a raw database UUID (like `f3a91c22-…`) typed into a free-text box.

   [In simple words: This is the worst usability spot in the app. To make an uploaded vendor bill auto-match, the Finance user must copy-paste a long computer-generated code for the goods receipt — from where? Nothing on the screen tells them. Type it wrong and the bill silently skips auto-matching. This should be a dropdown list showing "PO-2026-014 — received 3 July — Vendor X" to pick from.]

   **✅ [FIXED 11 July — D1]** It is now exactly that dropdown.

2. ❌ **Buttons are not hidden by role anywhere except Settings.** A Viewer (read-only role) sees Approve, Delete, Pay, and Run Payroll buttons everywhere; clicking produces a backend error popup.

   [In simple words: The security is real — the server refuses the action — but the screen lies about it. A read-only user sees every dangerous button, clicks "Approve", and gets a cryptic error. They will think the app is broken. Buttons the user is not allowed to press should be hidden or greyed out.]

   **✅ [FIXED 11 July — D2]** All money-critical pages (invoices, POs, payroll, fiscal periods) now hide write buttons from Viewers via the `useRoles()` hook; a few low-risk CRUD pages remain (pattern ready, listed in Task D2).

3. ⚠️ **Duplicate menu entries pointing at the same data.** "AP Invoices" appears under both Finance _and_ Supply Chain (same list, same API); "AI Forecast" exists both top-level and inside Supply Chain.

   [In simple words: The same vendor-bills list is reachable from two different menus under two departments. No double data is created — it is literally the same screen — but a new user can easily believe Finance's invoices and Supply Chain's invoices are different documents, and two people may both "handle" the same bill thinking they own it. One list should live in one place, or the duplicate should be clearly marked as a shortcut.]

   **✅ [FIXED 11 July — D5]** Each screen now lives under exactly one menu.

4. ⚠️ **Receiving goods from the PO screen silently picks the first warehouse.** The proper Goods Receipt screen offers a warehouse dropdown, but the quick "Receive" button on the PO list does not ask — it takes whatever warehouse comes first and stamps the note "Received via web UI".

   [In simple words: A company with two warehouses can easily book stock into the wrong one, because the quick-receive button never asks WHERE the goods arrived. The two receiving flows also behave differently, which itself is confusing — same action, different questions asked.]

   **✅ [FIXED 11 July — D6]** Quick-receive now opens a modal asking which warehouse (+ delivery notes).

5. ⚠️ **Feedback is inconsistent: most screens use raw browser popups (`alert`/`confirm`), one screen uses a proper toast, and some errors go nowhere visible.** Marking a notification read, for instance, fails silently into the browser console.

   [In simple words: Sometimes the app talks to you with an ugly system popup, sometimes with a nice message, and sometimes not at all — a failed action can look identical to a successful one. Users lose trust fast when they can't tell whether their click worked. One consistent notification style is needed.]

   **✅ [FIXED 11 July — D3]** One shared toast system; all 48 `alert()` popups replaced; silent failures now visible.

6. ⚠️ **Developer language leaks into user-facing messages**, e.g. "No warehouse configured. Seed the database first."

   [In simple words: A warehouse clerk does not know what "seed the database" means. Messages like this should say what the user can actually do: "No warehouse exists yet — ask your administrator to create one under Inventory → Warehouses."]

   **✅ [FIXED 11 July — D7]** Messages rewritten in user language.

7. ⚠️ **Currency display is inconsistent** — project budgets show ₹, most Finance screens show bare numbers, and (per Part 2, F-02) exchange rates are never applied.

   [In simple words: Some screens say ₹12,000, others just 12000 with no currency at all. In a product that advertises multi-currency support, a user handling a dollar invoice has no idea what currency any number is in.]

   **🟡 [PARTLY FIXED 11 July — D8]** Shared `formatCurrency()` applied to invoice and PO money cells; remaining cells listed for the intern. Actual FX conversion is Task F (post-deadline).

### 6.4 Create / Update / Delete — will departments hit walls?

Checked per module, from the screens themselves:

| Module                        | Create                       | Update                           | Delete                    | Notes for the user                                                                                                                         |
| ----------------------------- | ---------------------------- | -------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Vendors, Products, Warehouses | ✅                           | ✅                               | ✅                        | Full control, confirm dialogs on delete                                                                                                    |
| Purchase orders               | ✅ (incl. from requisition)  | ⚠️ status-only (approve/receive) | ❌ none                   | No way to cancel/edit a wrongly-created PO — the CANCELLED status exists in the database but no screen sets it                             |
| Invoices (AP/AR)              | ✅ (manual + OCR upload)     | ⚠️ approve/pay only              | ❌ none                   | A typo'd invoice cannot be edited or voided from the UI; it stays forever as PENDING_MATCH                                                 |
| Journal entries               | ✅ (with live balance guard) | ❌                               | ❌                        | Correct for accounting (immutability) — but with no reversal-entry button, fixing a mistake requires manually authoring the opposite entry |
| Employees, Departments        | ✅                           | ✅                               | ✅ (soft)                 | Solid                                                                                                                                      |
| Leave                         | ✅ apply                     | ✅ approve/reject                | —                         | State machine enforced                                                                                                                     |
| Projects/tasks/milestones     | ✅                           | ✅                               | ✅ (cascade, well-warned) | Delete warning lists everything that goes with it — good                                                                                   |
| Resource allocations          | ✅                           | ❌                               | ✅                        | Can't edit hours — must delete and re-create                                                                                               |
| Notifications                 | —                            | ✅ read                          | ✅                        | Filters + delete added July 2026                                                                                                           |
| Dashboards/BI                 | ✅                           | ✅                               | ✅                        | —                                                                                                                                          |

⚠️ The pattern in rows 2–3 matters most: **documents that carry money (POs, invoices) can be created but never corrected or cancelled through the UI.**

[In simple words: If someone creates a purchase order or an invoice with a wrong amount, there is no "edit", no "cancel", no "void" button anywhere. The wrong document just sits there forever, and people work around it by creating a second, correct one — which is exactly how duplicate bills and confusion between departments start. Every money document needs at least a cancel option with a reason field.]

**✅ [FIXED 11 July — D4]** POs and AP invoices now have Cancel buttons with a reason field — POs until goods are received, invoices until they enter the ledger (after which the error explains that a reversal entry is the correct tool).

### 6.5 Overall user-friendliness verdict (and the TDD's own UI bar)

**Score against the TDD's UI promises:** responsive design ⚠️ partially (the shell — top bar, drawer nav, cards — adapts well to mobile widths; only ~8 of 30+ data tables have horizontal-scroll wrappers, the rest will overflow on a 375px phone) — **✅ [FIXED 11 July — D9]** every table now scrolls horizontally on mobile; WCAG 2.1 AA accessibility ⚠️ unaudited (icon buttons in the shell have aria-labels; forms and tables were never checked); Lighthouse ≥ 90 ❌ never measured; PWA/offline ❌ absent (Part 2, F-12).

**The honest overall picture:** this frontend is **genuinely usable and department-shaped — a strong 7/10 for a working product, held back by finishing details.** The information architecture is right: each department's menu matches their real job, cross-department state actually flows (the no-phone-call test largely passes), the best forms _teach_ the business rules (journal entry balance guard), empty screens tell you what to do next, deletes warn you properly, and there is a global Ctrl+K search. A new employee in any department could learn their daily loop in under an hour.

What separates it from feeling professional is consistency, not capability: browser `alert()` popups next to polished modals, a UUID paste-box in a money workflow, buttons that pretend to be clickable for read-only users, the same list living under two menus, and no way to cancel a wrong PO or invoice. None of these are architectural — each is a screen-level fix — but together they are exactly the kind of rough edges that make first-time users say "it feels unfinished" in the demo that decides 10% of the evaluation ("Presentation & Polish").

**Five cheapest fixes with the highest user impact:** ① replace the GR-ID paste box with a dropdown; ② hide/disable buttons by role; ③ one toast system everywhere, no `alert()`; ④ a Cancel action (with reason) on POs and invoices; ⑤ wrap every data table in a horizontal-scroll container for mobile. — **✅ All five done, 11 July (Task D).**

---

## Part 7 — The Fix Plan: Every Flag Turned Into Tasks (3-Day Sprint)

_Every ⚠️ and ❌ from Parts 2–6 has been collected here. Flags with the same root cause are merged into one work stream (e.g., "no partial goods receipts" + "header-only 3-way match" + "the GR UUID paste box" are three symptoms of one missing thing: GR line data). Tasks are broken down small enough for an intern to pick up one checkbox at a time._

**Legend:**
🎓 = intern can do this alone (file paths given) · 🙋 = **needs Pawan** (account, payment, decision, or recording — cannot proceed without you) · ⏳ = stretch / do after the deadline · ✔️ = no work needed, just document the decision

**The 3-day allocation (marks-weighted):** Day 1 = Task A + Task D quick wins + start Task C · Day 2 = Task B (deploy) + finish D · Day 3 = Task G (video) + finish C + buffer. Tasks E, F, H are ⏳ post-deadline.

---

### TASK A — Fix the payroll double-payslip bug ❌ _(Day 1 morning — the one real correctness bug; must be done before the demo)_

Covers: Part 2 F-04 saga/retry finding.

- [x] 🎓 **A1.** ✅ _Done 11 July._ Compensation step added at the top of `process()` in `apps/api/src/hr/payroll/payroll.processor.ts` — stale payslips from a failed attempt are deleted before reprocessing.
- [x] 🎓 **A2.** ✅ Verified: `totalNetPaySum` is local per attempt, and payslip PDFs overwrite the same storage key, so the whole handler is now idempotent.
- [x] 🎓 **A3.** ✅ Proven end-to-end with the real BullMQ worker against the dev DB (21 employees), via the permanent script `pnpm --filter api verify:payroll-retry` (`apps/api/scripts/verify-payroll-retry.ts`). **Before the fix: 42 payslips, all 21 employees duplicated, run total ≠ payslip sum. After: 21 payslips, 0 duplicates, totals reconcile exactly.**
- [x] 🎓 **A4.** ✅ 9 unit tests added in `payroll-deductions.spec.ts` (gross-to-net, ESI ceiling edge, PF-on-basic-only, gratuity, tax slabs) — all green; this also completes C1+C2.

### TASK B — Get a public URL 🙋 _(Day 2 — worth 30% of the evaluation on its own)_

Covers: Part 2 Deployment ❌, scoreboard "Live deployment URL" ❌. The Helm/K8s work is already done; the fastest path for 3 days is Docker Compose on a rented VM, not Kubernetes.

- [x] 🙋 **B1.** ✅ _Done 11 July — no new server needed._ Discovered the dev machine itself is an Oracle VM (6 CPU / 47 GB, public IP `92.4.86.3`); Pawan opened ports 80/443 in the VCN security list (the only console step required — the A1 free-instance attempt hit "Out of capacity" and was abandoned).
- [x] 🎓 **B2.** ✅ _Done 11 July._ Server firewall (iptables) opened + persisted across reboots; **Redis switched to `noeviction`** (the BullMQ job-loss risk and the boot warning are gone); Keycloak given `KC_PROXY_HEADERS=xforwarded` so it issues proper `https://` URLs behind the proxy. Fixed a real deploy blocker: the web app's Keycloak URL was **hardcoded** to `localhost:8180` — now env-driven (`NEXT_PUBLIC_KEYCLOAK_URL`).
- [x] 🎓 **B3.** ✅ Existing seeded stack reused (tenant `company-a`, 21 employees, full demo data); Keycloak client granted the public redirect URI.
- [x] 🎓 **B4.** ✅ **Caddy** on 80/443 with automatic Let's Encrypt TLS: `erp.92-4-86-3.sslip.io` → web (:3100) + API (:3101, SSE streaming enabled), `kc.92-4-86-3.sslip.io` → Keycloak. Production builds run under **pm2** (boot-persistent). End-to-end smoke test passed **over the public internet**: password login against public Keycloak → token with `https` issuer → API validated it → projects/invoices/POs/employees/notifications all served. Dev servers (:3000/:3001) untouched and still work.
- [x] 🎓 **B5.** ✅ Live URL + demo credentials added to `README.md`.

  **📍 LIVE: https://erp.92-4-86-3.sslip.io** · Swagger: `/api-docs` · tenant `company-a`, admin `admin@companya.in` / `Admin123!` · ⚠️ Runs on the trial-credit VM — if the 30-day Oracle trial ends before evaluation, migrate to an Always-Free A1 instance (retry capacity daily).

### TASK C — A thin test suite on the money paths _(Days 1–3, in the gaps — currently the repo has literally zero tests)_

Covers: scoreboard "Automated tests" ❌. Don't aim for coverage; aim for the four calculations an examiner would probe. All four are intern-friendly because the logic is in pure/service functions with obvious inputs.

- [x] 🎓 **C1.** ✅ _Done 11 July._ Vitest installed in `apps/api`, `pnpm test` script added.
- [x] 🎓 **C2.** ✅ _Done 11 July_ (as A4): 9 tests covering gross/net, the ₹21,000/₹21,001 ESI edge, slab fallback, inclusive boundaries, open-ended top slab.
- [x] 🎓 **C3.** ✅ _Done 11 July._ `gl.service.spec.ts` — 5 tests with mocked Prisma: balanced entry posts, unbalanced entry throws and never writes, multi-line aggregate balance accepted, locked-period posting rejected, missing period rejected.
- [x] 🎓 **C4.** ✅ _Done 11 July._ `invoice-matching.service.spec.ts` — 8 tests: exact match passes, exactly-2% passes (boundary inclusive), 2.1% fails, undercharge beyond tolerance fails, vendor mismatch fails, GR-belongs-to-other-PO fails, missing document fails, zero-total PO never auto-approves.
- [x] 🎓 **C5.** ✅ _Done 11 July._ "Unit tests (Vitest)" job added to `.github/workflows/ci.yml` and wired into the Slack notification's needs list. **Task C complete: 22 tests across 3 suites, all green.**

### TASK D — UX consistency sprint _(Day 1 afternoon + Day 2 — all screen-level, no architecture; each checkbox is one sitting)_

Merges every Part 6 flag: 6.3 #1–#7, 6.4 cancel gap, 6.2 blind spots, 6.1 buried admin tools, 6.5 responsive tables.

- [x] 🎓 **D1.** ✅ _Done 11 July._ The Goods Receipt UUID paste box is now a dropdown showing "PO number · vendor · received date", with a plain-language hint about what picking one does.
- [x] 🎓 **D2.** ✅ _Mostly done 11 July._ `useRoles()` hook created (`apps/web/src/lib/use-roles.ts`, cached). Gated: AP invoices (all 4 header actions + row Approve/Cancel), PO page (Create PO/advance/Cancel), payroll Run button, fiscal-period Open/Close. Leave approvals and Settings already had gating. _Leftover for intern:_ the low-risk CRUD pages (vendors, products, employees, departments, inventory, journal-entries, AR, sales-orders) still show buttons to Viewers — same one-line `{canWrite && …}` pattern, hook is ready.
- [x] 🎓 **D3.** ✅ _Done 11 July._ Shared toast system (`apps/web/src/components/ui/toast.tsx`, `ToastHost` mounted in the dashboard layout). All **48 `alert()` calls across 18 pages** replaced; silent `console.error` failures on approve now surface as error toasts.
- [x] 🎓 **D4.** ✅ _Done 11 July._ Backend: `PATCH /scm/purchase-orders/:id/cancel` (blocked once goods received) and `POST /finance/ap/invoices/:id/cancel` (blocked once in the ledger — needs a reversal instead, and the error says so). Frontend: Cancel buttons + reason modals on both pages.
- [x] 🎓 **D5.** ✅ _Done 11 July._ "AP Invoices" and "AI Forecast" removed from the Supply Chain menu — each screen now lives in exactly one place.
- [x] 🎓 **D6.** ✅ _Done 11 July._ Quick-receive now opens a modal asking **which warehouse** the goods arrived at (+ optional delivery notes) instead of silently using the first warehouse. Also removed the dead "New PO" button that had no click handler.
- [x] 🎓 **D7.** ✅ _Done 11 July._ "Seed the database first" → "No warehouse exists yet — create one under Supply Chain → Inventory first"; same treatment for the no-vendor message; success toasts explain the cross-department effect ("stock updated, invoice sent to Finance").
- [x] 🎓 **D8.** ✅ _Core done 11 July._ `formatCurrency()` added (`apps/web/src/lib/format.ts`, ₹ + Indian grouping) and applied to the AP invoice and PO money cells. _Leftover for intern:_ sweep remaining `₹…toLocaleString()` cells to the shared formatter.
- [x] 🎓 **D9.** ✅ _Done 11 July._ The shared `Table` component already scrolls; the 9 pages using raw `<table>` (12 tables) are now wrapped in `overflow-x-auto` — zero unwrapped tables remain.
- [x] 🎓 **D10.** ✅ _Done 11 July._ AP invoice table now shows a **PO column**, and the nav item is renamed "Settings, Audit & GDPR" so the admin tools are discoverable.

### TASK E — GR line quantities → partial receipts → line-level matching ⏳ _(one root cause, three flags — post-deadline)_

Merges: F-05 "full receipt only / PARTIALLY_RECEIVED unreachable" ⚠️ + F-03 "header-total-only match" ❌. Do **not** attempt in 3 days — it needs a schema migration (`GoodsReceiptLine` with per-line received qty), receive-UI changes, and a line-by-line match rewrite. ✔️ For now add one sentence to the README's known-limitations list.

### TASK F — Make multi-currency real ⏳ _(post-deadline)_

Covers: F-02 "rates never consumed" ❌. Needs a decision on base currency per tenant and conversion-at-posting logic. ✔️ For the demo, D8 at least makes the displayed currency consistent, and the README notes the limitation.

### TASK G — Demo video + submission package 🙋 _(Day 3 — 10% of marks + required deliverable)_

- [ ] 🎓 **G1.** Write the 5–7 min script straight from Part 1.2 of this document (the procure-to-pay story is the wow-flow: PM requests material → SCM converts → vendor portal acknowledges → goods received → invoice auto-appears matched → GL entries → project budget updates → notification bell). Add the payroll run and a BI dashboard as the second act.
- [ ] 🙋 **G2.** **Pawan records:** screen + voice, multi-role (log in as PM, then SCM, then Finance — this demonstrates RBAC for free). Upload YouTube-unlisted.
- [ ] 🎓 **G3.** README final pass: live URL, demo credentials, video link, architecture diagram screenshot, and a short **"Known deviations from the TDD"** section — copy the ✔️ items from Task H below. Being upfront about deviations reads as engineering maturity, not weakness.

### TASK H — Accepted deviations: document, don't fix ✔️ — ✅ _Done 11 July_

A **"Known Deviations from the TDD"** table + roadmap list now lives in `README.md`, covering: MFA delegated to Keycloak config (F-01), header-level 3-way matching (F-03), full-receipt-only GR (F-05), FX rates fetched but unconverted (F-02), requisition-not-PO-draft reorder (F-05), Postgres+hash-chain audit log (F-09), 5x notification retries (F-10), client-side org chart (F-04), direct-posted journal entries (F-02), and the payroll compensation approach. **Bonus correction:** the audit's "single shared realm" finding was wrong — `tenant.service.ts` creates a dedicated Keycloak realm per tenant at signup, so the TDD's realm-per-tenant strategy is actually met (F-01 section updated above).

### Deliberately dropped for the 3-day window ⏳

PWA/offline (F-12), observability stack, k6 load test, leave accrual (**later implemented, see F-04 correction above**), MAPE monitoring, drag-drop dashboard editor, allocation editing, activity timelines, WCAG audit. Each is real, none moves marks as much as B, G, or C do in the time left. List them in the README as roadmap items — the TDD itself de-scopes via "MVP feature scope and de-scope list" (Day 1), so naming your de-scope is following the plan.

### Where I need you, summarized 🙋

1. ~~B1 — hosting decision~~ ✅ done (ports opened; deployed on the existing VM)
2. **G2 — recording the demo video with your voice** (the only remaining blocker for submission)
3. Still useful: the Oracle **trial days-remaining** number, so we know whether the live URL must be migrated to an Always-Free instance before evaluation.

Everything else in Tasks A, C, D, H is 🎓 — hand any checkbox to an intern with this document open and they have the file path, the pattern to copy, and the acceptance check.
