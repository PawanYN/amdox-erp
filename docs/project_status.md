# Amdox ERP — Implementation Status vs Company Specification

> **Company document:** [`Amdox Web.pdf`](./Amdox%20Web.pdf) — *AMX-ERP-2026-04, Version 1.0, April 2026*  
> **Codebase reviewed:** `w:\amdox-erp` — **2 July 2026**  
> **Purpose:** Map every major requirement from the company PDF to what is built, partially built, or missing — with direct quotes from the PDF so you can verify each item.

---

## How to Read This Document

Each row uses one of three statuses:

| Status | Meaning |
|--------|---------|
| **Done** | Backend and/or UI exist and work against real code (not just schema stubs). |
| **Partial** | Models, folders, or mock UI exist; core behaviour is incomplete or not wired end-to-end. |
| **Not started** | No meaningful implementation found in the repo. |

When a PDF phrase appears in **bold**, that is the exact wording (or close paraphrase) from the company document.

---

## 1. Executive Summary

The company spec describes an **"AI-Powered Cloud ERP Suite"** — a **"scalable, AI-augmented, multi-tenant ERP platform"** covering finance, supply chain, HR/payroll, projects, and BI, with enterprise security and compliance.

### Overall completion (approximate)

| Area | Done | Partial | Not started |
|------|------|---------|-------------|
| Functional requirements **F-01 → F-12** | 4 | 5 | 3 |
| Target user personas (6 segments) | 1 | 4 | 1 |
| Technology stack (24 categories) | 10 | 4 | 10 |
| 28-day execution plan | 12 days | 7 days | 9 days |
| Submission deliverables (5 items) | 1 | 2 | 2 |

**Bottom line:** Core backend modules for **Finance**, **HR/Payroll**, and **Supply Chain** are the strongest areas. **AI forecasting**, **BI dashboards**, **PWA/offline**, **deployment/CI/CD**, and **compliance hardening** are largely missing. The frontend often uses **mock data** even where APIs already exist. Several PDF tech choices (**GraphQL**, **shadcn/ui**, **Zustand**, **TimescaleDB**, **Kubernetes/Helm**, **OpenTelemetry**) are not implemented.

---

## 2. What the Company Spec Requires (At a Glance)

From the PDF **Executive Summary**:

> *"A scalable, AI-augmented, multi-tenant ERP platform delivering financial management, supply chain automation, HR & payroll, project tracking, and business intelligence — purpose-built for mid-market and enterprise organisations operating across geographies."*

Non-functional targets quoted in the PDF:

| NFR | PDF target |
|-----|------------|
| Availability | **99.9% monthly uptime** |
| API latency | **< 300ms P95** for all REST endpoints |
| Throughput | **>= 2,000 concurrent active users per tenant** |
| Security | **OWASP Top 10 2021 + SOC 2 controls** |
| Compliance | **GDPR & ISO 27001 compliant architecture** |

**Status:** Architecture and models support these goals in design docs and schema, but **no load tests (k6)**, **no observability stack**, **no production deployment**, and **no pen-test/scan pipeline** exist yet → **Not started** for measurable NFR proof.

---

## 3. Target Users & Use Cases

Section **1.2 Target Users** in the PDF defines six personas. Below, each persona’s **Primary Use Case** is quoted from the PDF, then mapped to implementation.

### 3.1 C-Suite / Executives

| PDF quote | **"Real-time dashboards, KPI monitoring, board-level reporting"** |
|-----------|---------------------------------------------------------------------|
| **Status** | **Partial** |
| **What exists** | Dashboard shell at `/home`; persona switcher includes **"Executive"** in `dashboardLayout.tsx`. CRM/Reports components exist under `components/dashboard/` but are **not linked in navigation**. |
| **What is missing** | No **"Drag-and-drop dashboard builder"** (F-08); Recharts is installed but **not used in any page**; no KPI/board-level reporting wired to live data. |
| **How you know** | PDF §1.2 + §F-08; codebase has no BI module pages. |

### 3.2 Finance Teams

