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
│   ├── api/
│   │   └── .gitkeep
│   ├── ml-service/
│   └── web/
│       ├── public/
│       ├── src/
│       │   ├── app/
│       │   │   ├── (auth)/
│       │   │   │   └── .gitkeep
│       │   │   ├── (dashboard)/
│       │   │   │   ├── finance/
│       │   │   │   │   └── .gitkeep
│       │   │   │   ├── hr/
│       │   │   │   │   └── .gitkeep
│       │   │   │   ├── scm/
│       │   │   │   │   └── .gitkeep
│       │   │   │   └── settings/
│       │   │   │       └── .gitkeep
│       │   │   ├── favicon.ico
│       │   │   ├── layout.tsx
│       │   │   └── page.tsx
│       │   ├── components/
│       │   │   └── .gitkeep
│       │   ├── hooks/
│       │   │   └── .gitkeep
│       │   ├── lib/
│       │   │   └── .gitkeep
│       │   ├── stores/
│       │   │   └── .gitkeep
│       │   └── styles/
│       │       └── globals.css
│       ├── next-env.d.ts
│       ├── next.config.ts
│       ├── package-lock.json
│       ├── package.json
│       ├── postcss.config.mjs
│       ├── README.md
│       └── tsconfig.json
├── docs/
│   ├── adr/
│   │   └── .gitkeep
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
│   ├── db/
│   │   └── .gitkeep
│   ├── types/
│   │   └── .gitkeep
│   └── ui/
│       └── .gitkeep
├── scripts/
│   └── .gitkeep
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
pnpm db:migrate
```

---

## Running the Application

Once your databases are initialized, you can launch the application services using one of these workflows:

### Option A: Run the Entire Stack (Recommended)
This starts both the **Next.js Web Frontend** and **NestJS API Backend** concurrently:
```bash
pnpm dev
```

### Option B: Run the Frontend Only
If you are only working on user interface components and do not need a local backend database:
```bash
# From the project root (recommended)
pnpm --filter web dev

# OR navigate to the folder directly
cd apps/web
pnpm dev
```
*Note: Refer to [docs/frontend_development.md](file:///d:/amdox-erp/docs/frontend_development.md) for pointing your local frontend to remote staging APIs.*

### Option C: Run the Backend Only
If you are only working on API endpoints:
```bash
pnpm --filter api dev
```

---

## Database Management & Tools

### Visual Database Browser (Prisma Studio)
To visually inspect, search, and edit database records (opens a browser app at `http://localhost:5555`):
```bash
pnpm --filter @amdox/db exec prisma studio
```

### Shared Database Workspace Scripts
All database actions are centralized under the `@amdox/db` package. You can run these commands from the root:
* **`pnpm db:generate`** — Re-generates the database client types after schema changes.
* **`pnpm db:migrate`** — Applies schema changes and updates the database tables.
* **`pnpm db:seed`** — Seeds the database with development mock data.


