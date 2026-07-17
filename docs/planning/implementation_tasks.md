# Amdox ERP — Module Completion Tasks

> **Goal:** Complete all **Partial** modules before deployment. Notifications use **terminal logging only** (no email/SMS credentials). OCR uses configurable external API via `.env`.

**Status legend:** `[ ]` pending · `[~]` in progress · `[x]` done

---

## Phase 1 — Backend foundations

- [x] **T1** Audit: hash-chain writes + Prisma persistence + event listeners
- [x] **T2** GDPR: DSR create/list/fulfill endpoints + consent records
- [x] **T3** Notifications: register module, event listeners, terminal `Logger` dispatch (no SMTP)
- [x] **T4** OCR: AWS Textract via env (`OCR_PROVIDER=textract` + `@aws-sdk/client-textract`) / mock fallback
- [x] **T5** Finance: add `GET /finance/gl/journal-entries` for frontend

## Phase 2 — PM + AI + BI modules

- [x] **T6** PM backend: GET projects/tasks/budgets/milestones + DAG cycle check + overrun alerts
- [x] **T7** ML service: `apps/ml-service` FastAPI + Prophet predict/train + NestJS forecast client
- [x] **T8** BI backend: dashboard/widget CRUD + KPI aggregate endpoints
- [x] **T9** BI frontend: executive dashboard with Recharts (`/bi`)

## Phase 3 — Frontend cleanup & wiring

- [x] **T10** API clients: `pm-api.ts`, `audit-api.ts`, `bi-api.ts`, `notification-api.ts`, `forecast-api.ts`; extended `finance-api.ts`
- [x] **T11** Wire finance pages: accounts, journal-entries, aging-report
- [x] **T12** Wire PM pages: overview, tasks, resources, budget
- [x] **T13** Wire settings: audit logs + GDPR tabs to real APIs
- [x] **T14** Add `/notifications` page (in-app list from API)
- [x] **T15** UI cleanup: removed orphan CRM/Reports components and unused mocks; QueryProvider in layout; Executive BI in nav
- [x] **T16** Update `.env.example` with OCR + ML vars

---

## Remaining (next sprint)

- [ ] Wire `projects/new` wizard to POST `/pm/projects`
- [ ] Invoice upload UI + `financeApi.uploadInvoice`
- [ ] SCM inventory page: forecast train button per product
- [ ] HR leave/attendance pages: remove dead mock imports (APIs already wired)
- [ ] Install `@aws-sdk/client-textract` when ready for real OCR
- [ ] Deploy + demo video (after local verification)

---

## Out of scope (this sprint)

- Real email/SMS/webhook delivery
- Vendor external portal
- PWA / offline
- Kubernetes / CI/CD deployment
- GraphQL gateway

---

## How to run ML service locally

```bash
cd apps/ml-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8091
```

Set `ML_SERVICE_URL=http://localhost:8091` in `.env`.

## How to enable real OCR (≥95% target)

1. `pnpm add @aws-sdk/client-textract --filter api`
2. Add to `.env`:
   ```
   OCR_PROVIDER=textract
   AWS_ACCESS_KEY_ID=your_key
   AWS_SECRET_ACCESS_KEY=your_secret
   AWS_REGION=ap-south-1
   ```