| PDF quote | **"GL management, AP/AR automation, multi-currency reconciliation"** |
|-----------|-----------------------------------------------------------------------|
| **Status** | **Partial** (backend strong, frontend mixed) |
| **What exists** | GL (`gl.service.ts`, journal entries, chart of accounts API), AP (OCR simulation, **"3-way matching"**, payment runs), AR (aging report API), FX rates (`fx-rate.service.ts`). Pages: accounts, journal entries, invoices, aging report. |
| **What is missing** | Frontend **accounts**, **journal-entries**, and **aging-report** pages still use **MOCK data**; multi-currency reconciliation UI not verified. |
| **How you know** | PDF §1.2, F-02, F-03; mock usage in `finance/accounts/page.tsx`, `journal-entries/page.tsx`, `aging-report/page.tsx`. |

### 3.3 HR & Payroll Teams

| PDF quote | **"Employee lifecycle, attendance, payroll processing, compliance"** |
|-----------|------------------------------------------------------------------------|
| **Status** | **Partial** |
| **What exists** | Employee CRUD, departments, leave state machine, attendance APIs, payroll via **BullMQ** saga, tax slabs, payslip PDF (`payslip-generator.ts`). `/home` calls real attendance/leave APIs for logged-in employee. |
| **What is missing** | Leave, attendance, payroll admin pages use **mock data**; statutory compliance beyond tax slabs not demonstrated; org chart UI not found. |
| **How you know** | PDF §1.2, F-04; `leave-requests/page.tsx`, `attendance/page.tsx` import from `@/lib/mock/hr`. |

### 3.4 Supply Chain Managers

| PDF quote | **"Procurement, inventory, vendor management, demand planning"** |
|-----------|------------------------------------------------------------------|
| **Status** | **Partial** |
| **What exists** | Vendor CRUD, PO lifecycle, goods receipt, inventory/stock levels, **"reorder automation"** (`reorder.service.ts`), AP invoice flow from SCM. SCM pages **vendors**, **purchase-orders**, **inventory**, **invoices**, **goods-receipt** call real APIs. |
| **What is missing** | **"Vendor portal"** (PDF Day 12) — only vendor **master data** exists, no external supplier portal/API for vendors to log in; **"demand planning"** / **AI Demand Forecasting** (F-06) not started. |
| **How you know** | PDF §1.2, F-05, F-06; `vendor.service.ts` is internal CRUD only; no `vendor-portal` routes. |

### 3.5 Project Managers

| PDF quote | **"Resource allocation, milestone tracking, budget management"** |
|-----------|-------------------------------------------------------------------|
| **Status** | **Partial** |
| **What exists** | Backend: `pm/projects`, tasks, budget, resource controllers. Frontend pages for overview, tasks, resources, budget. |
| **What is missing** | All PM frontend pages use **`@/lib/mock/pm-v2`**; **"Gantt"** chart not implemented; milestone **alerts** not implemented; DAG validation for task dependencies not implemented. |
| **How you know** | PDF §1.2, F-07; mock imports in `projects/*/page.tsx`. |

### 3.6 IT Administrators

| PDF quote | **"Tenant configuration, SSO, audit logs, security policies"** |
|-----------|-------------------------------------------------------------------|
| **Status** | **Partial** |
| **What exists** | Tenant create/config API (`tenant.controller.ts`), Keycloak integration, Settings UI (SSO toggle, audit/GDPR tabs), token blacklist on logout. |
| **What is missing** | Settings page uses **mock audit/GDPR data**; real audit API returns **`getDummyAuditLogs`** only; GDPR service is empty stub; no rate limiting, Helmet, or secrets vault; **NotificationModule not registered** in `app.module.ts`. |
| **How you know** | PDF §1.2, F-09, §6; `audit.service.ts` returns hardcoded logs. |

### 3.7 Vendors (concept in PDF — not a target user row)

The PDF repeatedly mentions **"vendor portal"** and **"vendor notified via email/webhook"** (F-05):

| PDF quote | **"PO lifecycle, vendor portal, real-time stock levels, reorder automation"** |
|-----------|--------------------------------------------------------------------------------|
| **Status** | **Partial** |
| **Done** | PO lifecycle, stock levels, reorder automation (draft PO when stock < threshold). |
| **Not done** | Vendor portal (external-facing), supplier email/webhook notifications (notification engine is stub; `EmailChannel` is empty). |

---

## 4. Functional Requirements (F-01 → F-12)

Direct from PDF **Section 2 — Detailed Functional Requirements**.

