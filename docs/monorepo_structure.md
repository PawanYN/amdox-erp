# Monorepo Structure — Amdox AI-Powered Cloud ERP Suite

## How to use
This is the folder structure your team creates on Day 3. Copy this as-is when initializing the repo.

## Folder Tree

```
amdox-erp/
│
├── .github/
│   └── workflows/
│       ├── ci.yml                    # GitHub Actions — lint → test → build → docker → deploy
│       └── security-scan.yml         # Trivy + Snyk + trufflehog
│
├── apps/
│   │
│   ├── web/                          # FRONTEND — Next.js 15
│   │   ├── src/
│   │   │   ├── app/                  # App Router (Next.js 15)
│   │   │   │   ├── (auth)/           # Auth route group — login, SSO callback
│   │   │   │   ├── (dashboard)/      # Protected route group
│   │   │   │   │   ├── finance/      # GL, invoices, aging reports
│   │   │   │   │   ├── hr/           # Employees, leave, payroll
│   │   │   │   │   ├── scm/          # Vendors, POs, inventory
│   │   │   │   │   └── settings/     # Tenant config, user prefs
│   │   │   │   ├── layout.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── components/           # App-specific components (not shared)
│   │   │   ├── hooks/                # Custom React hooks
│   │   │   ├── lib/                  # API client, auth helpers, utils
│   │   │   ├── stores/               # Zustand stores (client state)
│   │   │   └── styles/               # Tailwind config, global CSS
│   │   ├── public/                   # Static assets
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── tsconfig.json             # Extends root tsconfig
│   │   └── package.json
│   │
│   ├── api/                          # BACKEND — NestJS 11
│   │   ├── src/
│   │   │   ├── main.ts               # Bootstrap — global pipes, filters, interceptors
│   │   │   ├── app.module.ts          # Root module — imports all domain modules
│   │   │   │
│   │   │   ├── common/               # Shared backend code
│   │   │   │   ├── guards/           # RBAC guard, tenant guard
│   │   │   │   ├── interceptors/     # Logging, audit, transform
│   │   │   │   ├── filters/          # Global exception filter
│   │   │   │   ├── pipes/            # Validation pipe (class-validator)
│   │   │   │   ├── decorators/       # @TenantId(), @Roles(), @CurrentUser()
│   │   │   │   ├── middleware/       # Tenant context middleware
│   │   │   │   └── dto/              # Shared DTOs (pagination, error response)
│   │   │   │
│   │   │   ├── auth/                 # F-01 — Auth Module
│   │   │   │   ├── auth.module.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── strategies/       # passport-jwt, SAML, OIDC strategies
│   │   │   │   ├── guards/           # JWT guard, MFA guard
│   │   │   │   └── dto/              # LoginDto, TokenDto
│   │   │   │
│   │   │   ├── finance/              # F-02/F-03 — Finance Module
│   │   │   │   ├── finance.module.ts
│   │   │   │   ├── gl/               # General Ledger
│   │   │   │   │   ├── gl.controller.ts
│   │   │   │   │   ├── gl.service.ts
│   │   │   │   │   ├── account.repository.ts
│   │   │   │   │   └── journal-entry.repository.ts
│   │   │   │   ├── ap/               # Accounts Payable
│   │   │   │   │   ├── ap.controller.ts
│   │   │   │   │   ├── ap.service.ts
│   │   │   │   │   └── invoice-matching.service.ts
│   │   │   │   ├── ar/               # Accounts Receivable
│   │   │   │   │   ├── ar.controller.ts
│   │   │   │   │   └── ar.service.ts
│   │   │   │   ├── fx/               # FX rate fetcher
│   │   │   │   │   └── fx-rate.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── hr/                   # F-04 — HR Module
│   │   │   │   ├── hr.module.ts
│   │   │   │   ├── employee/
│   │   │   │   │   ├── employee.controller.ts
│   │   │   │   │   ├── employee.service.ts
│   │   │   │   │   └── employee.repository.ts
│   │   │   │   ├── leave/
│   │   │   │   │   ├── leave.controller.ts
│   │   │   │   │   ├── leave.service.ts
│   │   │   │   │   └── leave-state-machine.ts
│   │   │   │   ├── attendance/
│   │   │   │   │   ├── attendance.controller.ts
│   │   │   │   │   └── attendance.service.ts
│   │   │   │   ├── payroll/
│   │   │   │   │   ├── payroll.controller.ts
│   │   │   │   │   ├── payroll.service.ts
│   │   │   │   │   ├── payroll.processor.ts   # BullMQ job processor
│   │   │   │   │   ├── tax-engine.ts          # Configurable tax slabs
│   │   │   │   │   └── payslip-generator.ts   # PDF generation
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── scm/                  # F-05 — Supply Chain Module
│   │   │   │   ├── scm.module.ts
│   │   │   │   ├── vendor/
│   │   │   │   │   ├── vendor.controller.ts
│   │   │   │   │   ├── vendor.service.ts
│   │   │   │   │   └── vendor.repository.ts
│   │   │   │   ├── purchase-order/
│   │   │   │   │   ├── po.controller.ts
│   │   │   │   │   ├── po.service.ts
│   │   │   │   │   └── po-state-machine.ts
│   │   │   │   ├── inventory/
│   │   │   │   │   ├── inventory.controller.ts
│   │   │   │   │   ├── inventory.service.ts
│   │   │   │   │   └── reorder.service.ts     # Auto-reorder trigger
│   │   │   │   ├── goods-receipt/
│   │   │   │   │   ├── gr.controller.ts
│   │   │   │   │   └── gr.service.ts
│   │   │   │   └── dto/
│   │   │   │
│   │   │   ├── notification/          # F-10 — Notification Module
│   │   │   │   ├── notification.module.ts
│   │   │   │   ├── notification.controller.ts
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── channels/
│   │   │   │   │   ├── email.channel.ts       # AWS SES
│   │   │   │   │   ├── in-app.channel.ts      # SSE
│   │   │   │   │   └── webhook.channel.ts     # HMAC signed (V2)
│   │   │   │   ├── event-listeners/           # Domain event handlers
│   │   │   │   └── notification.processor.ts  # BullMQ consumer
│   │   │   │
│   │   │   ├── audit/                 # F-09 — Audit Module
│   │   │   │   ├── audit.module.ts
│   │   │   │   ├── audit.controller.ts
│   │   │   │   ├── audit.service.ts
│   │   │   │   ├── audit.interceptor.ts       # Auto-logs all mutations
│   │   │   │   ├── hash-chain.service.ts      # Tamper detection
│   │   │   │   └── gdpr/
│   │   │   │       ├── gdpr.controller.ts
│   │   │   │       └── gdpr.service.ts
│   │   │   │
│   │   │   └── health/                # System health
│   │   │       ├── health.controller.ts
│   │   │       └── health.service.ts
│   │   │
│   │   ├── test/                      # Integration tests (Vitest + Supertest)
│   │   │   ├── auth.e2e-spec.ts
│   │   │   ├── finance.e2e-spec.ts
│   │   │   ├── hr.e2e-spec.ts
│   │   │   └── scm.e2e-spec.ts
│   │   ├── nest-cli.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── ml-service/                    # ML SERVICE — Python FastAPI (V2, but infra set up now)
│       ├── app/
│       │   ├── main.py                # FastAPI bootstrap
│       │   ├── routers/
│       │   │   ├── predict.py         # /predict endpoint
│       │   │   ├── train.py           # /train endpoint
│       │   │   └── health.py          # /health endpoint
│       │   ├── models/
│       │   │   ├── prophet_model.py
│       │   │   └── lstm_model.py
│       │   ├── services/
│       │   │   └── forecasting.py
│       │   └── config.py
│       ├── tests/
│       ├── requirements.txt
│       ├── Dockerfile
│       └── pyproject.toml
│
├── packages/
│   │
│   ├── db/                            # SHARED — Prisma schema + client
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # All 24 entities defined here
│   │   │   ├── migrations/            # Auto-generated migration files
│   │   │   └── seed.ts                # Dev seed data
│   │   ├── src/
│   │   │   ├── client.ts              # Prisma client singleton (tenant-aware)
│   │   │   └── middleware/
│   │   │       ├── tenant-filter.ts   # Auto-injects tenantId WHERE clause
│   │   │       └── soft-delete.ts     # Auto-filters deletedAt IS NULL
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── ui/                            # SHARED — UI component library
│   │   ├── src/
│   │   │   ├── components/            # shadcn/ui + Radix primitives
│   │   │   │   ├── button.tsx
│   │   │   │   ├── data-table.tsx
│   │   │   │   ├── form-field.tsx
│   │   │   │   ├── modal.tsx
│   │   │   │   ├── sidebar.tsx
│   │   │   │   └── index.ts           # Barrel export
│   │   │   └── styles/
│   │   │       └── globals.css        # Tailwind base + design tokens
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── types/                         # SHARED — TypeScript types
│   │   ├── src/
│   │   │   ├── auth.ts                # User, Role, Token types
│   │   │   ├── finance.ts             # Account, JournalEntry, Invoice
│   │   │   ├── hr.ts                  # Employee, LeaveRequest, Payroll
│   │   │   ├── scm.ts                 # Vendor, PO, InventoryItem
│   │   │   ├── api.ts                 # PaginatedResponse, ErrorResponse
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── config/                        # SHARED — ESLint, Prettier, TS configs
│       ├── eslint-preset.js
│       ├── prettier.config.js
│       └── tsconfig.base.json
│
├── infra/                             # INFRASTRUCTURE
│   ├── docker/
│   │   ├── docker-compose.yml         # Local dev: Postgres, Redis, Keycloak, ES
│   │   ├── docker-compose.prod.yml    # Prod overrides: resource limits, health checks
│   │   ├── Dockerfile.web             # Multi-stage Next.js build
│   │   ├── Dockerfile.api             # Multi-stage NestJS build (Distroless)
│   │   └── Dockerfile.ml              # Python FastAPI build
│   │
│   ├── k8s/                           # Kubernetes manifests
│   │   ├── helm/
│   │   │   └── amdox-erp/
│   │   │       ├── Chart.yaml
│   │   │       ├── values.yaml
│   │   │       ├── values.staging.yaml
│   │   │       ├── values.prod.yaml
│   │   │       └── templates/
│   │   │           ├── deployment-api.yaml
│   │   │           ├── deployment-web.yaml
│   │   │           ├── deployment-ml.yaml
│   │   │           ├── service.yaml
│   │   │           ├── ingress.yaml
│   │   │           ├── hpa.yaml           # Horizontal Pod Autoscaler
│   │   │           ├── pdb.yaml           # Pod Disruption Budget
│   │   │           ├── configmap.yaml
│   │   │           └── sealed-secret.yaml
│   │   └── istio/
│   │       ├── virtual-service.yaml
│   │       └── destination-rule.yaml
│   │
│   └── terraform/                     # Infrastructure as Code
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── modules/
│       │   ├── rds/                   # Aurora PostgreSQL
│       │   ├── elasticache/           # Redis
│       │   ├── s3/                    # File storage
│       │   ├── eks/                   # Kubernetes cluster
│       │   └── ses/                   # Email
│       └── environments/
│           ├── staging/
│           │   └── terraform.tfvars
│           └── prod/
│               └── terraform.tfvars
│
├── docs/                              # DOCUMENTATION
│   ├── adr/                           # Architecture Decision Records
│   │   ├── 001-modular-monolith.md
│   │   ├── 002-tenant-isolation.md
│   │   ├── 003-domain-events.md
│   │   ├── 004-ml-microservice.md
│   │   └── 005-audit-hash-chain.md
│   ├── c4/                            # C4 diagrams (Mermaid files)
│   │   ├── context.md
│   │   ├── container.md
│   │   └── component.md
│   ├── erd/
│   │   └── database-erd.md
│   └── api/
│       └── openapi.yaml               # The spec we just created
│
├── scripts/                           # Dev utility scripts
│   ├── seed-db.ts                     # Seed development data
│   ├── generate-postman.ts            # Auto-generate Postman collection from OpenAPI
│   └── migrate.sh                     # Run Prisma migrations
│
├── .env.example                       # Template — never commit real .env
├── .dockerignore
├── .gitignore
├── .eslintrc.js                       # Root ESLint (extends packages/config)
├── .prettierrc                        # Root Prettier
├── .husky/                            # Git hooks
│   ├── pre-commit                     # lint-staged
│   └── commit-msg                     # commitlint (conventional commits)
├── commitlint.config.js
├── turbo.json                         # Turborepo pipeline config
├── pnpm-workspace.yaml                # Workspace definition
├── package.json                       # Root package.json
├── tsconfig.json                      # Root TS config
└── README.md
```

