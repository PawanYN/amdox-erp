# Report Images — What to Capture and What to Name It

Drop screenshots into this folder (`report/images/`) with the **exact filenames** below (PNG preferred, full-window captures at your normal desktop resolution — I'll handle sizing in LaTeX).

Diagrams marked **[I draw]** are ones I will generate myself in LaTeX/TikZ — you don't need to provide them.

## Already have (I will copy from existing folders — nothing to do)

| File                         | Source                                                                                                     |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `login.png`                  | `docs/screenshots/Login.png`                                                                               |
| `home-dashboard.png`         | `docs/screenshots/Dashboard.png`                                                                           |
| `attendance.png`             | `docs/screenshots/Attendance.png`                                                                          |
| `grafana-golden-signals.png` | `docs/screenshots/GrafanaDashboard.png`                                                                    |
| `erd.png`                    | `docs/erd/database-erd.png` — regenerated from the live schema (`node scripts/reporting/generate-erd.mjs`) |

## Needed from you (12 screenshots, priority order)

| #   | Filename                 | What to capture                                                                                                                                                    |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `bi-workspace.png`       | `/bi` — a dashboard with several widgets visible (KPI cards + a couple of charts), ideally in edit mode showing the grid                                           |
| 2   | `journal-entry-form.png` | Finance → Journal Entries → New entry, mid-fill, showing the live Debit/Credit totals and the disabled Save button while unbalanced (the report's best UX exhibit) |
| 3   | `ap-invoices.png`        | Finance → AP Invoices list, showing status chips (MATCHED/APPROVED/PAID) and the PO column                                                                         |
| 4   | `purchase-orders.png`    | SCM → Purchase Orders, with at least one requisition row showing the requesting project's name                                                                     |
| 5   | `payroll-run.png`        | HR → Payroll after a completed run (run status + totals visible)                                                                                                   |
| 6   | `payslip-pdf.png`        | One generated payslip PDF opened                                                                                                                                   |
| 7   | `forecast.png`           | AI Forecast page with a prediction chart (history + forecast line)                                                                                                 |
| 8   | `projects-gantt.png`     | A project's Tasks/Gantt timeline view                                                                                                                              |
| 9   | `vendor-portal.png`      | Vendor portal — a PO acknowledgement screen                                                                                                                        |
| 10  | `audit-log.png`          | Settings → Audit tab, log viewer with the "verify hash chain" button visible                                                                                       |
| 11  | `swagger.png`            | `https://erp.92-4-86-3.sslip.io/api-docs` — the Swagger UI with module groups expanded in the sidebar                                                              |
| 12  | `ci-pipeline.png`        | GitHub Actions — one green run of `ci.yml` showing all jobs (lint, typecheck, tests, tenant-scoping audit, TruffleHog, Grype, Trivy)                               |

## Nice-to-have (only if quick)

| #   | Filename            | What to capture                                                            |
| --- | ------------------- | -------------------------------------------------------------------------- |
| 13  | `argocd.png`        | ArgoCD UI — the `amdox-prod` app tree, green/synced                        |
| 14  | `grafana-trace.png` | Grafana → Tempo — one distributed trace opened (API request with DB spans) |
| 15  | `mfa-prompt.png`    | Keycloak OTP prompt after enabling per-tenant MFA                          |
| 16  | `notifications.png` | The bell dropdown / notifications page with a few real events              |

## Diagrams I will draw myself in LaTeX/TikZ — [I draw]

- System architecture (client → Caddy → Next.js/NestJS/ml-service → Postgres/Redis/Keycloak/ES/MinIO)
- Procure-to-pay event flow (PM request → requisition → PO → GR → 3-way match → GL → budget)
- Deployment topology (Oracle VM, Caddy, pm2, Docker stack, observability sidecar stack)
- Multi-tenant auth flow (realm-per-tenant, condensed from `docs/architecture/auth-flow.md`)
