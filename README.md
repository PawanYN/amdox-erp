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
