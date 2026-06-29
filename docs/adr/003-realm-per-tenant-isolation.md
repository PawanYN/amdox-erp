# ADR 003: Realm-Per-Tenant Identity Isolation Architecture

## Status
Accepted

## Context
Amdox ERP is a multi-tenant enterprise application (PDF Spec: AMX-ERP-2026-04). We need to determine the optimal strategy for identity and access management (IAM) across our diverse enterprise customer base using Keycloak.

Enterprise customers often require strict isolation, bespoke security policies (e.g., custom MFA requirements, specific SSO integration with Azure AD/Google Workspace), and completely isolated user pools.

## Decision
We have decided to adopt a **two-layered multi-tenant isolation strategy**:

1. **Identity Isolation (Keycloak): Realm-Per-Tenant Strategy**
   - Each tenant (customer) will be provisioned with their own dedicated Keycloak Realm (e.g., `/realms/company-a`).
   - The Next.js frontend will dynamically route login requests to the appropriate realm based on the tenant's slug.
   
2. **Data Isolation (Database): Row-Level tenantId Filter**
   - At the database level, all tenant-scoped tables include a `tenantId` column.
   - The backend utilizes a global Prisma Client Extension powered by `AsyncLocalStorage` to automatically inject a `where: { tenantId }` clause into every query, guaranteeing absolute data boundaries.

## Rationale
- **Strict Isolation:** A Realm-per-tenant ensures that a compromise or misconfiguration in one tenant's identity pool cannot bleed into another. Users exist completely independently in their respective realms.
- **Customization:** It trivially supports the requirement that different tenants might need different authentication flows (e.g., SAML for one, OIDC for another, strict 5-minute timeouts for a finance company vs 30 days for another).
- **Compliance:** Aligns tightly with the "Zero Trust / Enterprise Security" requirements mandated by the project specification (Page 5, Day 4).

## Consequences
- **Operational Overhead:** Provisioning a new tenant requires orchestrating both Keycloak (Realm, Client, Admin User) and the Postgres database (Tenant, User, Role). We have mitigated this by building an automated orchestration layer in the `TenantService`.
- **Login UX:** We cannot use a single universal login page. The frontend must know which realm the user belongs to before initiating the OAuth flow, necessitating a "Tenant Slug / Company Name" step in the login UX.

## Mitigations
- We have fully automated the realm provisioning process in `POST /tenant`. As the system scales, we will monitor Keycloak's performance, as massive amounts of realms (1000+) can increase memory footprint. We will scale Keycloak horizontally as needed.
