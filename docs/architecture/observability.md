# Observability Stack (Day 26 — PLAT-05)

The PDF's Day 26 checklist:

> • OpenTelemetry SDK instrumentation (traces, metrics, logs) across all services
> • Prometheus scrape configs + Grafana dashboards (latency, error rate, saturation)
> • Loki log aggregation + Grafana log explorer
> • PagerDuty / OpsGenie alerting for SLA breaches
> • Distributed trace sampling: 100% errors, 10% success

## What each piece is (simple language)

**1. OpenTelemetry (OTel) instrumentation** — the _sensors_. Right now the API does work silently. OTel is a library added to the NestJS app that automatically records: "request came in → hit this endpoint → ran these DB queries → took 87ms → succeeded." Each recorded journey is called a **trace**. Without this, the other four bullets have nothing to look at.

**2. Prometheus + Grafana dashboards** — the _gauges on the wall_. Prometheus is a small service that every 15 seconds asks the API "how many requests? how many errors? how slow?" and stores the numbers. Grafana draws them as live charts. The three named ones — **latency** (how slow), **error rate** (how often failing), **saturation** (how close to full — CPU/RAM/connections) — are the standard "golden signals" every ops team watches.

**3. Loki + log explorer** — the _searchable diary_. The api/web/Keycloak logs currently scroll away in pm2/docker. Loki collects them all in one place, and in Grafana you can search "show all ERROR lines from the API between 2 and 3 pm" next to the charts.

**4. PagerDuty / OpsGenie alerting** — the _alarm bell_. Rules like "if error rate > 5% for 5 minutes, notify someone." PagerDuty/OpsGenie are commercial phone-call/SMS services — this is the one bullet needing an external account (both have free tiers). The honest MVP version: Grafana's built-in alerting sending email or a webhook, with PagerDuty noted as the production swap-in.

**5. Trace sampling (100% errors, 10% success)** — the _storage diet_. Recording every single successful request's full trace wastes disk; errors are what you investigate. So: keep every failed-request trace, keep only 1 in 10 successful ones. This is configuration in the trace pipeline (tail sampling in the OTel Collector — the collector sees the whole trace finish, so it knows which ones errored).

## The plan (order matters)

| Step | What                                                                                                        | Where                                                   |
| ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| 1    | OTel SDK in the NestJS API — auto-instrument HTTP, Prisma, Redis, BullMQ; export metrics + traces           | code change in `apps/api`                               |
| 2    | Prometheus + Grafana + Loki + Tempo (trace storage) + Promtail (log shipper) + OTel Collector as containers | one new docker-compose file in `infra/`                 |
| 3    | Grafana dashboards for the golden signals + log explorer wired to Loki                                      | Grafana config (provisioned as files, committed to git) |
| 4    | Sampling policy: 100% errors / 10% success                                                                  | OTel Collector tail-sampling config                     |
| 5    | Alert rules in Grafana (error rate, latency SLA) → email/webhook; PagerDuty only with an account            | Grafana config                                          |

## Status: built and verified (2026-07-12)

Everything below ran and was checked live on the VM, not just configured:

- **API instrumented** — `apps/api/src/infrastructure/observability/otel.ts`, loaded first in `main.ts`. Metrics on `:9464/metrics` (HTTP histograms + Node.js runtime), traces via OTLP to the collector. `OTEL_DISABLED=true` switches it all off.
- **ml-service instrumented** — FastAPI traces → collector (bridged onto the app docker network). Verified: `amdox-ml-service` traces visible in Tempo.
- **Stack up** — 7 containers (`infra/observability/docker-compose.observability.yml`): collector, Tempo, Prometheus, node-exporter, Loki, Promtail, Grafana. All Prometheus targets **up**.
- **Tail sampling verified** — 60 successful requests → 3 traces kept (~10%); error traces keep at 100% per the collector policy.
- **Logs verified** — Loki serving both `job="pm2"` (api/web) and `job="docker"` (Keycloak, Postgres, ml, …) streams.
- **Dashboard** — "Amdox API — Golden Signals" provisioned from git: request rate, 5xx %, p50/p95 latency (300ms SLA line), host CPU/memory, event-loop utilization, live API logs panel.
- **Alerts** — two provisioned SLA rules (5xx > 5%, p95 > 300ms, both sustained 5m) → email contact point; test notification **delivered to Mailpit** (`http://localhost:8025`). PagerDuty/OpsGenie = swap the receiver, rules unchanged.
- **Gotcha fixed** — Oracle's default iptables rejects container→host traffic; opened 9464 + 1025 to the docker subnet only, persisted in `/etc/iptables/rules.v4`.

