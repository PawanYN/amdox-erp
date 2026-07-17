# Wiring Audit Matrix

> **Living checklist** — page ↔ API client ↔ backend route  
> **Created:** 2026-07-10 (Phase 1)  
> **Last verified:** 2026-07-10 (Phase 4 backend-only features wired)  
> **Source plan:** [`frontend-backend-wiring-and-testing-plan.md`](../planning/frontend-backend-wiring-and-testing-plan.md)

**Status legend:** ✅ WIRED | ⚠️ PARTIAL | ❌ STUB/MISSING

---

## Summary

| Module         | ✅     | ⚠️    | ❌    |
| -------------- | ------ | ----- | ----- |
| Finance        | 8      | 0     | 0     |
| HR             | 7      | 1     | 0     |
| SCM            | 5      | 1     | 0     |
| Projects       | 6      | 1     | 0     |
| BI             | 1      | 0     | 0     |
| Forecast       | 2      | 0     | 0     |
| Settings       | 5      | 1     | 0     |
| Notifications  | 2      | 0     | 0     |
| Vendor Portal  | 1      | 0     | 0     |
| Search         | 1      | 0     | 0     |
| Home / GraphQL | 1      | 0     | 0     |
| **Total**      | **39** | **4** | **0** |

---

## Phase 4 additions (2026-07-10)

| Module        | Page / Feature       | Route                   | API client                                                | Status |
| ------------- | -------------------- | ----------------------- | --------------------------------------------------------- | ------ |
| Finance       | Sales Orders         | `/finance/sales-orders` | `financeApi.list/create/createInvoiceFromOrder`           | ✅     |
| Finance       | Intercompany         | `/finance/intercompany` | `listIntercompanyTransfers`, `createIntercompanyTransfer` | ✅     |
| Finance       | AP Payments          | `/finance/invoices`     | `createApInvoice`, `recordApPayment`, `runApPaymentBatch` | ✅     |
| SCM           | Reorder automation   | `/scm/inventory`        | `scmApi.runReorderAutomation`                             | ✅     |
| Projects      | Milestone edit       | `/projects/milestones`  | `pmApi.updateMilestone`                                   | ✅     |
| BI            | Widget data fallback | `/bi`                   | `biApi.getDataBySource`                                   | ✅     |
| Vendor Portal | Profile              | `/vendor-portal`        | `vendorPortalApi.getProfile`                              | ✅     |
| Home          | Platform stats       | `/home`                 | `graphqlApi.getPlatformStats`                             | ✅     |

---

## Remaining partial items (non-blocking)

| Module   | Gap                                           |
| -------- | --------------------------------------------- |
| Settings | General tab — no `PUT /tenant/config` save    |
| HR       | Employees filter hides `EMP-100`              |
| SCM      | Purchase Orders "New PO" button dead          |
| Projects | No create-task UI on tasks page (wizard only) |

---

## Dead API client methods — all resolved

All previously unused client methods from Phases 3–4 are now wired. `biApi.listReports` is an intentional duplicate of `getReports`.

---

## How to re-verify Phase 4

```bash
# Finance new tabs
open http://localhost:3000/finance/sales-orders
open http://localhost:3000/finance/intercompany

# GraphQL stats (after login as admin/manager)
open http://localhost:3000/home

# Inventory reorder automation
open http://localhost:3000/scm/inventory
```

Update this file when gaps are fixed.