### F-01 — Multi-Tenant Auth (SSO) — **Done**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"SAML 2.0 / OIDC integration with Azure AD, Google Workspace"** | Partial | Keycloak 25 OIDC wired (`KeycloakProvider`, passport-jwt). SAML/Azure AD/Google not explicitly configured in repo. |
| **"MFA enforcement per tenant"** | Partial | Keycloak-capable; not verified per-tenant in code. |
| **"tenant isolation verified"** | Done | `TenantContextInterceptor`, `tenantId` on Prisma models, realm-per-tenant ADR. |
| **"Login < 2s"** | Not measured | No performance tests. |

### F-02 — Financial Ledger (GL) — **Done** (backend); **Partial** (UI)

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Double-entry accounting, multi-currency, period close, intercompany transfers"** | Done (API) | `JournalEntry`, `FiscalPeriod`, `ExchangeRate`, `IntercompanyTransfer` models; `gl.service.ts`. |
| **"Zero unbalanced entries; FX rates auto-fetched; period lock enforced"** | Partial | Logic in services; auto FX fetch in `fx-rate.service.ts`; frontend not fully wired. |

### F-03 — AP / AR Automation — **Done** (backend); **Partial** (UI/OCR)

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Invoice OCR"** | Partial | `ocr.service.ts` **simulates** extraction (mock 96% confidence), not real Textract/Tesseract. |
| **"3-way matching"** | Done | `invoice-matching.service.ts` — PO / GR / Invoice with tolerance. |
| **"Payment runs, aging reports"** | Done (API) | `PaymentRun`, `ar.service.ts` aging; aging UI uses mock rows. |
| **"OCR accuracy >= 95%"** | Not met (real OCR) | Simulated only. |

### F-04 — HR & Payroll Engine — **Done** (backend); **Partial** (UI)

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Employee onboarding, leave management, payroll calculation, statutory compliance"** | Partial | Full backend modules; admin UI partly mock; compliance = tax slabs only. |
| **"Payroll processed in < 5 min for 10k employees"** | Not verified | BullMQ async payroll exists; no load test. |
| **"audit trail complete"** | Partial | Payroll mutations tracked in DB; global audit log is dummy data. |

### F-05 — Supply Chain & Inventory — **Partial**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"PO lifecycle"** | Done | `purchase.service.ts`, PO UI connected to API. |
| **"vendor portal"** | Not started | Internal vendor CRUD only. |
| **"real-time stock levels"** | Done | `inventory/` module, stock levels in DB. |
| **"reorder automation"** | Done | `reorder.service.ts` — threshold → draft PO. |
| **"vendor notified via email/webhook"** | Not started | Notification stubs; no SES/webhook delivery. |

### F-06 — AI Demand Forecasting — **Not started**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"ML model for SKU-level demand prediction (LSTM / Prophet)"** | Not started | No `apps/ml-service` source; `ForecastModel` schema only. |
| **"MAPE < 12% on 90-day horizon; model retrain weekly"** | Not started | No ML pipeline. |
| **"Python 3.13 + FastAPI + scikit-learn + Prophet"** | Not started | `Dockerfile.ml` exists; no Python service code. |

### F-07 — Project Management — **Partial**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Gantt, resource allocation, budget tracking, milestone alerts"** | Partial | Backend + mock UI; no Gantt component; no alert logic. |
| **"Overrun alert when actual > budget by 10%"** | Not started | Budget models exist; no alert implementation found. |
| **"Gantt renders < 1s"** | Not started | No Gantt. |

### F-08 — Business Intelligence — **Not started**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Drag-and-drop dashboard builder, scheduled reports, drill-down analytics"** | Not started | `Dashboard`, `Widget`, `ScheduledReport` models only. |
| **"Dashboard saved in < 500ms; exports to PDF/Excel"** | Not started | No BI UI or export jobs. |
| **"Recharts + ECharts + D3.js"** | Partial (deps only) | Recharts in `apps/web/package.json` but **zero imports** in TSX files. |

### F-09 — Audit & Compliance Log — **Partial**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Immutable audit trail for all mutations"** | Partial | `AuditLog` model; service returns **dummy** logs, no mutation hook pipeline. |
| **"Tamper-evident logs"** | Not started | `HashChainService` is empty class. |
| **"GDPR data subject requests"** | Not started | `GdprService` empty; `DataSubjectRequest` model only. |
| **"DSR fulfilled in < 72h"** | Not started | No DSR workflow. |

