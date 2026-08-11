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

All items originally listed here are now done, verified against the code:
[x] Wire `projects/new` wizard to POST `/pm/projects` — `pmApi.createProject()` call confirmed in `apps/web/src/app/(dashboard)/projects/new/page.tsx`.
[x] Invoice upload UI + `financeApi.uploadInvoice` — both the API method and the calling UI exist.
[x] SCM inventory page: forecast train button per product — `forecastApi.train(productId)` wired to a button in `scm/inventory/page.tsx`.
[x] HR leave/attendance pages: remove dead mock imports — `lib/mock/` no longer exists at all (removed this session).
[x] Deploy + demo video — app is publicly live; demo video link is in the README.

The only item still genuinely open:

- [ ] Install `@aws-sdk/client-textract` when ready for real OCR (`apps/api/src/finance/ap/ocr.service.ts` intentionally lazy-`require`s it only when `OCR_PROVIDER=textract` is set — package deliberately not installed yet)

---

## Out of scope (this sprint)

All items originally listed here as out-of-scope were actually built:

- Real email/SMS/webhook delivery — `notification/channels/{email,sms,webhook}.channel.ts` all do real dispatch (SMTP/Nodemailer, HTTP webhook, HMAC-signed webhook respectively).
- Vendor external portal — full portal exists on both sides (`apps/api/src/scm/vendor-portal/`, `apps/web/src/app/vendor-portal/`).
- Kubernetes / CI/CD deployment — Helm chart (`infra/helm/amdox/`) + ArgoCD GitOps manifest (`infra/argocd/amdox-prod.yaml`) both exist.
- GraphQL gateway — `apps/api/src/infrastructure/graphql/` implements a real, auth-guarded GraphQL API.

Still genuinely out of scope:

- PWA / offline

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
