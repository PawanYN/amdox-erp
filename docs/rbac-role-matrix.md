# Amdox ERP — RBAC Role Matrix & Enforcement Audit

> **Task:** BE-11 · **Audited by:** pawan · **Date:** 3 July 2026  
> **Scope:** All NestJS controllers in `apps/api/src/` + frontend persona simulation in `dashboardLayout.tsx`  
> **Sources:** Live codebase, `packages/db/prisma/seed.ts`, Amdox Web.pdf §security requirements

---

## 1. Executive Summary

| Metric | Value |
| ------ | ----- |
| Controllers audited | 26 |
| Controllers with `@Roles()` + `RolesGuard` | 21 |
| Controllers with auth only (no role check) | 3 (`auth`, `notification`, `health`) |
| Public endpoints (no auth) | 3 (`GET /health`, `GET /tenant/exists/:slug`, `POST /tenant`) |
| `@Roles()` declarations | 78 across 16 controllers |
| Roles in seed data | 5 (`SuperAdmin`, `TenantAdmin`, `Manager`, `Viewer`, `Employee`) |
| `Permission` / `RolePermission` tables | Present in schema; **not used** by `RolesGuard` |

**Verdict:** RBAC is **enforced on all business modules**. Finance, HR, SCM, Tenant, **BI, PM, Forecast, Audit, and GDPR** routes use `@Roles()`. Only auth logout, notifications, and health remain auth-only/public.

---

## 2. Role Definitions

Roles are provisioned per tenant in `packages/db/prisma/seed.ts` and assigned to users via `UserRole` (loaded by `KeycloakStrategy`).

| Role | `SystemRole` enum | Typical persona | Privilege level |
| ---- | ----------------- | --------------- | --------------- |
| **SuperAdmin** | `SUPER_ADMIN` | Platform operator | Cross-tenant; full SCM/HR/Finance read+write |
| **TenantAdmin** | `TENANT_ADMIN` | IT / org admin | Tenant config, fiscal close, deletes, payroll |
| **Manager** | `MANAGER` | Dept head / finance lead | Create/update in own module; approve workflows |
| **Viewer** | `VIEWER` | Read-only analyst | GET endpoints only where explicitly allowed |
| **Employee** | `EMPLOYEE` | Self-service user | Own profile, leave, attendance, payroll view |

### How enforcement works

1. `AuthGuard('keycloak')` validates JWT and loads `User` + `userRoles` from DB.
2. `RolesGuard` reads `@Roles(...)` metadata on each handler.
3. If **no** `@Roles()` is set → **any authenticated user passes**.
4. User needs **at least one** of the listed roles (OR logic).
5. `RolesGuard` strips spaces from role names, so `'Tenant Admin'` matches `'TenantAdmin'`.

---

## 3. Endpoint Role Matrix

Legend: **W** = write (POST/PATCH/DELETE) · **R** = read (GET) · **—** = not allowed · **\*** = any authenticated user (no `@Roles`)

### 3.1 Finance

| Endpoint | SuperAdmin | TenantAdmin | Manager | Viewer | Employee |
| -------- | :--------: | :---------: | :-----: | :----: | :------: |
| **GL** `/finance/gl/accounts` GET | R | R | R | R | — |
| **GL** `/finance/gl/accounts` POST | — | W | W | — | — |
| **GL** `/finance/gl/journal-entries` GET | R | R | R | R | — |
| **GL** `/finance/gl/journal-entries` POST | — | W | W | — | — |
| **GL** `/finance/gl/fiscal-periods` GET | R | R | R | R | — |
| **GL** `/finance/gl/fiscal-periods/open` POST | — | W | — | — | — |
| **GL** `/finance/gl/fiscal-periods/:id/close` POST | — | W | — | — | — |
| **GL** `/finance/gl/intercompany-transfers` GET | R | R | R | R | — |
| **GL** `/finance/gl/intercompany-transfers` POST | — | W | — | — | — |
| **AP** `/finance/ap/invoices` GET | — | R | R | R | — |
| **AP** `/finance/ap/invoices` POST | — | W | W | — | — |
| **AP** `/finance/ap/invoices/upload` POST | — | W | W | — | — |
| **AP** `/finance/ap/invoices/:id/approve` POST | — | W | W | — | — |
| **AR** `/finance/ar/invoices` GET/POST | R/W | R/W | R/W | — | — |
| **AR** `/finance/ar/customers` GET/POST | R/W | R/W | R/W | — | — |
| **AR** `/finance/ar/payments` POST | W | W | W | — | — |
| **AR** `/finance/ar/aging-report` GET | R | R | R | — | — |
| **Sales** `/finance/sales-orders` GET | R | R | R | R | — |
| **Sales** `/finance/sales-orders` POST | — | W | W | — | — |
| **Sales** `/finance/sales-orders/:id/invoice` POST | — | W | W | — | — |

### 3.2 HR

