# Mailpit — Alert & Test Email Inbox

> **Generated:** 2026-08-11
> **Purpose:** Catches all outbound email from this environment (Keycloak password resets, Grafana SLA alerts, etc.) instead of delivering to real inboxes.

---

## Access

| Field    | Value                                                                    |
| -------- | ------------------------------------------------------------------------ |
| URL      | [https://mailpit.92-4-86-3.sslip.io](https://mailpit.92-4-86-3.sslip.io) |
| Username | `amdox`                                                                  |
| Password | `Amdox-Obs-2026!`                                                        |

Served over HTTPS via Caddy (`/etc/caddy/Caddyfile`) with basic auth in front — the raw port (`127.0.0.1:8025` on the VM) is not directly reachable from the internet.

---

## Notes

- This is a **test mail catcher**, not a real mail service — nothing sent here reaches a real inbox (e.g. actual Gmail).
- The `company-a` Keycloak realm's SMTP is currently pointed at Mailpit (`host: mailpit`, `port: 1025`, no auth) — see realm settings via Keycloak admin, or the app's own `/settings` → Email Server (SMTP) tab.
- Other tenant realms do not yet have SMTP configured.
- See [`docs/architecture/observability.md`](../architecture/observability.md) for how Mailpit fits into the wider alerting/observability stack (it's also where Grafana SLA alert emails land).