### F-10 — Notification Engine — **Partial**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"In-app, email, SMS, webhook for configurable business events"** | Not started | Channel classes are empty; `NotificationModule` **not imported** in `AppModule`. |
| **"retry up to 3x on failure; channel preference per user"** | Not started | Models exist; no preference API. |
| Event bus | Done | `@nestjs/event-emitter` used in finance/SCM services. |
| Outbox pattern | Done | `outbox.processor.ts`, `OutboxEvent` model. |

### F-11 — API Gateway & Webhooks — **Partial**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"REST + GraphQL gateway"** | Partial | REST + Swagger at `/api-docs`; **no GraphQL**. |
| **"OpenAPI 3.1 spec published; all endpoints versioned"** | Partial | OpenAPI via Swagger + `docs/api/openapi.yaml`; **no API versioning**. |
| **"outbound webhook subscriptions"** | Not started | `WebhookSubscription` model only. |

### F-12 — Offline / PWA Support — **Not started**

| PDF phrase | Status | Evidence |
|------------|--------|----------|
| **"Service worker cache for critical read views; sync on reconnect"** | Not started | No service worker, no PWA manifest. |

---

## 5. Concept Glossary (PDF Terms Explained + Status)

The company PDF uses many single-word or short labels without full definitions. Below: **what it means** → **implemented?**

