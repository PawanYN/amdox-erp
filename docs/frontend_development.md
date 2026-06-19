# Running the Frontend Only

This document explains how developers can run only the frontend application (`apps/web`) without needing to boot up the backend API or other microservices locally.

---

## Option 1: Run from the Root using Filters (Recommended)

From the root directory of the project, you can run the dev server specifically for the web package. This ensures that any changes in shared local packages (like `@amdox/ui` or `@amdox/types`) are automatically picked up.

Run one of the following commands from the project root:

```bash
# Using pnpm workspace filtering
pnpm --filter web dev

# OR using Turborepo filtering
pnpm turbo run dev --filter=web
```

---

## Option 2: Navigate and Run inside the Web Folder

Alternatively, you can change your directory directly into the web application and run the Next.js development server locally.

```bash
# 1. Navigate to the web app directory
cd apps/web

# 2. Run the dev server
pnpm dev
```

---

## Connecting to a Remote API (Optional)

To build and test frontend components without running the backend databases, Keycloak, or NestJS locally, you can point your local environment variables to a staging or mock API.

Create or update the environment file:

```env
# Path: apps/web/.env.local
NEXT_PUBLIC_API_URL=https://api.staging.amdox.com
```
