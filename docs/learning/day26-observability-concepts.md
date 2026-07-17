# Day 26 — Observability: Concepts & What We Built

Companion to `docs/architecture/observability.md` (the plan) and `infra/observability/` (the stack).
This explains each concept the way it clicked while building, one piece at a time.

## The one-sentence version

**Monitoring answers "is it broken?" — observability answers "why is it broken?"**
You get there with three kinds of data: **metrics** (numbers over time), **logs**
(text lines), and **traces** (the journey of one request). The industry calls these
the _three pillars_.

## The cast of characters (what each tool actually does)

| Tool                     | Pillar    | Job in one line                                                                                                              |
| ------------------------ | --------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **OpenTelemetry (OTel)** | all three | The _sensor library_ inside the app — records what happens, ships it out. Vendor-neutral standard, so we're never locked in. |
| **Prometheus**           | metrics   | Scrapes `/metrics` every 15s, stores time series, answers queries like "p95 latency over 5 min".                             |
| **Grafana**              | UI        | Draws everything: dashboards, log search, trace viewer, alerts. One pane of glass.                                           |
| **Loki**                 | logs      | "Prometheus but for logs" — stores log lines with labels, cheap and searchable.                                              |
| **Promtail**             | logs      | The courier: tails log files (pm2, docker) and pushes them into Loki.                                                        |
| **Tempo**                | traces    | The trace warehouse — stores every kept trace, Grafana queries it by ID or search.                                           |
| **OTel Collector**       | plumbing  | Middleman between apps and storage. Receives everything, _then_ decides what to keep (sampling), then forwards.              |

## Decisions worth remembering (and why)

**Why the API exposes metrics but _pushes_ traces.** Metrics are cheap and constant —
Prometheus's pull model (scrape :9464) is simpler and self-healing. Traces are bursty
and need sampling decisions — they flow through the collector (push, OTLP on :4318).

**Why sampling is in the collector, not the app (tail vs head).** The PDF demands
"100% errors, 10% success". An app can only decide _at the start_ of a trace (head
sampling) — but you don't know a request will error until it finishes! The collector
buffers each trace (`decision_wait: 10s`), sees how it ended, and keeps all errored
traces + 10% of the rest. That's **tail sampling**, and it's the only honest way to
implement that exact policy.

**Why Grafana alerts email Mailpit instead of PagerDuty.** The PDF names
PagerDuty/OpsGenie — commercial paging services needing an account. The _mechanism_
(Grafana alert rule → contact point) is identical whichever receiver you plug in.
We point it at the Mailpit container already in the stack, so an SLA breach sends a
**real, inspectable email** (http://localhost:8025). Swapping to PagerDuty later is
a one-receiver config change — the rules don't change.

**Why the golden signals.** Latency, error rate, and saturation (plus traffic) are
Google's SRE-book "four golden signals" — the minimal set that catches almost any
production problem. Our dashboard: request rate, 5xx %, p50/p95 latency (SLA line at
300ms — the PDF's NFR), host CPU %, host memory %, Node.js event-loop utilization.

**The firewall gotcha (cost us 20 minutes).** Oracle Cloud VMs ship iptables that
REJECT everything except 22/80/443 — _including traffic from docker containers to
host ports_. "No route to host" from inside a container while `curl` works on the
host = this. Fix: allow the docker subnet (172.16.0.0/12) to the specific ports
(9464 metrics, 1025 SMTP), persisted in `/etc/iptables/rules.v4`.

**Port collisions on a busy VM.** Loki's default 3100 clashed with `amdox-web`'s pm2
port, Grafana's 3000 with the dev web port — so Loki publishes on 3110, Grafana
on 3300. Inside the docker network they keep their native ports.

## What "instrumented" means per service, honestly

- **amdox-api (NestJS, pm2)** — full: traces (HTTP + express + ioredis + pg auto-
  instrumentation) exported via OTLP, metrics on :9464 (HTTP histograms + Node.js
  runtime), logs shipped from pm2 files. One import line in `main.ts` _before_ the
  framework loads, because auto-instrumentation patches modules at require-time.
- **amdox-ml-service (FastAPI, docker)** — traces via `FastAPIInstrumentor` +
  OTLP → collector (bridged onto the app's docker network); logs via docker json
  files. No metrics endpoint (traces + logs only).
- **amdox-web (Next.js, pm2)** — logs only (pm2 files → Promtail). Its user-facing
  work lands on the API anyway, which is fully traced. Next.js OTel instrumentation
  exists (`instrumentation.ts`) and is the natural next step if needed.
- **Keycloak / Postgres / Redis / etc. (docker)** — logs via docker json files.
- **Prisma DB spans**: Prisma 5 needs the `tracing` preview feature + regenerated
  client for its own spans; the underlying `pg` driver spans are captured by
  auto-instrumentation already, so this was skipped deliberately.

## How to use it (the 2-minute tour)

1. **Grafana**: http://localhost:3300 (admin / amdox) → dashboard "Amdox API —
   Golden Signals" (folder _Amdox_).
2. **Search logs**: Explore → Loki → `{job="pm2", filename=~".*amdox-api.*"}` —
   or `{job="docker"}` for Keycloak/Postgres/ml.
3. **Look at a trace**: Explore → Tempo → Search, service `amdox-api` → click one →
   see the request's whole journey with timings.
4. **Alerts**: Alerting → Alert rules — two SLA rules (5xx > 5%, p95 > 300ms, both
   for 5m). Breach emails land in Mailpit: http://localhost:8025.
5. **Start/stop the stack**:
   `docker compose -f infra/observability/docker-compose.observability.yml up -d` / `down`.
   The app works fine with the stack down — exporters just retry quietly.