## Key Config Files

### pnpm-workspace.yaml
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": [".env"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["build"]
    },
    "test:e2e": {
      "dependsOn": ["build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:migrate": {
      "cache": false
    }
  }
}
```

### Root package.json scripts
```json
{
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "test:e2e": "turbo run test:e2e",
    "db:generate": "turbo run db:generate --filter=@amdox/db",
    "db:migrate": "turbo run db:migrate --filter=@amdox/db",
    "db:seed": "turbo run db:seed --filter=@amdox/db",
    "clean": "turbo run clean",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  }
}
```

## How packages reference each other

```
apps/web       → imports from @amdox/ui, @amdox/types
apps/api       → imports from @amdox/db, @amdox/types
packages/db    → exports Prisma client + tenant middleware
packages/ui    → exports React components (shadcn/ui based)
packages/types → exports shared TypeScript interfaces
packages/config→ exports ESLint, Prettier, tsconfig presets
```

Each package has its own `package.json` with a name like `@amdox/db`, `@amdox/ui`, etc.
pnpm workspaces auto-links them — no need to publish to npm.

## DDD Guardrail Check

| Rule | Status |
|---|---|
| Each domain module is self-contained (controller + service + repository + dto) | ✅ |
| No cross-module imports (finance doesn't import from hr) | ✅ |
| Shared code lives in packages/, not duplicated | ✅ |
| DB schema is single source of truth in packages/db | ✅ |
| Infra is separated from application code | ✅ |
| Tests co-located with the app they test | ✅ |
