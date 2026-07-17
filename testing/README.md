# Black-box API test suite

A standalone Node project (own `package.json`) — intentionally **not** part of the pnpm/turbo workspace (`pnpm-workspace.yaml` only globs `apps/*` and `packages/*`). It drives the live, running stack over HTTP with real authenticated requests, rather than importing application code directly.

Run via `node testing/run-all.js` or `cd testing && npm test` — not through `pnpm --filter` or `turbo run`.

| Path       | Purpose                                                                                                                            |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `suites/`  | 9 authenticated black-box test suites (health, finance/GL, HR/payroll, SCM, PM, forecast, auth/RBAC, P2P smoke chain, audit)       |
| `helpers/` | Shared test client, assertions, runner                                                                                             |
| `load/`    | k6 load test + load-test user provisioning                                                                                         |
| `results/` | Timestamped k6 run outputs                                                                                                         |
| `*.md`     | Point-in-time logs from specific test passes (k6, Lighthouse, query optimisation, SAML SSO, terminal diagnostics, bundle analysis) |
