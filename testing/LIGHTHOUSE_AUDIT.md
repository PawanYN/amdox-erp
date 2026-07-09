# Lighthouse Audit Log — Day 21

**Date:** 2026-07-07
**Purpose:** Day 21 calls for "React frontend: Lighthouse score >= 90
(performance, accessibility)" — never run or recorded before this pass.
This log records real Lighthouse 12 runs (via `puppeteer` driving a
headless Chromium + the `lighthouse` npm package's Node API) against the
actual app, including a real authenticated login through Keycloak — not a
synthetic/mocked session.

Login flow used for authenticated pages: navigate to the real
Keycloak-hosted login URL (the same URL `apps/web/src/app/(auth)/login/page.tsx`
constructs), submit real credentials for the seeded `admin@companya.in`
TenantAdmin user, let the app's own `KeycloakProvider` complete the code
exchange, then run Lighthouse against the same browser instance (shared
cookies/localStorage via the CDP debugging port) so the audit sees a
genuinely logged-in app.

---

## Round 1 — `/login` (unauthenticated, dev server)

| Category       | Score |
| -------------- | ----- |
| Performance    | 90    |
| Accessibility  | 96    |
| Best Practices | 100   |
| SEO            | 100   |

Already meets the ≥90 target — a simple, static-ish page with no auth
dependency.

## Round 2 — `/home` and `/bi` (authenticated, **dev server** — `next dev --turbopack`)

| Page    | Performance | Accessibility | Best Practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| `/home` | 63          | 83            | 96             | 100 |
| `/bi`   | 40          | 83            | 96             | 100 |

Both well under target. Two real, distinct causes were found — one a
genuine app bug, one a measurement-methodology issue:

### Cause A — every fresh page load does a full top-level redirect to Keycloak (real bug, fixed)

The `redirects` audit showed ~5-6 **seconds** of pure redirect overhead on
both pages:

```
home redirect chain:
  http://localhost:3000/home                                    wastedMs: 4744.9
  http://localhost:8180/.../auth?...&prompt=none                 wastedMs: 311.8
  http://localhost:3000/home                                     wastedMs: 0

bi redirect chain:
  http://localhost:3000/bi                                       wastedMs: 4882.4
  http://localhost:8180/.../auth?...&prompt=none                 wastedMs: 1061.8
  http://localhost:3000/bi                                       wastedMs: 0
```

Root cause: `apps/web/src/components/KeycloakProvider.tsx` called
`kc.init({ onLoad: "check-sso", checkLoginIframe: false })` with no
`silentCheckSsoRedirectUri`. Without that option, keycloak-js's "check-sso"
does a **full top-level page redirect** to Keycloak (`prompt=none`) and
back on every fresh page load — not just first login — to silently verify
the session. That's a real, reproducible ~5s tax on every direct load of
any protected route (bookmark, refresh, or — as here — Lighthouse's own
fresh navigation), confirmed identically on two different pages.

**Fix:** added `apps/web/public/silent-check-sso.html` (the standard
keycloak-js static relay page — posts `location.href` to the parent via
`postMessage`, no top-level navigation) and passed
`silentCheckSsoRedirectUri: \`${window.location.origin}/silent-check-sso.html\``into`kc.init()`. This makes the same check happen inside a hidden iframe
instead of a visible top-level redirect.

### Cause B — dev server, not production build (measurement-methodology issue, not a bug)

`unminified-javascript` and `unused-javascript` opportunities of
200-700 KiB were partly an artifact of auditing `next dev --turbopack`
(unminified, includes HMR/dev-only code) rather than a real production
build. Re-measured against `next build && next start` below for an honest
number.

---

## Round 3 — `/home` and `/bi` (authenticated, **production build**, both fixes applied)

```
$ next build && next start
```

| Page    | Performance | Accessibility | Best Practices | SEO |
| ------- | ----------- | ------------- | -------------- | --- |
| `/home` | **93**      | 83            | 96             | 100 |
| `/bi`   | **76**      | 83            | 96             | 100 |

`redirects` opportunity is now **gone entirely** on both pages, confirming
the iframe fix worked:

| Metric                   | `/home` before → after | `/bi` before → after |
| ------------------------ | ---------------------- | -------------------- |
| Largest Contentful Paint | 11.2s → 3.0s           | 16.1s → 4.0s         |
| Total Blocking Time      | 460ms → 70ms           | 3,300ms → 430ms      |
| Time to Interactive      | 11.3s → 3.0s           | 22.2s → 5.9s         |

`/home` now clears the ≥90 target. `/bi` improved dramatically (40→76) but
doesn't quite reach 90 yet.

Accessibility (83 on both authenticated pages, vs. 96 on the public login
page) did not move between rounds — a separate, real gap, picked up in
Round 4 below.

---

## Round 4 — accessibility fixes + the real `/bi` performance culprit

Went back and fixed both remaining gaps for real instead of leaving them
as follow-ups.

### Accessibility — 3 real, specific failures (not investigated in Round 3, fixed here)

Read the actual failing audit items (`categories.accessibility.auditRefs`)
in `bi.report.json`/`home.report.json` instead of guessing:

1. **`button-name`** — the header's Search and Bell icon buttons
   (`components/layout/dashboardLayout.tsx`) had no accessible name (icon
   only, no `aria-label`). Fixed: added `aria-label="Search"` /
   `aria-label="Notifications"`.
2. **`select-name`** — the header's role-switcher `<select>` had no label
   of any kind. Fixed: added `aria-label="Switch role"`.
3. **`color-contrast`** — `text-slate-400` (2.63:1 contrast on white,
   needs 4.5:1) used for secondary/meta text — found in **37 files**
   across the whole app via `grep -rl`, not just these 2 pages. The
   design system already defines `--color-muted: #64748B` (slate-500) in
   `globals.css`; calculated its contrast against white (4.76:1) before
   touching anything — passes. Fixed with a scripted, word-boundary-safe
   replace of `text-slate-400` → `text-slate-500` across all 37 files
   (excluding `placeholder:text-slate-400`, a different, unflagged case).
   Also separately fixed the `home` page's "Clock In" button
   (`bg-emerald-600` + white text, 3.65:1) → `bg-emerald-700` (darker,
   passes).

**Result:** `/home` accessibility 83 → **100**. `/bi` accessibility 83 →
**90**. Both now clear the ≥90 target.

### Performance — the real `/bi` culprit, corrected

Round 3 guessed the remaining `unused-javascript` was `react-grid-layout`.
That guess was wrong — checked directly by re-running the bundle analyzer
and reading which chunk `unused-javascript` actually named:

```
chunk 2528 (echarts)   — 245,761 wasted bytes of 344,491
chunk 7222 (recharts)  — 88,036 wasted bytes of 110,430
```

`react-grid-layout`'s `ResponsiveGridLayout` was **already** correctly
wrapped in `dynamic(..., { ssr: false })` inside
`grid-layout-wrapper.tsx` — that guess didn't hold up. Chunk `7222` is
actually **Recharts** (381 KB parsed) — found via
`components/bi/widget-chart.tsx`, which statically imports Recharts at
module scope (the same gap already fixed on 3 other pages in
`testing/BUNDLE_ANALYSIS.md`, just missed here since this is a shared
component, not a page).

**Fix, in two parts** (the first alone didn't work — recorded honestly):

1. Wrapped the import in `bi-workspace.tsx`:
   `const BiWidgetChart = dynamic(() => import(".../widget-chart").then(m => m.BiWidgetChart), { ssr: false })`.
   Rebuilt — `/bi`'s First Load JS **didn't change** (255→256 kB).
2. Found why: `visualization-pane.tsx` _also_ imported a small constant
   (`DATA_SOURCE_OPTIONS`) directly from `widget-chart.tsx` — and any
   static named-export import of a module pulls in that module's entire
   top-level code (including its eager Recharts import), regardless of a
   _different_ file elsewhere dynamically importing the same module. Fixed
   by moving `DATA_SOURCE_OPTIONS`/`WIDGET_TYPES` (pure data, no
   chart-library dependency) into a new `widget-config-constants.ts`, and
   pointing both `bi-workspace.tsx` and `visualization-pane.tsx` at that
   file instead.

**Result, measured via a real `next build`:** `/bi` First Load JS
**256 kB → 130 kB** (-49%).

Also applied the cheap, safe `uses-rel-preconnect` opportunity (~150ms) —
added `<link rel="preconnect" href={apiUrl}>` to the root layout, since
nearly every page fires an API request immediately on load.

### Final scores (production build, both fixes applied)

| Page     | Performance | Accessibility | Best Practices | SEO |
| -------- | ----------- | ------------- | -------------- | --- |
| `/login` | 90          | 96            | 100            | 100 |
| `/home`  | **94**      | **100**       | 96             | 100 |
| `/bi`    | 82          | **90**        | 96             | 100 |

All 3 pages now clear ≥90 accessibility. `/login` and `/home` clear ≥90
performance; `/bi` reached 82 (up from an original 40 — more than
doubled) but not 90. Remaining cost on `/bi`, honestly: ECharts itself
(chunk `2528`, still ~245 KB "unused" per the audit) — it bundles many
renderer types together (bar/line/pie/heatmap/funnel/gauge/waterfall/
scatter/treemap, per `bi.service.ts`'s `VALID_WIDGET_TYPES`), and this
dashboard's default view only uses a few of them. A tree-shaken custom
ECharts build (importing `echarts/core` + only the specific chart/
renderer modules actually used) would shrink this further, but is a more
invasive change than a `next/dynamic` boundary — flagged as a follow-up,
not attempted here. LCP (3.2s) and TBT (410ms) are both now reasonable in
absolute terms even though the percentile score doesn't clear 90.

---

## A real, separate finding: intermittent 401 on a hard reload of a deep route

While taking verification screenshots (not during a Lighthouse run itself
— confirmed clean via that run's `errors-in-console` audit, score 1/1),
one hard-reload navigation directly to `/bi` (as opposed to clicking the
in-app sidebar link) intermittently produced 401s from `/bi/kpis`,
`/bi/dashboards`, etc. immediately after a real login.

Root cause, not yet fixed: `(dashboard)/layout.tsx` mounts
`KeycloakProvider` once per full page load. Normal in-app navigation
(clicking a sidebar link) is a Next.js client-side transition and never
remounts this layout, so `kc.init()` only ever runs once per session. A
**hard** reload of a deep route (bookmark, browser refresh, or a test
script using `page.goto()` instead of a real link click) remounts it fresh,
triggering a new iframe-based silent-SSO check that appears to race with
in-flight API calls fired by the page before that check resolves. Flagged
here as a follow-up, not fixed — it didn't affect any of the recorded
scores above (each of those was a single clean navigation), but it's a
real rough edge for the bookmark/refresh case.

---

## Screenshots (real, authenticated)

Captured during this session at
`/tmp/.../scratchpad/lighthouse/home-authenticated.png` and `bi.png` —
confirm the app renders correctly end-to-end (real KPI numbers, real BI
workspace layout) with all of this session's changes applied, not just
that Lighthouse returned a score.
