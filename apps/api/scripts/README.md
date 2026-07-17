# In-package API scripts

Run via `pnpm --filter api run <script>` from the repo root (or `npm run <script>` from inside `apps/api/`) — distinct from the repo-wide [`scripts/`](../../../scripts/) at the root, which holds manual, cross-package ops tooling.

| Script                           | package.json name             | Notes                                                                                 |
| -------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------- |
| `audit-tenant-scoping.ts`        | `audit:tenant-scoping`        | CI security gate — runs on every PR (`.github/workflows/ci.yml`)                      |
| `verify-p2p-flow.ts`             | `verify:p2p`                  | Manual verification                                                                   |
| `verify-payroll-retry.ts`        | `verify:payroll-retry`        | Manual verification                                                                   |
| `backfill-ap-gl.ts`              | `backfill:ap-gl`              | One-off, idempotent — posts missing GL entries for approved AP invoices               |
| `backfill-ar-revenue-gl.ts`      | `backfill:ar-revenue-gl`      | One-off, idempotent — posts missing revenue GL entries for AR invoices                |
| `backfill-employee-contracts.ts` | `backfill:employee-contracts` | One-off, idempotent — creates missing EmploymentContract rows                         |
| `backfill-payment-gl.ts`         | `backfill:payment-gl`         | One-off, idempotent — posts missing GL entries for payments                           |
| `seed-june-attendance.ts`        | `seed:june-attendance`        | Demo-data seeder for `company-a` — idempotent (deletes then re-inserts its own month) |
