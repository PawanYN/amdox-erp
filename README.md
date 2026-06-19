# Amdox AI-Powered Cloud ERP Suite

Welcome to the **Amdox ERP** monorepo workspace. This project uses `pnpm` workspaces and `Turborepo` to manage our applications and shared packages.

---

## Workspace Structure

The monorepo is organized as follows:
- **`apps/`**: Main products and services.
  - [`apps/web/`](file:///d:/amdox-erp/apps/web): Next.js 15 frontend application.
  - [`apps/api/`](file:///d:/amdox-erp/apps/api): NestJS 11 backend REST API application.
  - [`apps/ml-service/`](file:///d:/amdox-erp/apps/ml-service): Python FastAPI machine learning forecasting service.
- **`packages/`**: Shared libraries and modules.
  - [`packages/db/`](file:///d:/amdox-erp/packages/db): Shared Prisma database schema & client.
  - [`packages/ui/`](file:///d:/amdox-erp/packages/ui): Shared UI component library.
  - [`packages/types/`](file:///d:/amdox-erp/packages/types): Shared TypeScript types.
  - [`packages/config/`](file:///d:/amdox-erp/packages/config): Shared linting and TS configurations.
- **`docs/`**: Architectural documentation & system specs.

---

## Running the Frontend Only

If you are a frontend developer and want to run the frontend without booting up the backend or databases locally, use one of these two options:

### Option 1: Run from Root using Filters (Recommended)
This runs the web app while watching and compiling shared package dependencies automatically:
```bash
# Using pnpm workspace filtering
pnpm --filter web dev

# OR using Turborepo filtering
pnpm turbo run dev --filter=web
```

### Option 2: Navigate and Run inside the Web Folder
```bash
cd apps/web
pnpm dev
```

For more details on connecting to a remote staging API or setting up local mocks, see [docs/frontend_development.md](file:///d:/amdox-erp/docs/frontend_development.md).
