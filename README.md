# Amdox AI-Powered Cloud ERP Suite

Welcome to the **Amdox ERP** monorepo workspace. This project uses `pnpm` workspaces and `Turborepo` to manage our applications and shared packages.

---

## Workspace Structure

Here is the exact current folder and file structure of our monorepo:

```text
amdox-erp/
├── .github/
│   └── workflows/
├── apps/
│   ├── api/                           # NestJS Backend API (Initialized Structure)
│   │   ├── src/
│   │   │   ├── audit/
│   │   │   ├── auth/
│   │   │   ├── common/
│   │   │   ├── finance/
│   │   │   ├── health/
│   │   │   ├── hr/
│   │   │   ├── notification/
│   │   │   └── scm/
│   │   └── test/
│   ├── ml-service/
│   └── web/                           # Next.js Frontend
│       ├── public/
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── lib/
│       │   ├── stores/
│       │   └── styles/
├── docs/
│   ├── adr/
│   ├── api/
│   │   └── openapi.yaml
│   ├── c4/
│   │   ├── component.md
│   │   ├── component_clean.md
│   │   ├── container.md
│   │   └── context.md
│   ├── erd/
│   │   ├── Data_Processing_and_Model.png
│   │   └── database-erd.md
│   ├── frontend_development.md
│   └── monorepo_structure.md
├── packages/
│   ├── config/
│   │   └── .gitkeep
│   ├── db/                            # Shared Database Package
│   │   ├── prisma/
│   │   │   └── schema.prisma          # Prisma Schema with all 24 entities
│   │   ├── src/
│   │   │   └── client.ts              # Prisma Client Singleton
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── types/
│   │   └── .gitkeep
│   └── ui/
│       └── .gitkeep
├── scripts/
│   └── create-api-dirs.ps1
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── turbo.json
```

---

## Getting Started (Local Development Setup)

Follow these steps to configure your environment and boot up the development stack:

### Step 1: Start Databases & Services
Boot up the infrastructure dependencies (PostgreSQL, Redis, Keycloak) running locally in Docker containers:
```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Step 2: Configure Environment Variables
Initialize your local environment file by copying the template:
```bash
cp .env.example .env
```

### Step 3: Run Database Migrations (Create Tables)
Run the migration script against the PostgreSQL container to physically create the 24 ERP database tables:
```bash
npx pnpm db:migrate
```

---

## Running the Application

Once your databases are initialized, you can launch the application services using one of these workflows:

### Option A: Run the Entire Stack (Recommended)
This starts both the **Next.js Web Frontend** and **NestJS API Backend** concurrently:
```bash
npx pnpm dev
```

### Option B: Run the Frontend Only
If you are only working on user interface components and do not need a local backend database:
```bash
# From the project root (recommended)
npx pnpm --filter web dev

# OR navigate to the folder directly
cd apps/web
npx pnpm dev
```
*Note: Refer to [docs/frontend_development.md](file:///d:/amdox-erp/docs/frontend_development.md) for pointing your local frontend to remote staging APIs.*

### Option C: Run the Backend Only
If you are only working on API endpoints:
```bash
npx pnpm --filter api dev
```

---

## Database Management & Tools

### Visual Database Browser (Prisma Studio)
To visually inspect, search, and edit database records (opens a browser app at `http://localhost:5555`):
```bash
npx pnpm --filter @amdox/db exec prisma studio
```

### Shared Database Workspace Scripts
All database actions are centralized under the `@amdox/db` package. You can run these commands from the root:
* **`npx pnpm db:generate`** — Re-generates the database client types after schema changes.
* **`npx pnpm db:migrate`** — Applies schema changes and updates the database tables.
* **`npx pnpm db:seed`** — Seeds the database with development mock data.


