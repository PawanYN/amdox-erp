# Amdox ERP — Implementation Status vs Company Specification

> **Company document:** [`Amdox Web.pdf`](./Amdox%20Web.pdf) — _AMX-ERP-2026-04, Version 1.0, April 2026_
> **Last full re-verification:** 13 July 2026 (supersedes the 3 July version of this file, which pre-dated the deployment/testing/observability sprints and is no longer accurate)
> **Detailed evidence:** [`TDD-Audit-Report.md`](../audits/TDD-Audit-Report.md) (line-by-line audit, 11 July) · [`team_assignment.md`](./team_assignment.md) (task ledger, 12 July)

---

## 1. Executive Summary

**11 of 12 functional requirements (F-01 → F-12) are implemented and verified against the running system.** The app is **publicly live at https://erp.92-4-86-3.sslip.io** (Oracle Cloud VM, Caddy auto-HTTPS, pm2) with Swagger at `/api-docs` and Keycloak at `https://kc.92-4-86-3.sslip.io`.

| Area                                 | Status                                                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional requirements F-01 → F-12  | 11 Done · 1 Not started (F-12 PWA — de-scoped, on roadmap)                                                                                                                                                                             |
| Tracked engineering tasks (43 total) | 39 done · 2 partial · 2 open (FE 18/18, BE 9/11, INT 9/9, PLAT 3/5)                                                                                                                                                                    |
| Submission deliverables (5 items)    | Report (this repo) · Live URL ✅ · GitHub ✅ · README ✅ · Demo video ✅ (LinkedIn link in README)                                                                                                                                     |
| Testing                              | 64/64 authenticated API checks · 31 CI unit tests (money paths incl. line-level match + partial receipts) · k6 2,000-VU load test · Lighthouse ≥ 90 on audited pages                                                                   |
| Operations                           | CI pipeline (lint/typecheck/tests/security scans) · Docker multi-stage distroless · Helm + Sealed Secrets + Istio canary on kind · ArgoCD GitOps · Full observability stack (OTel, Prometheus, Grafana, Loki, Tempo) with SLA alerting |

## 2. Functional Requirements Scoreboard

| Req  | Name                    | Status | Notes / deviations                                                                                                                                                                                                             |
| ---- | ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F-01 | Multi-tenant auth (SSO) | ✅     | Realm-per-tenant Keycloak, OIDC + Google auto-link, **per-tenant MFA toggle** (11 July); SAML adapter tested live (`testing/SAML_SSO_TEST_LOG.md`)                                                                             |
| F-02 | Financial ledger (GL)   | ✅     | Double-entry + period-close enforced; auto-posting listeners; ECB FX rates fetched daily but **conversion not applied** (roadmap)                                                                                              |
| F-03 | AP/AR automation        | ✅     | Textract OCR (mock fallback without AWS creds); **line-level 3-way match** (qty ≤ received, unit price within 2% of PO line; header-level fallback) + partial goods receipts — closed 13 July (`999cd39`); payment runs, aging |
| F-04 | HR & payroll            | ✅     | Chunked BullMQ gross-to-net engine (PF/ESI/PT/TDS slabs), payslip PDFs; **double-payslip retry bug found & fixed 11 July** (`verify:payroll-retry`); **leave accrual** via monthly cron — closed 13 July                       |
| F-05 | SCM & inventory         | ✅     | Requisition → PO → GR (**partial receipts supported**, `GoodsReceiptLine` per-delivery trail), real FIFO cost layers (in + out), reorder automation, vendor portal, vendor email/webhook notify                                |
| F-06 | AI demand forecasting   | ✅     | FastAPI ml-service: Prophet + PyTorch LSTM for high-volume SKUs, Redis-cached, weekly retrain; **MAPE breach alerting** (`forecast.mape_breach` when >12%) — closed 13 July                                                    |
| F-07 | Project management      | ✅     | DAG-validated tasks, Gantt, utilisation heatmap, budget actuals fed from AP + payroll, overrun alerts at >110%                                                                                                                 |
| F-08 | Business intelligence   | ✅     | Drag-drop grid builder (`react-grid-layout`), 10+ chart types, SSE live refresh, scheduled real PDF/XLSX reports                                                                                                               |
| F-09 | Audit & compliance      | ✅     | SHA-256 hash-chained audit log + verify routine; GDPR DSR + consent; Postgres (not TimescaleDB)                                                                                                                                |
| F-10 | Notification engine     | ✅     | In-app (SSE) + email + SMS + HMAC webhook; per-user/channel preferences; 5-attempt retry + Bull Board DLQ at `/admin/queues`                                                                                                   |
| F-11 | API gateway & webhooks  | ✅     | Versioned REST (`api/v1`) + Swagger, GraphQL (Apollo), outbound HMAC webhooks, Elasticsearch search (10 entity types)                                                                                                          |
| F-12 | Offline / PWA           | ❌     | De-scoped for MVP (TDD Day-1 de-scope list); on roadmap                                                                                                                                                                        |

## 3. Non-Functional Requirements — Evidence