| Term | Meaning (from PDF context) | Status |
|------|---------------------------|--------|
| **Multi-tenant** | One platform, many isolated customer organisations (`tenantId` on all data). | **Done** — Tenant model, middleware, Keycloak realm strategy. |
| **SSO** | Single Sign-On via SAML/OIDC (Keycloak). | **Partial** — OIDC yes; SAML/Azure/Google not configured in repo. |
| **MFA** | Multi-factor authentication enforced per tenant. | **Partial** — Keycloak feature; not verified in code. |
| **GL** | General Ledger — double-entry chart of accounts and journals. | **Done** (API) / **Partial** (UI). |
| **AP / AR** | Accounts Payable / Accounts Receivable — supplier and customer invoicing. | **Done** (API) / **Partial** (UI). |
| **OCR** | Optical Character Recognition — scan invoices into structured data. | **Partial** — simulated in `ocr.service.ts`, not production OCR. |
| **3-way matching** | Match Purchase Order + Goods Receipt + Invoice before payment. | **Done** — `invoice-matching.service.ts`. |
| **PO** | Purchase Order — procurement document lifecycle. | **Done** — purchase module + UI. |
| **GR** | Goods Receipt — record of received stock against a PO. | **Done** — goods receipt flow. |
| **Vendor** | Supplier master record for procurement. | **Done** — `vendor.service.ts` + vendors page. |
| **Vendor portal** | External API/UI for suppliers (not the same as vendor master). | **Not started** — PDF Day 12; only mentioned in UI comment. |
| **Reorder automation** | Auto-create PO when stock falls below threshold. | **Done** — `reorder.service.ts`. |
| **FIFO** | Inventory costing method (PDF says "FIFO/FIFO" — likely FIFO/LIFO). | **Partial** — stock movements exist; costing method not clearly implemented. |
| **Prophet / LSTM** | Time-series ML models for demand forecasting. | **Not started** — schema enum only. |
| **MAPE** | Mean Absolute Percentage Error — forecast accuracy metric (< 12% target). | **Not started** |
| **Gantt** | Timeline chart for project tasks and dependencies. | **Not started** |
| **BI** | Business Intelligence — dashboards and self-serve reporting. | **Not started** |
| **SSE** | Server-Sent Events for real-time metric refresh. | **Not started** |
| **PWA** | Progressive Web App — offline-capable web app. | **Not started** |
| **DSR** | Data Subject Request — GDPR export/delete requests. | **Not started** — stub controller/service. |
| **GDPR** | EU data protection — consent, erasure, portability. | **Partial** — models + empty services. |
| **Audit trail** | Immutable log of who changed what. | **Partial** — dummy API; no write pipeline on mutations. |
| **Hash chain** | Linked hashes to detect tampering with audit logs. | **Not started** — empty `HashChainService`. |
| **Outbox** | DB table + worker for reliable event delivery after commit. | **Done** — `OutboxEvent`, `outbox.processor.ts`. |
| **Saga** | Multi-step workflow with compensating transactions (payroll). | **Done** — payroll BullMQ + `SagaState`. |
| **DDD** | Domain-Driven Design — bounded contexts per module. | **Partial** — module folders match Finance/HR/SCM/PM. |
| **CQRS** | Separate read/write models for BI queries. | **Not started** |
| **RBAC** | Role-based access control. | **Partial** — backend guards; frontend uses **simulated** persona dropdown, not Keycloak roles. |
| **ABAC** | Attribute-based access control. | **Not started** |
| **BullMQ** | Redis-backed job queue (payroll, notifications). | **Done** — payroll queue; notification queue not wired. |
| **Webhook** | HTTP callback on business events (HMAC-signed per PDF). | **Not started** |
| **HMAC** | Hash-based message authentication for webhook signatures. | **Not started** |
| **TimescaleDB** | PostgreSQL extension for time-series (audit/telemetry). | **Not started** — plain PostgreSQL 17 in Docker. |
| **Elasticsearch** | Full-text search for vendors/products/documents. | **Partial** — in Docker Compose; no search API wired. |
| **Keycloak** | Identity provider for OIDC/SAML and JWT. | **Done** — Docker + frontend/backend integration. |
| **GraphQL** | Flexible query API (Apollo v4 in PDF). | **Not started** |
| **OpenAPI** | Machine-readable REST API specification. | **Done** — Swagger + `docs/api/openapi.yaml`. |
| **shadcn/ui** | Accessible UI component kit (Radix + Tailwind). | **Not started** — custom `components/ui/*` instead. |
| **Zustand** | Lightweight client state store. | **Not started** — empty `stores/` folder. |
| **React Query** | Server state / caching (TanStack v5). | **Partial** — installed + `QueryProvider` exists but **not used in root layout**. |
| **Istio / mTLS** | Service mesh with mutual TLS between services. | **Not started** |
| **Kubernetes / Helm** | Container orchestration and packaging. | **Not started** — no manifests or charts. |
| **ArgoCD** | GitOps continuous delivery. | **Not started** |
| **Terraform** | Infrastructure as Code. | **Not started** — no `.tf` files. |
| **OpenTelemetry** | Distributed tracing and metrics. | **Not started** — only transitive lockfile references. |
| **k6** | Load testing tool (2,000 concurrent users target). | **Not started** |
| **SOC 2** | Security/compliance control framework. | **Not started** — design alignment only. |
| **OWASP** | Web application security standard. | **Partial** — DTO validation; no Helmet, throttling, CSRF, ZAP scans. |
| **WCAG 2.1 AA** | Web accessibility standard. | **Not started** — no audit performed. |
| **RPO / RTO** | Recovery point/time objectives for DR. | **Not started** — no DR runbook in repo. |
| **HPA** | Kubernetes Horizontal Pod Autoscaler. | **Not started** |
| **MLflow** | ML model versioning and registry. | **Not started** |
| **Distroless** | Minimal container base image (PDF Day 22). | **Not verified** — Dockerfiles exist. |
| **Self-serve BI** | Users build their own reports without IT tickets. | **Not started** |
| **Period close** | Lock fiscal period to prevent posting. | **Done** (model + GL service checks). |
| **Intercompany** | Transfers between legal entities within a group. | **Partial** — model exists; end-to-end flow not verified. |
| **Payment run** | Batch outbound supplier payments. | **Partial** — `PaymentRun` model; UI flow not verified. |
| **Statutory compliance** | Legal payroll/tax rules by jurisdiction. | **Partial** — configurable tax slabs only. |
| **Organisational chart** | Visual reporting hierarchy (PDF Day 10). | **Not started** — department hierarchy in DB only. |

---

## 6. Technology Stack — Company Spec vs This Repo

