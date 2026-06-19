# C4 Context Diagram — Amdox AI-Powered Cloud ERP Suite

## How to use
1. Copy the code block below
2. Paste into **mermaid.live** (browser) or GitHub `.md` file or Notion `/mermaid` block
3. Diagram renders automatically — no manual drawing needed

```mermaid
C4Context
    title System Context Diagram — Amdox AI-Powered Cloud ERP Suite

    Person(exec, "C-Suite / Executive", "Views dashboards, KPIs, board-level reports")
    Person(finance, "Finance Team", "GL management, AP/AR, multi-currency reconciliation")
    Person(hr, "HR & Payroll Team", "Employee lifecycle, attendance, payroll processing")
    Person(scm, "Supply Chain Manager", "Procurement, inventory, vendor management")
    Person(pm, "Project Manager", "Resource allocation, milestone tracking, budgets")
    Person(it, "IT Administrator", "Tenant config, SSO, audit logs, security policies")

    System(erp, "Amdox ERP Suite", "Multi-tenant AI-powered cloud ERP: Finance, HR, SCM, PM, BI, Forecasting")

    System_Ext(idp, "Identity Provider", "Azure AD / Google Workspace via SAML 2.0 / OIDC")
    System_Ext(email, "Email / SMS Gateway", "AWS SES + Resend fallback, SMS provider")
    System_Ext(fx, "FX Rate Provider", "ECB / OpenExchangeRates — daily rate fetch")
    System_Ext(bank, "Banking / Payment Rails", "Payment processing, bank statement feeds")
    System_Ext(storage, "Cloud Storage (S3)", "Invoice attachments, exports, backups")

    Rel(exec, erp, "Views dashboards")
    Rel(finance, erp, "Manages ledger, invoices, payments")
    Rel(hr, erp, "Runs payroll, manages employees")
    Rel(scm, erp, "Manages inventory, POs, vendors")
    Rel(pm, erp, "Tracks projects, resources, budgets")
    Rel(it, erp, "Configures tenants, security, audit")

    Rel(erp, idp, "Authenticates via", "SAML/OIDC")
    Rel(erp, email, "Sends notifications via", "SMTP/API")
    Rel(erp, fx, "Fetches FX rates via", "REST API")
    Rel(erp, bank, "Processes payments via", "API")
    Rel(erp, storage, "Stores/retrieves files via", "S3 API")
```

## What this diagram shows

**Users (left side) — WHO uses the system:**
- 6 user types from the Amdox ERP doc (Section 1.2)

**System (center) — WHAT we are building:**
- The entire Amdox ERP as one single box (Context level = no internal detail)

**External Systems (right side) — WHAT it depends on:**
- Identity Provider (Keycloak/Azure AD/Google) for SSO
- Email/SMS gateway for notifications
- FX rate API for multi-currency support
- Banking rails for payment processing
- S3 for file storage

## Next levels (to be created)
- **C4 Container** — zoom INTO the ERP box → shows web app, API, ML service, databases
- **C4 Component** — zoom INTO one container (e.g. API) → shows modules like Finance, HR, SCM
