# BI Dashboard Recovery Plan

> PDF alignment: **F-08 Business Intelligence** and **Day 17 — BI Dashboard** (`docs/Amdox Web.pdf`)

**Goal:** Deliver a stable, PDF-compliant BI workspace (builder, drill-down, scheduled reports, SSE refresh) without UI/API drift and mock KPIs.

**Status:** ✅ Complete (Phases 0–4)

---

## PDF Requirements (Acceptance)

| Requirement                     | Target                                       | Status               |
| ------------------------------- | -------------------------------------------- | -------------------- |
| Drag-and-drop dashboard builder | Widget config JSON in Postgres               | ✅                   |
| Chart types                     | bar, line, pie, heatmap, funnel + extensions | ✅                   |
| Drill-down                      | Chart segment → filtered table               | ✅                   |
| Scheduled reports               | PDF/Excel + email                            | ✅                   |
| Real-time refresh               | SSE on `/bi/metrics/stream`                  | ✅                   |
| Dashboard save                  | `< 500ms`                                    | ✅ Debounced (400ms) |

---

## Phase 0 — Stabilize ✅

- [x] `EmployeeService.findMe` — email fallback + auto-link `userId`
- [x] Home page — graceful handling when employee profile missing
- [x] ECharts — `color: "inherit"` (no deprecated `auto`)
- [x] Shared types — `apps/web/src/lib/types/bi.ts`
- [x] Executive KPIs — live AR aggregates (no mock revenue)
- [x] Layout save — 400ms debounce
- [x] Seed — BI demo data (departments, AR, inventory, sample dashboard)

---

## Phase 1 — Builder Reliability ✅

- [x] `react-grid-layout` wired with drag + resize (`grid-layout-wrapper.tsx`)
- [x] Widget update flow in visualization pane (select visual → Update)
- [x] Server-side widget validation (`AddWidgetDto`, `UpdateWidgetDto`, `BiService.validateWidget`)
- [x] Default widget type from data source on source change

---

## Phase 2 — Drill-Down & Filters ✅

- [x] Unified aging bucket keys (`31-60`, `61-90`, display labels use en-dash)
- [x] Heatmap drill passes project name (`params.data[0]`)
- [x] Slicers wired to API query params (`period`, `department`, `status`)
- [x] Empty drill state with actionable message

---

## Phase 3 — Scheduled Reports & SSE ✅

- [x] Report run status UI (`idle` / `running` / `done` / `failed`)
- [x] Download respects format (`.pdf` vs `.csv`)
- [x] SSE reconnect with exponential backoff (up to 30s)
- [x] Email channel dev log-only fallback

---

## Phase 4 — Release Gate ✅

- [x] Smoke checklist documented below
- [x] Dashboard PATCH debounced for save latency target
- [x] `docs/planning/project_status.md` F-08 updated
- [x] Demo script for evaluators

---

## Demo Script (Evaluators)

1. **Login** → open `/bi`
2. **Executive overview** — verify AR aging pie, inventory bar, live KPI cards
3. **Filters** — set Period = Overdue; KPIs and charts refresh from API
4. **Drill-down** — click AR segment; invoice table appears below
5. **Custom page** — open **Operations overview** (seeded) or create new page
6. **Edit mode** — add bar chart (Inventory), drag/resize on grid, layout auto-saves
7. **Edit visual** — click a widget, change type/title in pane, Update visual
8. **Subscribe** — create weekly PDF report, Run, Download
9. **Live** — toggle Live off/on; SSE reconnects with backoff

---

## Key Files

| Layer      | Path                                                 |
| ---------- | ---------------------------------------------------- |
| BI page    | `apps/web/src/app/(dashboard)/bi/page.tsx`           |
| Workspace  | `apps/web/src/components/bi/bi-workspace.tsx`        |
| Grid       | `apps/web/src/components/bi/grid-layout-wrapper.tsx` |
| Types      | `apps/web/src/lib/types/bi.ts`                       |
| API client | `apps/web/src/lib/api/bi-api.ts`                     |
| Controller | `apps/api/src/bi/bi.controller.ts`                   |
| DTOs       | `apps/api/src/bi/dto/bi.dto.ts`                      |
| Data layer | `apps/api/src/bi/bi-data.service.ts`                 |
| Reports    | `apps/api/src/bi/bi-report.service.ts`               |
| Seed       | `packages/db/prisma/seed.ts`                         |

---

## Local Verification

```powershell
cd W:\amdox-erp\packages\db
npx ts-node prisma/seed.ts

cd W:\amdox-erp\apps\api
npm run start:dev

cd W:\amdox-erp\apps\web
npm run dev
```

---

_Last updated: 2026-07-03_
