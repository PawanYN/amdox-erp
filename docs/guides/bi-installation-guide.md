# Quick Installation & Testing Guide

## Installation Steps

Since npm install had issues with husky, you have two options:

### Option 1: Install Dependencies Manually

```bash
cd apps/web
npm install --legacy-peer-deps react-grid-layout @types/react-grid-layout
```

### Option 2: Use the package.json (Already Updated)

The dependencies are already added to package.json:

- `react-grid-layout: ^1.4.4`
- `@types/react-grid-layout: ^1.3.5`

Just run your normal install command when the husky issue is resolved.

## Testing the New Features

### 1. Start the Development Server

```bash
cd apps/web
npm run dev
```

### 2. Navigate to BI Page

Visit: `http://localhost:3000/(dashboard)/bi`

### 3. Test Drag-and-Drop

1. Click the **"Edit"** button in the ribbon
2. You'll see grip icons (⋮⋮) appear on widget headers
3. Drag widgets by clicking and holding the header
4. Resize widgets using corner handles
5. Layout auto-saves to backend

### 4. Test New Visualizations

1. In Edit mode, click **"+ New page"** to create a custom dashboard
2. Use the **Visualizations pane** on the right to add widgets
3. Try different chart types:
   - **Gauge**: Shows percentage completion
   - **Card**: Large KPI values with trends
   - **Waterfall**: Financial flow analysis
   - **Scatter**: Two-dimensional correlation
   - **Treemap**: Hierarchical data visualization

### 5. Test Executive Dashboard

1. The Executive overview page now has:
   - Revenue card with YTD metrics
   - Cash flow gauge
   - Gross margin card with trends
   - AR aging pie chart (click to filter)
   - Inventory bar chart (click to filter)

### 6. Test Cross-Filtering

1. Click any segment in a chart
2. Other visuals will highlight related data
3. Drill-down panel appears at bottom with detailed records
4. Click "Close" to reset filters

## Troubleshooting

### If widgets don't appear to be draggable:

1. Make sure you're in **Edit mode** (yellow button in ribbon)
2. Check browser console for errors
3. Ensure react-grid-layout CSS is loaded

### If layout doesn't save:

1. Check Network tab for API calls to `/bi/dashboards/{id}`
2. Verify backend is running
3. Check authentication token is valid

### If new chart types don't render:

1. Clear browser cache
2. Check that ECharts loaded (dynamic import)
3. Verify data format matches chart type requirements

## Key Files Modified/Created

### New Files

- `apps/web/src/components/bi/grid-layout-wrapper.tsx` - Grid layout system
- `apps/web/src/components/bi/advanced-charts.tsx` - New chart types
- `apps/web/src/styles/grid-layout.css` - Grid styling
- `docs/guides/bi-enhancement-readme.md` - Full documentation

### Modified Files

- `apps/web/package.json` - Added dependencies
- `apps/web/src/app/layout.tsx` - CSS imports
- `apps/web/src/components/bi/bi-workspace.tsx` - Grid integration
- `apps/web/src/components/bi/widget-chart.tsx` - New chart support
- `apps/web/src/components/bi/power-bi-visual.tsx` - Drag handles
- `apps/web/src/components/bi/power-bi-theme.ts` - Visual metadata
- `apps/web/src/components/bi/visualization-pane.tsx` - Icon updates
- `apps/web/src/lib/api/bi-api.ts` - Widget types

## Next Steps

1. Install dependencies: `npm install --legacy-peer-deps` (in apps/web)
2. Run dev server: `npm run dev`
3. Navigate to BI page and test features
4. Create custom dashboards and explore visualizations
5. Share feedback on the Power BI-like experience!

## Known Limitations

1. Executive overview page is read-only (by design)
2. Some chart types require specific data formats
3. Mobile drag/drop works but desktop is optimal
4. Layout is per-dashboard, not per-user

## Performance Tips

- Limit to 10-12 widgets per page for best performance
- Use card/gauge types for simple metrics
- Complex charts (heatmap, treemap) are more resource-intensive
- Real-time updates (SSE) can be toggled off if needed

Enjoy your new Power BI-like BI dashboard! 🎉