Where to look: Grafana **[https://grafana.92-4-86-3.sslip.io](https://grafana.92-4-86-3.sslip.io)** (admin / `Amdox-Obs-2026!`) · Mailpit **[https://mailpit.92-4-86-3.sslip.io](https://mailpit.92-4-86-3.sslip.io)** (amdox / `Amdox-Obs-2026!`) · Prometheus localhost-only `:9090`. Concepts walkthrough: `docs/learning/day26-observability-concepts.md`.

Honest scope notes: `amdox-web` ships logs only (its work lands on the traced API; Next.js `instrumentation.ts` is the follow-up if ever needed); Prisma's own spans need the `tracing` preview feature (skipped — `pg` driver spans already come through); Grafana and Mailpit are exposed through Caddy over HTTPS (Grafana has its own login; Mailpit sits behind Caddy basic auth); Prometheus/Loki/Tempo remain localhost-only since they have no auth of their own.

## Practical notes

- The VM has plenty of headroom (~13% RAM used), so the extra containers are fine. The stack joins the **docker-compose** side (matching how the live demo actually runs), not the kind cluster.
- This is PLAT-05, a **P3** — the demo video (PLAT-02) is still the item standing before submission.
- Architecture at a glance:

```
                    ┌─ metrics (:9464/metrics) ──────► Prometheus ─┐
  amdox-api (pm2) ──┤                                              ├──► Grafana
                    └─ traces (OTLP) ─► OTel Collector ─► Tempo  ──┤    (dashboards,
                                        (tail sampling:            │     log explorer,
                                         100% errors,              │     alerts)
                                         10% success)              │
  pm2 + docker logs ──► Promtail ─────────────────────► Loki  ─────┘
```

## Public URLs (hosted, like the main app)

| Service                                       | URL                                                                          | Login                     |
| --------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------- |
| **Grafana** (dashboard, logs, traces, alerts) | **[https://grafana.92-4-86-3.sslip.io](https://grafana.92-4-86-3.sslip.io)** | admin / `Amdox-Obs-2026!` |
| **Mailpit** (alert-email inbox)               | **[https://mailpit.92-4-86-3.sslip.io](https://mailpit.92-4-86-3.sslip.io)** | amdox / `Amdox-Obs-2026!` |

Both serve over HTTPS via Caddy (`/etc/caddy/Caddyfile` on the VM). Verified from outside, including the negative cases: Mailpit refuses entry without the password, and Grafana rejects the old weak password (hardened from `amdox` to `Amdox-Obs-2026!` when it went public).

**What stayed private on purpose:** Prometheus, Loki, Tempo, and the raw `:9464` metrics port have **no login of their own**, so exposing them would hand logs and metrics to anyone. Nothing is lost — Grafana proxies all three, so their data is fully visible inside Grafana's authenticated UI (Explore → Loki / Tempo, dashboards → Prometheus).

## What you now have, point by point

**1) Observation dashboard** — Grafana at **[https://grafana.92-4-86-3.sslip.io](https://grafana.92-4-86-3.sslip.io)** (login: admin / `Amdox-Obs-2026!`). Inside it, the dashboard **"Amdox API — Golden Signals"** (folder _Amdox_) with 7 live panels: request rate, 5xx error %, p50/p95 latency with the 300ms SLA line, host CPU %, host memory %, event-loop utilization, and a live API-logs panel at the bottom.

**2) Logs search (all services in one place)** — Grafana → Explore → Loki. Query `{job="pm2"}` for api/web logs, `{job="docker"}` for Keycloak/Postgres/Redis/ml-service logs. Filter by text, time range, and filename.

**3) Trace viewer (journey of one request)** — Grafana → Explore → Tempo → Search. Pick service `amdox-api` or `amdox-ml-service`, click any trace, and see the full request journey with per-step timings (HTTP → express → Redis → DB).

**4) Raw metrics endpoint** — `http://localhost:9464/metrics` (VM-only, not public). What the API itself publishes (every request counted and timed, plus Node.js internals). Prometheus reads it every 15s.

**5) Prometheus query console** — `http://localhost:9090` (VM-only; Grafana proxies it, so you rarely need it directly). Ad-hoc queries against all stored numbers (the Targets page shows the 4 things being watched, all "up").

**6) Two alarms, armed** — if 5xx errors exceed 5% for 5 minutes, or p95 latency exceeds 300ms for 5 minutes → an email fires automatically.

**7) Alert inbox** — Mailpit at **[https://mailpit.92-4-86-3.sslip.io](https://mailpit.92-4-86-3.sslip.io)** (basic auth: amdox / `Amdox-Obs-2026!`). That's where the alarm emails land (a test email from the verification run is already in there).

**8) Storage rules working silently** — every errored request's trace is kept, only 1-in-10 successful ones; traces auto-delete after 7 days.

**9) One switch to run it** — `docker compose -f infra/observability/docker-compose.observability.yml up -d` / `down`. The app runs fine with the stack off.

**Note:** Grafana and Mailpit are public over HTTPS via Caddy (`/etc/caddy/Caddyfile` on the VM); everything without its own login — Prometheus, Loki, Tempo, the raw metrics port — stays localhost-only, reachable through Grafana's authenticated UI or an SSH tunnel (`ssh -L 9090:localhost:9090 <vm>`).

The two best things to try first: open the dashboard (#1) and click around the live charts, then pull up one trace (#3) — seeing a single request's anatomy is the "aha" moment of the whole stack.