| NFR              | Target                 | Evidence                                                                                                                         |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| API latency      | < 300 ms P95           | k6: p95 = 39 ms on served requests (`testing/K6_LOAD_TEST_LOG.md`)                                                               |
| Throughput       | 2,000 concurrent users | k6 2,000-VU/10-min runs; surfaced & fixed JWKS + throttler bugs                                                                  |
| Security         | OWASP Top 10 + scans   | Helmet/CSP, user-aware rate limiting, tenant-scoping CI gate, TruffleHog/Grype/Trivy (`docs/audits/security-hardening-audit.md`) |
| Availability     | 99.9 %                 | Single-VM deployment — SLA alert rules exist (Grafana); HA = roadmap                                                             |
| Frontend quality | Lighthouse ≥ 90        | `/login` 90, `/home` 93 (prod build); `/bi` 76 (`testing/LIGHTHOUSE_AUDIT.md`)                                                   |

## 4. Technology Stack — Spec vs Repo (current)

| Category      | PDF specifies                      | Repo has                                                                        | Match                     |
| ------------- | ---------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| Frontend      | Next.js 15 + React 19 + TS         | Next.js 15.5 + React 19.1                                                       | ✅                        |
| UI library    | shadcn/ui + Tailwind 4             | Custom component kit + Tailwind 4                                               | ⚠️ deviation (documented) |
| Charts        | Recharts + ECharts + D3            | Recharts + ECharts (D3 not needed)                                              | ⚠️                        |
| Backend       | Node 22 + NestJS 11                | NestJS 11 modular monolith                                                      | ✅                        |
| API           | REST + GraphQL                     | REST (`api/v1`) + Swagger + GraphQL (Apollo)                                    | ✅                        |
| Database      | PostgreSQL 17 + Prisma             | PostgreSQL 17 + Prisma (66 tables)                                              | ✅                        |
| Time-series   | TimescaleDB                        | Plain Postgres + hash chain for audit                                           | ⚠️ deviation (documented) |
| Cache/queue   | Redis 8 + BullMQ                   | Redis 8 (noeviction) + BullMQ (payroll, outbox, notifications, retrain)         | ✅                        |
| ML            | Python FastAPI + Prophet + LSTM    | FastAPI + Prophet + PyTorch LSTM                                                | ✅                        |
| Search        | Elasticsearch 8                    | Elasticsearch, 10 entities, real-time sync                                      | ✅                        |
| Auth          | Keycloak 25 (OIDC/SAML) + JWT      | Keycloak 25, realm-per-tenant, MFA, SAML tested                                 | ✅                        |
| Email         | AWS SES + Resend                   | Nodemailer → Mailpit (dev) / SMTP (prod); SES = swap-in                         | ⚠️                        |
| Containers    | Docker multi-stage + distroless    | All 3 services, distroless, verified live                                       | ✅                        |
| Orchestration | Kubernetes + Helm                  | Helm chart (HPA/PDB/Ingress/Istio canary), 3 namespaces on kind, Sealed Secrets | ✅ (local cluster)        |
| CI/CD         | GitHub Actions + ArgoCD            | `ci.yml` (7 jobs) + ArgoCD GitOps w/ self-heal, smoke-test hook                 | ✅                        |
| Observability | OTel + Prometheus + Grafana + Loki | Full stack incl. Tempo + tail sampling (100% err / 10% ok) + SLA email alerts   | ✅                        |
| Load testing  | k6                                 | 2,000-VU runs, 3 real bugs found, log committed                                 | ✅                        |
| IaC           | Terraform                          | Not implemented (single-VM deploy; Helm values per env)                         | ❌ roadmap                |

## 5. Remaining Gaps (all tracked)

1. **F-12 PWA/offline** — the only unimplemented functional requirement.
2. **Multi-currency conversion** — FX rates fetched daily but not applied in postings/reports.
3. **Terraform IaC**; HA/multi-node deployment.

_Closed 13 July (`999cd39`), formerly on this list: line-level 3-way matching, partial goods receipts, leave accrual, MAPE breach alerting._

## 6. Key Documents Map

| Topic                               | Document                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Line-by-line TDD audit              | `docs/audits/TDD-Audit-Report.md`                                                                     |
| Task ledger + session history       | `docs/planning/team_assignment.md`                                                                    |
| Architecture                        | `docs/architecture/backend_architecture.md`, `docs/architecture/frontend_architecture.md`, `docs/c4/` |
| Auth flow (password/Google/SSO/MFA) | `docs/architecture/auth-flow.md`                                                                      |
| Security hardening audit            | `docs/audits/security-hardening-audit.md`                                                             |
| Observability stack                 | `docs/architecture/observability.md`                                                                  |
| Deployment walkthrough              | `docs/learning/PLAT-01-public-deployment-walkthrough.md`                                              |
| Testing logs                        | `testing/` — k6, Lighthouse, query optimisation, SAML SSO, terminal, bundle analysis                  |
| RBAC matrix                         | `docs/architecture/rbac-role-matrix.md`                                                               |

---

_This document is the quick answer to "where does the project stand vs the spec?" — update it whenever a roadmap item closes. For per-claim evidence, always defer to the TDD audit report._
