# Codebase Inconsistencies & Refactoring Debt

This document tracks naming inconsistencies, design discrepancies, or temporary workarounds that need to be resolved permanently before the final production release.

---

## 1. Role Name Spacing Discrepancy

### Description
There is a mismatch in how standard roles (specifically `Tenant Admin` / `TenantAdmin`) are named across the codebase:
- **Database / Tenant Service:** [tenant.service.ts](file:///w:/amdox-erp/apps/api/src/tenant/tenant.service.ts) and seeding insert the role as `'Tenant Admin'` (with a space).
- **Controllers:** Controllers (like [vendor.controller.ts](file:///w:/amdox-erp/apps/api/src/scm/vendor/vendor.controller.ts) and [ar.controller.ts](file:///w:/amdox-erp/apps/api/src/finance/ar/ar.controller.ts)) enforce guards using `@Roles('TenantAdmin')` (without a space).

### Current Temporary Workaround
In [roles.guard.ts](file:///w:/amdox-erp/apps/api/src/auth/guards/roles.guard.ts), we normalize user roles by stripping all spaces before comparing them against required roles:
```typescript
const userRoleNames = user.userRoles.map((ur: any) => ur.role.name.replace(/\s+/g, ''));
```

### Proposed Permanent Fix
Standardize role names to a single naming convention (e.g., camelCase or PascalCase without spaces, like `'TenantAdmin'`) across:
1. `tenant.service.ts` default role provisioning.
2. `seed.ts` setup script.
3. Controller decorators.
4. Remove the whitespace-stripping workaround from `roles.guard.ts`.

---

## 2. Tenant ID (UUID) vs. Keycloak Realm (Slug) Confusion

### Description
Tenant endpoints (e.g., `GET /tenant/config`) were failing because the controller extracted the database UUID (`tenantId`) and passed it to the service, but the service query expected the unique string `slug` (e.g. `'company-a'`) to find the tenant. Similarly, Keycloak realm queries were trying to load realms using the UUID as the realm name instead of the slug.

### Current Temporary Workaround
We added a `getTenant` helper method in [tenant.service.ts](file:///w:/amdox-erp/apps/api/src/tenant/tenant.service.ts) that accepts either `id` or `slug` dynamically:
```typescript
  async getTenant(idOrSlug: string) {
    return prisma.tenant.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] }
    });
  }
```
All tenant config and Keycloak methods were updated to resolve this tenant object first and use `tenant.id` for database lookups and `tenant.slug` for Keycloak realm operations.

### Proposed Permanent Fix
Consistently pass either `id` or `slug` down from the controllers depending on the operation type, rather than mixing them up, and remove the dual-lookup fallback from `TenantService`.

---

## 3. Employee DTO vs. Database Schema Mismatch

### Description
The `CreateEmployeeDto` expects fields that do not exist in the database `Employee` model:
- **DTO Fields:** `phone`, `dateOfBirth`, `employmentType`, `bankDetails`
- **Database Model Fields:** Missing.

Currently, `EmployeeService.create` silently discards these fields during creation, meaning they are not stored.

### Proposed Permanent Fix
Either:
1. Add columns for `phone`, `dateOfBirth`, `employmentType`, and `bankDetails` to the `Employee` model in [schema.prisma](file:///w:/amdox-erp/packages/db/prisma/schema.prisma) and run a migration.
2. Or clean up the `CreateEmployeeDto` to only include database-supported fields.


### Leave Types (Frontend vs Backend)
- **Frontend** lists the following leave types: `Sick Leave`, `Earned Leave`, `Casual Leave`, `Unpaid Leave`.
- **Backend** (`CreateLeaveDto`) expects the following enum values: `annual`, `sick`, `maternity`, `unpaid`.
- **Temporary Resolution**: During the initial API integration (Task: Leave Creation), the frontend maps the values as follows to satisfy the backend without crashing:
  - `Earned Leave` -> `annual`
  - `Casual Leave` -> `annual`
  - `Sick Leave` -> `sick`
  - `Unpaid Leave` -> `unpaid`
- **Action Required**: The product/design team needs to unify these leave types across the stack so they map 1:1.
