# Amdox AI-Powered Cloud ERP Suite

Welcome to the **Amdox ERP** monorepo workspace. This project uses `pnpm` workspaces and `Turborepo` to manage our applications and shared packages.

---

## 🌐 Live Demo

|                         |                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------- |
| **App**                 | https://erp.92-4-86-3.sslip.io                                                          |
| **API docs (Swagger)**  | https://erp.92-4-86-3.sslip.io/api-docs                                                 |
| **Identity (Keycloak)** | https://kc.92-4-86-3.sslip.io                                                           |
| **Tenant slug**         | `company-a`                                                                             |
| **Admin login**         | `admin@companya.in` / `Admin123!` (full role list: `docs/company-a-employee-logins.md`) |

Deployed on Oracle Cloud with Caddy (automatic HTTPS via Let's Encrypt), pm2-managed production builds, and the Docker infrastructure stack (PostgreSQL, Redis, Keycloak, MinIO, Elasticsearch).

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

Follow these exact steps to configure your environment, set up the database, and configure Keycloak for local testing.

### Step 1: Start Databases & Services

Boot up PostgreSQL, Redis, and Keycloak running locally in Docker containers:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

### Step 2: Configure Environment Variables

Initialize your local environment files by copying the provided templates:

```bash
# 1. Setup the main project variables
cp .env.example .env

# 2. Setup the Prisma database variables (CRITICAL)
# This uses the `erp` schema to keep it safely separated from Keycloak!
cd packages/db
cp .env.example .env
cd ../..
```

### Step 3: Setup Keycloak (SSO)

Run the automated script to configure Keycloak. This will create the `amdox-erp` realm, the client app, and a dummy user (`erp-admin` / password: `password123`):

```powershell
# Run this from the root directory
.\scripts\setup-keycloak.ps1
```

### Step 4: Build Database & Insert Dummy Data

Now we need to tell Prisma to build the tables and insert our dummy Tenant and `erp-admin` User so you can actually log in.

```bash
cd packages/db
npx prisma db push
npm run db:seed
cd ../..
```

_(Note: Do not skip Step 2's `.env` file before running this, or Prisma might accidentally delete Keycloak's tables!)_

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

_Note: Refer to [docs/frontend_development.md](file:///d:/amdox-erp/docs/frontend_development.md) for pointing your local frontend to remote staging APIs._

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

- **`npx pnpm db:generate`** — Re-generates the database client types after schema changes.
- **`npx pnpm db:migrate`** — Applies schema changes and updates the database tables.
- **`npx pnpm db:seed`** — Seeds the database with development mock data.

---

## API Documentation & Testing

### Interactive Swagger UI

When the NestJS API is running locally, it automatically generates a live, interactive Swagger documentation page.
You can view all available endpoints, required payloads, and test them directly from your browser:

- **URL:** [http://localhost:3001/api-docs](http://localhost:3001/api-docs)

### Auto-generated Postman Collection

The API automatically generates an OpenAPI specification file (`openapi-spec.json`) when it starts up. You can instantly convert this into a ready-to-use Postman collection for your team:

```bash
npx pnpm --filter api run postman
```

This generates a `postman_collection.json` file inside the `apps/api` folder which you can import directly into Postman to test all routes.