| Category | PDF specifies | This repo has | Match? |
|----------|---------------|---------------|--------|
| Frontend | **Next.js 15 + React 19 + TypeScript 5.5** | Next.js 15.5.19, React 19.1 | ✅ |
| UI library | **shadcn/ui + Radix + Tailwind CSS 4** | Custom UI + Tailwind 4 | ❌ |
| State | **Zustand + React Query (TanStack v5)** | React Query installed, unused in layout; no Zustand | ⚠️ |
| Charts | **Recharts + ECharts + D3.js** | Recharts in package.json only; no ECharts/D3 | ⚠️ |
| Backend | **Node.js 22 + NestJS 11** | NestJS 11, TypeScript | ✅ |
| API | **REST + GraphQL (Apollo v4)** | REST + Swagger only | ❌ |
| Database | **PostgreSQL 17 + Prisma** | PostgreSQL 17 in Docker + Prisma (62 models) | ✅ |
| Time-series | **TimescaleDB** | Not used | ❌ |
| Cache/queue | **Redis 8 + BullMQ** | Redis 8 + BullMQ (payroll, outbox) | ✅ |
| ML | **Python FastAPI + Prophet + LSTM** | No source code | ❌ |
| Search | **Elasticsearch 8.15** | Container only; no app integration | ⚠️ |
| Auth | **Keycloak 25 + JWT RS256** | Keycloak 25 + passport-jwt | ✅ |
| Email | **AWS SES + Resend** | Empty `EmailChannel` | ❌ |
| Monorepo | **Turborepo + pnpm** | turbo.json + pnpm-workspace | ✅ |
| Docker | **Docker 27 multi-stage** | Dockerfiles + docker-compose | ⚠️ |
| Orchestration | **Kubernetes 1.31 + Helm 3** | Missing | ❌ |
| Service mesh | **Istio 1.22** | Missing | ❌ |
| CI/CD | **GitHub Actions + ArgoCD** | No `.github/workflows/` | ❌ |
| Observability | **OpenTelemetry + Prometheus + Grafana + Loki** | Pino logging only | ❌ |
| Security scan | **Trivy + Snyk + OWASP ZAP** | Missing | ❌ |
| Testing | **Vitest + Playwright + k6 + Jest** | `@nestjs/testing` only; **0 test files** | ❌ |
| IaC | **Terraform 1.9 + Terragrunt** | Missing | ❌ |

**Stack mismatch summary:** The repo follows the **monolith + Postgres + Redis + Keycloak + NestJS + Next.js** spine from the PDF, but diverges on **UI kit**, **GraphQL**, **ML service**, **BI charts**, **notifications/email**, **search wiring**, and **all production ops** (K8s, CI/CD, observability, IaC).

---

## 7. Frontend — API Connection Matrix

| Page | PDF module | Data source | Status |
|------|------------|-------------|--------|
| `/scm/vendors` | F-05 vendor management | `scmApi.getVendors()` | ✅ Live API |
| `/scm/purchase-orders` | F-05 PO lifecycle | SCM API | ✅ Live API |
| `/scm/inventory` | F-05 stock levels | SCM API | ✅ Live API |
| `/scm/invoices`, `/finance/invoices` | F-03 AP/AR | Finance API | ✅ Live API |
| `/scm/goods-receipt` | F-05 GR | SCM API | ✅ Live API |
| `/hr/employees` | F-04 employees | Direct fetch | ✅ Live API |
| `/home` | F-04 self-service HR | Attendance/leave APIs | ✅ Live API |
| `/finance/accounts` | F-02 GL | Mock | ⚠️ API ready |
| `/finance/journal-entries` | F-02 GL | `MOCK_ENTRIES` | ⚠️ API ready |
| `/finance/aging-report` | F-03 AR | `MOCK_ROWS` | ⚠️ API ready |
| `/hr/leave-requests` | F-04 leave | `@/lib/mock/hr` | ⚠️ API ready |
| `/hr/attendance` | F-04 attendance | `@/lib/mock/hr` | ⚠️ API ready |
| `/hr/payroll` | F-04 payroll | Mock/partial | ⚠️ API ready |
| `/projects/*` | F-07 PM | `@/lib/mock/pm-v2` | ⚠️ API exists |
| `/settings` | F-09 / IT admin | `@/lib/mock/it` | ⚠️ Partial real tenant API |
| `/notifications` | F-10 | Nav link exists | ❌ **Page missing** |

---

## 8. 28-Day Execution Plan (PDF Section 4)