| Endpoint | SuperAdmin | TenantAdmin | Manager | Viewer | Employee |
| -------- | :--------: | :---------: | :-----: | :----: | :------: |
| **Employees** GET (list/detail) | R | R | R | R | — |
| **Employees** GET `/me` | R | R | R | R | R |
| **Employees** POST/PATCH | W | W | W | — | — |
| **Employees** DELETE | W | W | — | — | — |
| **Departments** GET | R | R | R | R | — |
| **Departments** POST/PATCH | W | W | W | — | — |
| **Departments** DELETE | W | W | — | — | — |
| **Leave** GET (own/all) | R | R | R | R | R |
| **Leave** POST (request) | W | W | W | W | W |
| **Leave** PATCH (approve/reject) | W | W | W | — | — |
| **Attendance** GET/POST (clock) | R/W | R/W | R/W | R/W | R/W |
| **Attendance** admin reports GET | R | R | R | — | — |
| **Payroll** GET (period data) | R | R | R | — | R |
| **Payroll** POST `/run` | W | W | W | — | — |
| **Payroll** GET payslip PDF | W | W | W | — | — |

### 3.3 SCM

| Endpoint | SuperAdmin | TenantAdmin | Manager | Viewer | Employee |
| -------- | :--------: | :---------: | :-----: | :----: | :------: |
| **Vendors** GET | R | R | R | R | — |
| **Vendors** POST/PATCH | W | W | W | — | — |
| **Vendors** DELETE | W | W | — | — | — |
| **Products** GET | R | R | R | R | — |
| **Products** POST/PATCH | W | W | W | — | — |
| **Products** DELETE | W | W | — | — | — |
| **Inventory** warehouses/stock GET | R | R | R | R | — |
| **Inventory** warehouses/movements POST | W | W | W | — | — |
| **Purchase Orders** GET | R | R | R | R | — |
| **Purchase Orders** POST/PATCH/receive | W | W | W | — | — |
| **Requisitions** GET | R | R | R | R | — |
| **Reorder automation** POST | W | W | — | — | — |

### 3.4 Tenant & Auth

| Endpoint | SuperAdmin | TenantAdmin | Manager | Viewer | Employee |
| -------- | :--------: | :---------: | :-----: | :----: | :------: |
| **Tenant** config/Keycloak/IdP GET/PUT | R/W | R/W | — | — | — |
| **Tenant** `POST /tenant` (create) | Public | Public | Public | Public | Public |
| **Tenant** `GET /tenant/exists/:slug` | Public | Public | Public | Public | Public |
| **Auth** `POST /auth/logout` | \* | \* | \* | \* | \* |

### 3.5 BI, PM, Forecast, Audit & GDPR

| Module | Endpoint pattern | SuperAdmin | TenantAdmin | Manager | Viewer | Employee |
| ------ | ---------------- | :--------: | :---------: | :-----: | :----: | :------: |
| **BI** | GET (dashboards, data, KPIs, reports, SSE) | R | R | R | R | — |
| **BI** | POST/PATCH/DELETE (dashboards, widgets, reports) | W | W | W | — | — |
| **PM** | GET (projects, tasks, milestones, budgets, heatmap) | R | R | R | R | — |
| **PM** | POST/PATCH (create/update projects, tasks, budgets, allocate) | W | W | W | — | — |
| **Forecast** | GET predictions | R | R | R | R | — |
| **Forecast** | POST train | W | W | W | — | — |
| **Audit** | GET logs / verify chain | R | R | — | — | — |
| **GDPR** | All endpoints | R/W | R/W | — | — | — |
| **Notifications** | GET / PATCH read | \* | \* | \* | \* | \* |

### 3.6 Vendor Portal (external — BE-08)

| Endpoint | Auth | Who |
| -------- | ---- | --- |
| `POST /vendor-portal/auth/login` | Public (tenant slug + email + access key) | Supplier |
| `GET /vendor-portal/purchase-orders` | `X-Tenant-Id` + `X-Vendor-Key` headers | Supplier |
| `POST /vendor-portal/purchase-orders/:id/acknowledge` | Vendor portal headers | Supplier |
| `POST /scm/vendors/:id/portal-key` | Keycloak JWT (TenantAdmin) | Internal admin issues key |

---

## 4. Frontend RBAC (simulated)

The dashboard uses a **demo persona switcher** in `apps/web/src/components/layout/dashboardLayout.tsx` — not Keycloak roles.

| Persona key | Label | Allowed route prefixes |
| ----------- | ----- | ---------------------- |
| `executive` | Executive | `/home`, `/bi`, `finance`, `hr`, `scm`, `projects` |
| `finance` | Finance Team | `/`, `finance` |
| `hr` | HR & Payroll | `/`, `hr` |
| `scm` | Supply Chain | `/`, `scm` |
| `pm` | Project Manager | `/`, `projects` |

