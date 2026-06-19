# C4 Container Diagram — Amdox AI-Powered Cloud ERP Suite

## How to use
1. Copy the code block below
2. Paste into **mermaid.live** (browser) or GitHub `.md` file or Notion `/mermaid` block
3. Diagram renders automatically

```mermaid
C4Container
    title Container Diagram — Amdox AI-Powered Cloud ERP Suite

    Person(user, "ERP Users", "Finance, HR, SCM, PM, IT Admin, Executives")

    System_Boundary(erp, "Amdox ERP Suite") {

        Container(web, "Web Application", "Next.js 15, React 19, TypeScript", "SSR/SSG frontend — dashboards, forms, reports. Served via Vercel or CloudFront.")

        Container(api, "API Server", "NestJS 11, TypeScript, REST + GraphQL", "Modular monolith — all business logic: Finance, HR, SCM, PM, Auth, Notifications. JWT validation + tenant context injection.")

        Container(ml, "ML Forecasting Service", "Python 3.13, FastAPI, Prophet, LSTM", "Demand forecasting microservice. Endpoints: /train, /predict, /health. Weekly model retrain.")

        ContainerDb(db, "Primary Database", "PostgreSQL 17 + TimescaleDB", "Core tables: Tenant, User, Account, JournalEntry, Employee, PurchaseOrder, InventoryItem. Audit logs in TimescaleDB.")

        ContainerDb(cache, "Cache & Queue", "Redis 8 + BullMQ", "Session store, refresh token blacklist, job queues (payroll, email, webhooks), real-time pub/sub, ML prediction cache.")

        ContainerDb(search, "Search Engine", "Elasticsearch 8", "Full-text search: vendors, products, documents, employees.")
    }

    System_Ext(idp, "Identity Provider", "Azure AD / Google Workspace — SAML/OIDC")
    System_Ext(email, "Email Gateway", "AWS SES + Resend fallback")
    System_Ext(fx, "FX Rate API", "ECB / OpenExchangeRates")
    System_Ext(s3, "File Storage", "AWS S3 + CloudFront")

    Rel(user, web, "Uses", "HTTPS")
    Rel(web, api, "Calls", "REST + GraphQL over HTTPS")
    Rel(api, db, "Reads/Writes", "Prisma ORM")
    Rel(api, cache, "Sessions, queues, pub/sub", "ioredis")
    Rel(api, search, "Indexes & queries", "ES client")
    Rel(api, ml, "Requests predictions", "Internal REST over Istio mTLS")
    Rel(ml, db, "Reads training data", "SQL")
    Rel(ml, cache, "Caches predictions", "ioredis")
    Rel(api, idp, "Authenticates users", "SAML/OIDC")
    Rel(api, email, "Sends notifications", "SMTP/API")
    Rel(api, fx, "Fetches FX rates", "REST")
    Rel(api, s3, "Stores/retrieves files", "S3 API")
```

## What this diagram shows

### Inside the ERP box (6 containers):

1. **Web Application (Next.js 15)**
   - The frontend users interact with — renders pages server-side for fast load
   - Talks ONLY to the API server, never directly to the DB

2. **API Server (NestJS 11)**
   - The brain — ALL business logic lives here (Finance, HR, SCM, Auth, Notifications)
   - "Modular monolith" = one deployable unit but internally organized by domain modules
   - Handles JWT validation, tenant context injection, RBAC

3. **ML Forecasting Service (Python FastAPI)**
   - Separate microservice — only does demand forecasting
   - Communicates with API server over internal REST (Istio mTLS for zero-trust)
   - Reads training data from PostgreSQL, caches predictions in Redis

4. **Primary Database (PostgreSQL 17 + TimescaleDB)**
   - Single source of truth for all transactional data
   - TimescaleDB extension handles time-series audit logs + telemetry

5. **Cache & Queue (Redis 8 + BullMQ)**
   - Multi-purpose: session store, job queues (payroll batch, emails), pub/sub, prediction cache
   - BullMQ = Redis-backed queue for async jobs with retry/dead-letter support

6. **Search Engine (Elasticsearch 8)**
   - Full-text search across vendors, products, documents
   - Kept separate from PostgreSQL because SQL LIKE queries don't scale for search UX

### Outside the box (external systems):
- Same 4 external dependencies from the Context diagram (IdP, Email, FX, S3)

## Key architecture decisions visible here:
- Frontend NEVER talks directly to DB — always through API (security boundary)
- ML service is the ONLY microservice — everything else is modular monolith (keeps complexity manageable for 28-day timeline)
- Redis does triple duty (sessions + queues + cache) — single dependency, simpler ops
- All internal service-to-service traffic goes through Istio mTLS (zero-trust networking)

## Next level
- **C4 Component** — zoom INTO the API Server box → shows individual domain modules (Finance, HR, SCM, Auth, Notification)