| Week / Day | PDF topic | Status |
|------------|-----------|--------|
| Day 1 | Discovery & planning | ✅ PDF is the artefact |
| Day 2 | Architecture (C4, ERD, OpenAPI) | ✅ `docs/c4/*`, Prisma schema, `openapi.yaml` |
| Day 3 | Monorepo + Docker Compose | ✅ Turborepo, Postgres, Redis, Keycloak, Elasticsearch |
| Day 4 | Auth & multi-tenancy | ✅ Keycloak, JWT, tenant context |
| Day 5 | Domain models & migrations | ✅ 62 Prisma models, seed script |
| Day 6 | API gateway & health checks | ✅ Swagger, `/health` |
| Day 7 | Week 1 review & ADRs | ⚠️ Only 1 ADR (`003-realm-per-tenant-isolation.md`) |
| Day 8–9 | GL & AP/AR | ✅ Backend complete; UI partly mock |
| Day 10 | HR core | ✅ Backend; UI partly mock |
| Day 11 | Payroll engine | ✅ BullMQ + payslip PDF |
| Day 12–13 | SCM & inventory | ✅ Except vendor portal & notifications |
| Day 14 | Integration tests | ❌ No tests |
| Day 15–16 | AI forecasting | ❌ |
| Day 17 | BI dashboard | ❌ |
| Day 18 | Project management | ⚠️ No Gantt |
| Day 19 | Notification engine | ⚠️ Stubs only |
| Day 20 | Security hardening | ❌ No Helmet/throttler/CSRF |
| Day 21 | Load testing | ❌ |
| Day 22 | Containerisation | ⚠️ Dockerfiles exist |
| Day 23 | Kubernetes / Helm | ❌ |
| Day 24 | CI/CD | ❌ |
| Day 25 | Cloud deployment | ❌ |
| Day 26 | Observability | ❌ |
| Day 27 | Demo video & README | ⚠️ Docs exist; no video |
| Day 28 | Final QA | ❌ |

---

## 9. Submission Deliverables (PDF Section 9)

| # | PDF deliverable | Status |
|---|-----------------|--------|
| 1 | **Project Report (PDF)** | ✅ `Amdox Web.pdf` present |
| 2 | **Live Public Demo URL** | ❌ Not deployed |
| 3 | **GitHub Repository** | ✅ Repo exists; needs mock→API wiring & cleanup |
| 4 | **README.md** | ⚠️ Exists; missing screenshots & video link |
| 5 | **Demo Video (5–7 min)** | ❌ Not recorded |

PDF evaluation weights: Innovation 15, Technical depth 25, Functionality 20, Documentation 20, Deployment 10, Presentation 10 — **total 100**.

---

## 10. Highest-Priority Gaps (Recommended Order)

1. **Deploy a live demo URL** — PDF weights this at **30%** of submission.
2. **Wire mock frontend pages to existing APIs** — fastest way to improve Functionality score.
3. **Record demo video** — 10% of submission; walk through Finance → SCM → HR flows.
4. **Minimal BI dashboard with Recharts** — satisfies F-08 surface area; library already installed.
5. **Helmet + rate limiting + GitHub Actions CI** — Security & Deployment sections.
6. **Implement notification email/webhook** — unlocks F-05 “vendor notified via email/webhook”.
7. **ML service skeleton (Prophet `/predict`)** — Innovation score; even a simple baseline helps.
8. **Replace dummy audit/GDPR with real services** — F-09 and IT admin persona.

---

## 11. File References (Quick Navigation)

| Area | Key paths |
|------|-----------|
| Database schema (62 models) | `packages/db/prisma/schema.prisma` |
| API entry | `apps/api/src/main.ts`, `apps/api/src/app.module.ts` |
| Auth | `apps/api/src/auth/`, `apps/web/src/components/KeycloakProvider.tsx` |
| Finance | `apps/api/src/finance/` |
| HR | `apps/api/src/hr/` |
| SCM | `apps/api/src/scm/` |
| PM | `apps/api/src/pm/` |
| Audit/GDPR (stubs) | `apps/api/src/audit/` |
| Notifications (stubs, not in AppModule) | `apps/api/src/notification/` |
| Frontend dashboard | `apps/web/src/components/layout/dashboardLayout.tsx` |
| Mock data | `apps/web/src/lib/mock/` |
| Docker dev stack | `infra/docker/docker-compose.yml` |
| Architecture docs | `docs/c4/`, `docs/api/openapi.yaml` |

---

*This document should be updated whenever a PDF requirement moves from Partial → Done. Prefer quoting the PDF phrase in commit messages or PR descriptions to maintain traceability.*