**Gap:** Frontend hides nav sections by persona, but API calls are not blocked client-side. A user with only `Employee` role could still call Finance endpoints if they know the URL — backend `@Roles()` is the real gate where applied.

---

## 5. Audit Findings

### 5.1 Passed

- `RolesGuard` is applied at controller level on all Finance, HR, SCM modules.
- Destructive operations (delete vendor/product/employee) restricted to `SuperAdmin` + `TenantAdmin`.
- Fiscal period close and intercompany transfers restricted to `TenantAdmin`.
- Payroll run restricted to `Manager` + `TenantAdmin`.
- Employee self-service (`GET /employees/me`, leave request) includes `Employee` role.

### 5.2 Gaps (recommended follow-up — out of BE-11 scope)

| # | Finding | Severity | Recommendation |
| - | ------- | -------- | -------------- |
| G1 | ~~PM, BI, Forecast, Audit, GDPR have no `@Roles()`~~ | — | **Fixed** — `@Roles()` added July 2026 |
| G2 | `Permission` / `RolePermission` tables unused | Low | Future ABAC; document as deferred |
| G3 | Inconsistent role string `'Tenant Admin'` vs `'TenantAdmin'` | Low | Standardize to `TenantAdmin` (guard normalizes today) |
| G4 | `POST /tenant` is public (no auth) | Medium | Acceptable for onboarding; add rate limiting (PLAT-04) |
| G5 | Frontend persona ≠ Keycloak roles | Medium | Wire nav to `req.user.roles` from token |
| G6 | `Viewer` cannot access AR GET in some endpoints | Info | By design — AR list requires Manager+ |

### 5.3 Controllers reference

| Controller | File | Guard |
| ---------- | ---- | ----- |
| GL | `finance/gl/gl.controller.ts` | Auth + Roles |
| AP | `finance/ap/ap.controller.ts` | Auth + Roles |
| AR | `finance/ar/ar.controller.ts` | Auth + Roles |
| Sales Order | `finance/sales/sales-order.controller.ts` | Auth + Roles |
| Employee | `hr/employee/employee.controller.ts` | Auth + Roles |
| Department | `hr/department/department.controller.ts` | Auth + Roles |
| Leave | `hr/leave/leave.controller.ts` | Auth + Roles |
| Attendance | `hr/attendance/attendance.controller.ts` | Auth + Roles |
| Payroll | `hr/payroll/payroll.controller.ts` | Auth + Roles |
| Vendor | `scm/vendor/vendor.controller.ts` | Auth + Roles |
| Product | `scm/product/product.controller.ts` | Auth + Roles |
| Inventory | `scm/inventory/inventory.controller.ts` | Auth + Roles |
| Purchase | `scm/purchase/purchase.controller.ts` | Auth + Roles |
| Requisition | `scm/requisition/requisition.controller.ts` | Auth + Roles |
| Reorder | `scm/automation/reorder.controller.ts` | Auth + Roles |
| Tenant (protected) | `tenant/tenant.controller.ts` | Auth + Roles |
| BI | `bi/bi.controller.ts` | Auth + Roles |
| PM Projects | `pm/project/project.controller.ts` | Auth + Roles |
| PM Budget | `pm/budget/budget.controller.ts` | Auth + Roles |
| PM Resources | `pm/resource/resource.controller.ts` | Auth + Roles |
| Forecast | `forecast/forecast.controller.ts` | Auth + Roles |
| Audit | `audit/audit.controller.ts` | Auth + Roles |
| GDPR | `audit/gdpr/gdpr.controller.ts` | Auth + Roles |
| Notifications | `notification/notification.controller.ts` | Auth only |
| Auth | `auth/auth.controller.ts` | Auth only |
| Health | `health/health.controller.ts` | Public |

---

## 6. Role Assignment (who configures what)

| Action | Who | How |
| ------ | --- | --- |
| Assign roles to users | **TenantAdmin** | Keycloak admin console or employee form (`needsAccess` + role dropdown) |
| Change tenant SSO/IdP | **TenantAdmin** | Settings page → `tenantApi` → `/tenant/keycloak-config` |
| Create new tenant | **Anyone** (public) | `/create-tenant` page → `POST /tenant` |
| Change API role rules | **Developer** | Edit `@Roles()` decorators in controllers (not admin UI) |

There is **no IT admin UI** to configure which roles can access which endpoints. Role-to-endpoint mapping is code-defined via `@Roles()` and documented in this matrix.

---

## 7. Acceptance Criteria (BE-11)

| Criterion | Status |
| --------- | ------ |
| Audit all API controllers for `@Roles()` coverage | ✅ Done |
| Document formal role matrix | ✅ This document |
| List gaps and recommendations | ✅ §5.2 |
| Cross-reference seed roles and `SystemRole` enum | ✅ §2 |

---

*Maintained by pawan. Update when new controllers are added or `@Roles()` decorators change.*
