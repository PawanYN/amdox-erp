// Pure data, no chart-library imports — kept separate from widget-chart.tsx
// so consumers that only need these constants (e.g. a data-source picker)
// don't force-load recharts/echarts as a side effect of the same module,
// which would defeat dynamically importing BiWidgetChart itself.
import type { BiDataSource, WidgetType } from "@/lib/api/bi-api";

export const DATA_SOURCE_OPTIONS: {
  value: BiDataSource;
  label: string;
  defaultType: WidgetType;
}[] = [
  { value: "ar_aging", label: "AR Aging", defaultType: "pie" },
  { value: "inventory", label: "Inventory levels", defaultType: "bar" },
  { value: "purchase_orders", label: "Purchase orders by status", defaultType: "bar" },
  { value: "employees_by_department", label: "Employees by department", defaultType: "pie" },
  { value: "project_funnel", label: "Project funnel", defaultType: "funnel" },
  { value: "resource_heatmap", label: "Resource utilisation heatmap", defaultType: "heatmap" },
];

export const WIDGET_TYPES: WidgetType[] = [
  "bar",
  "line",
  "pie",
  "heatmap",
  "funnel",
  "gauge",
  "card",
  "waterfall",
  "scatter",
  "treemap",
];
