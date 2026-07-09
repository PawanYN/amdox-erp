# Bundle Analysis Log — Day 21

**Date:** 2026-07-07
**Purpose:** Day 21 calls for "Bundle analysis: webpack-bundle-analyzer,
code splitting strategy" — never run before this pass. The app actually
runs Next.js with Turbopack (`next dev/build --turbopack`), not raw
webpack, so the applicable tool is `@next/bundle-analyzer` (the Next-native
wrapper), which still works for a plain `next build` (Turbopack is opt-in
via the flag; a build without it uses webpack, which the analyzer needs).

Setup: `pnpm --filter web add -D @next/bundle-analyzer`, wrapped in
`apps/web/next.config.ts` behind `ANALYZE=true`. Run with
`ANALYZE=true npx next build` (no `--turbopack`, since the analyzer plugin
hooks into webpack's compilation).

---

## What the real report showed

Parsed the analyzer's embedded `window.chartData` from
`.next/analyze/client.html` directly (a JSON tree of every chunk → module →
size). Top chunks by parsed size, all of it real production build output:

| Chunk                      | Parsed size    | Contents                                          |
| -------------------------- | -------------- | ------------------------------------------------- |
| `2528.cd00699ccd1276d7.js` | **1,034.9 KB** | `echarts.js` + ECharts internals                  |
| `6445-c52e07f776ff3b31.js` | **374.1 KB**   | recharts + d3 internals + redux-toolkit/immer     |
| `framework-*.js`           | 178.5 KB       | React/React DOM (framework baseline, unavoidable) |
| `2754.043673b0ea7d67d5.js` | 66.7 KB        | `react-grid-layout`'s `Draggable.js` etc.         |

The two chart libraries alone account for over 1.4 MB of parsed JS — by
far the largest single lever in the whole bundle.

## Finding: ECharts was already properly split; Recharts was not

Checked whether these chunks were being loaded eagerly (bad — paid on
every page) or lazily (fine — paid only by pages that need them), by
comparing each page's Next.js-reported "First Load JS" against which
chunks its route actually references.

**ECharts (`apps/web/src/components/bi/{advanced-charts,widget-chart}.tsx`)
was already correctly deferred:**

```ts
const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });
```

— confirmed via `next build`'s route table: `/bi`'s First Load JS
(255 KB) didn't change before/after this session's other changes, exactly
as expected for something already code-split.

**Recharts was not.** Three pages imported it directly at module scope:

| File                                         | Import                                     |
| -------------------------------------------- | ------------------------------------------ |
| `src/app/(dashboard)/forecast/page.tsx`      | `import { BarChart, ... } from "recharts"` |
| `src/app/(dashboard)/scm/forecast/page.tsx`  | same                                       |
| `src/app/(dashboard)/scm/inventory/page.tsx` | same                                       |

This meant the ~374 KB recharts chunk (plus its own d3/redux-toolkit
dependencies) loaded as part of each of those three pages' **initial**
bundle, even though the chart itself only renders after an async
`forecastApi` call resolves — the exact code-splitting gap ECharts had
already avoided elsewhere in this same codebase.

## Fix applied

Extracted each page's chart JSX (unchanged, exact same markup/props) into
its own small client component, then deferred it with `next/dynamic`,
matching the precedent already set by `bi/widget-chart.tsx`:

- `forecast/mape-chart.tsx` ← extracted from `forecast/page.tsx`
- `scm/forecast/mape-chart.tsx` ← extracted from `scm/forecast/page.tsx`
- `scm/inventory/stock-forecast-chart.tsx` ← extracted from `scm/inventory/page.tsx`

Each page now does:

```ts
const MapeChart = dynamic(() => import('./mape-chart'), { ssr: false });
```

## Measured result (real `next build` output, before/after)

| Route                      | First Load JS before | First Load JS after | Change                          |
| -------------------------- | -------------------- | ------------------- | ------------------------------- |
| `/forecast`                | 225 kB               | 116 kB              | **-109 kB (-48%)**              |
| `/scm/forecast`            | 225 kB               | 116 kB              | **-109 kB (-48%)**              |
| `/scm/inventory`           | 228 kB               | 119 kB              | **-109 kB (-48%)**              |
| `/bi` (unchanged, control) | 255 kB               | 255 kB              | 0 (as expected — already split) |

Verified with a real authenticated browser screenshot after the change
(`/tmp/.../scratchpad/lighthouse/forecast.png`,
`/tmp/.../scratchpad/lighthouse/scm-inventory.png`) that the charts still
render correctly — the extraction only moved code, it didn't change
behavior.

## Update — the real remaining lever, found and fixed

The guess above (`react-grid-layout`) was wrong, corrected in
`testing/LIGHTHOUSE_AUDIT.md` (Round 4): `ResponsiveGridLayout` was
**already** correctly wrapped in `dynamic(..., { ssr: false })` inside
`grid-layout-wrapper.tsx`. Checking the actual `unused-javascript` audit
items (not the aggregate chunk-size list) named chunk `7222` — which
turned out to be **Recharts** (381 KB parsed), loaded via
`components/bi/widget-chart.tsx`'s direct top-level `import {...} from
"recharts"` — the same gap already fixed on 3 other pages above, just
missed here since this is a shared component (used across the whole BI
module), not a single page.

Fixing it took two steps, not one — recorded honestly:

1. Wrapping `BiWidgetChart`'s import in `bi-workspace.tsx` as
   `dynamic(() => import(".../widget-chart").then(m => m.BiWidgetChart))`
   alone **did not** shrink `/bi`'s First Load JS at all (255→256 kB).
2. Root cause: `visualization-pane.tsx` separately imported a small
   constant (`DATA_SOURCE_OPTIONS`) directly from `widget-chart.tsx` — a
   _static_ named-export import of any part of a module pulls in that
   module's entire top-level code, including its eager `recharts` import,
   regardless of a different file dynamically importing the same module
   elsewhere. Moved `DATA_SOURCE_OPTIONS`/`WIDGET_TYPES` (pure data, no
   chart-library dependency) into a new, lightweight
   `widget-config-constants.ts`, and pointed both `bi-workspace.tsx` and
   `visualization-pane.tsx` at that file instead of `widget-chart.tsx`.

**Measured result:** `/bi` First Load JS **256 kB → 130 kB (-49%)**,
verified via a real `next build`. Lighthouse performance on `/bi`:
76 → 82 (see `testing/LIGHTHOUSE_AUDIT.md` Round 4 for the full picture,
including accessibility fixes done in the same pass).
