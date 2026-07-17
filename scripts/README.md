# Repo-wide ops/dev scripts

Manual utility scripts run by hand (`node scripts/<folder>/<file>` or `.\scripts\<folder>\<file>.ps1`), not wired into any `package.json` or CI pipeline. Distinct from [`apps/api/scripts/`](../apps/api/scripts/), which holds in-package scripts run via `pnpm --filter api run <script>` (some of which are CI-gated).

| Folder         | Purpose                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| `keycloak/`    | Local Keycloak realm setup/teardown for development                                                      |
| `data-seed/`   | One-off scripts to seed or fix up the `company-a` demo tenant's data                                     |
| `scaffolding/` | Code-generation helpers (e.g. `generate-files.js` scaffolded the initial `apps/api/src` module skeleton) |
| `reporting/`   | Generates the database ERD (`docs/erd/`) from the live Prisma schema                                     |
