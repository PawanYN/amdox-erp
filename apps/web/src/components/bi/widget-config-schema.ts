import type { WidgetType } from "@/lib/api/bi-api";

/** Data query attributes per chart type (mirrors Query Guard read-model spec) */
export const DATA_FIELD_CONFIG: Record<string, string[]> = {
  bar: ["dimension", "metric", "aggregation", "groupBy"],
  line: ["dimension", "metric", "aggregation", "interval"],
  pie: ["dimension", "metric", "aggregation", "maxSlices"],
  heatmap: ["xDimension", "yDimension", "metric", "aggregation"],
  funnel: ["stages", "metric"],
  gauge: ["metric", "aggregation", "target"],
  card: ["metric", "aggregation"],
  waterfall: ["dimension", "metric", "aggregation"],
  scatter: ["xMetric", "yMetric", "sizeMetric"],
  treemap: ["dimension", "metric", "aggregation"],
};

export const DATA_FIELD_LABELS: Record<string, string> = {
  dimension: "Dimension",
  metric: "Metric",
  aggregation: "Aggregation",
  groupBy: "Group by (optional)",
  interval: "Interval",
  maxSlices: "Max slices",
  xDimension: "X dimension",
  yDimension: "Y dimension",
  stages: "Stages (comma separated)",
  target: "Target value",
  xMetric: "X axis metric",
  yMetric: "Y axis metric",
  sizeMetric: "Bubble size (optional)",
};

export const REQUIRED_DATA_FIELDS: Record<string, string[]> = {
  bar: ["dimension", "metric", "aggregation"],
  line: ["dimension", "metric", "aggregation"],
  pie: ["dimension", "metric", "aggregation"],
  heatmap: ["xDimension", "yDimension", "metric", "aggregation"],
  funnel: ["stages", "metric"],
  gauge: ["metric"],
  card: ["metric"],
  waterfall: ["dimension", "metric", "aggregation"],
  scatter: ["xMetric", "yMetric"],
  treemap: ["dimension", "metric", "aggregation"],
};

/** Visual / format options per chart type (Power BI–style) */
export const STYLE_FIELD_CONFIG: Record<string, string[]> = {
  bar: ["orientation", "showDataLabels", "showGrid", "showLegend", "barRadius", "colorPalette"],
  line: ["smooth", "showPoints", "showArea", "showGrid", "showLegend", "lineColor", "colorPalette"],
  pie: ["donut", "showLegend", "showLabels", "innerRadiusPct", "colorPalette"],
  heatmap: ["colorScheme", "showValues", "showGrid"],
  funnel: ["sort", "gap", "showLabels", "colorPalette"],
  gauge: ["min", "max", "format", "targetColor", "showTarget"],
  card: ["format", "trend", "accentColor"],
  waterfall: ["showConnectors", "positiveColor", "negativeColor", "colorPalette"],
  scatter: ["showGrid", "pointSize", "colorPalette"],
  treemap: ["showLabels", "colorPalette"],
};

export const STYLE_FIELD_LABELS: Record<string, string> = {
  orientation: "Orientation",
  showDataLabels: "Show data labels",
  showGrid: "Show grid lines",
  showLegend: "Show legend",
  barRadius: "Bar corner radius",
  colorPalette: "Color palette",
  smooth: "Smooth line",
  showPoints: "Show points",
  showArea: "Fill area under line",
  lineColor: "Line color",
  donut: "Donut chart",
  showLabels: "Show slice labels",
  innerRadiusPct: "Donut hole (%)",
  colorScheme: "Heat color scheme",
  showValues: "Show cell values",
  sort: "Sort stages",
  gap: "Stage gap",
  min: "Minimum",
  max: "Maximum",
  format: "Value format",
  targetColor: "Target arc color",
  showTarget: "Show target marker",
  trend: "Trend indicator",
  accentColor: "Accent color",
  showConnectors: "Show connectors",
  positiveColor: "Increase color",
  negativeColor: "Decrease color",
  pointSize: "Point size",
};

export const AGGREGATIONS = ["sum", "avg", "count", "min", "max"] as const;
export const INTERVALS = ["day", "week", "month", "quarter"] as const;
export const OPERATORS = ["=", "!=", ">", "<", ">=", "<=", "in"] as const;

export const COLOR_PALETTES = [
  { id: "default", label: "Power BI default" },
  { id: "blues", label: "Blues" },
  { id: "warm", label: "Warm sunset" },
  { id: "greens", label: "Forest greens" },
  { id: "mono", label: "Monochrome" },
  { id: "gold", label: "Gold accent" },
] as const;

export const HEAT_COLOR_SCHEMES = [
  { id: "blues", label: "Blues" },
  { id: "gold", label: "Gold" },
  { id: "greens", label: "Greens" },
  { id: "redGreen", label: "Red → Green" },
] as const;

export const PALETTE_COLORS: Record<string, string[]> = {
  default: ["#118DFF", "#12239E", "#E66C37", "#6B007B", "#E044A7", "#744EC2", "#D9B300", "#009988"],
  blues: ["#0078D4", "#005A9E", "#004578", "#002050", "#71AFE5", "#A8D4FF", "#C7E0F4", "#DEECF9"],
  warm: ["#E66C37", "#D13438", "#FF8C00", "#FFB900", "#E81123", "#744EC2", "#881798", "#CA5010"],
  greens: ["#107C10", "#0B6A0B", "#498205", "#009988", "#00B294", "#018574", "#2D7D9A", "#69AFE5"],
  mono: ["#252423", "#605E5C", "#8A8886", "#A19F9D", "#C8C6C4", "#D2D0CE", "#EDEBE9", "#F3F2F1"],
  gold: ["#FFB900", "#D9B300", "#F2C811", "#CA5010", "#E66C37", "#744EC2", "#118DFF", "#107C10"],
};

export type WidgetFilter = { field: string; op: string; value: string };

export type WidgetQueryAttrs = Record<string, string | undefined>;

export type WidgetStyleConfig = {
  orientation?: "vertical" | "horizontal";
  showDataLabels?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  barRadius?: number;
  colorPalette?: string;
  smooth?: boolean;
  showPoints?: boolean;
  showArea?: boolean;
  lineColor?: string;
  donut?: boolean;
  showLabels?: boolean;
  innerRadiusPct?: number;
  colorScheme?: string;
  showValues?: boolean;
  sort?: "desc" | "asc" | "none";
  gap?: number;
  min?: number;
  max?: number;
  format?: "number" | "percent" | "currency";
  targetColor?: string;
  showTarget?: boolean;
  trend?: "up" | "down" | "neutral";
  accentColor?: string;
  showConnectors?: boolean;
  positiveColor?: string;
  negativeColor?: string;
  pointSize?: number;
};

export function getDataFields(type: WidgetType): string[] {
  return DATA_FIELD_CONFIG[type] || [];
}

export function getStyleFields(type: WidgetType): string[] {
  return STYLE_FIELD_CONFIG[type] || [];
}

export function getRequiredDataFields(type: WidgetType): string[] {
  return REQUIRED_DATA_FIELDS[type] || [];
}

export function getMissingRequiredFields(type: WidgetType, attrs: WidgetQueryAttrs): string[] {
  return getRequiredDataFields(type).filter((f) => !attrs[f]?.trim());
}

export function buildQuerySpec(
  sourceModel: string,
  chartType: WidgetType,
  attrs: WidgetQueryAttrs,
  filters: WidgetFilter[],
) {
  return {
    sourceModel,
    chartType,
    ...attrs,
    ...(attrs.stages
      ? { stages: attrs.stages.split(",").map((s) => s.trim()).filter(Boolean) }
      : {}),
    filters: filters.filter((f) => f.field && f.value),
    tenantScoped: true,
  };
}

export function resolvePaletteColors(paletteId?: string): string[] {
  return PALETTE_COLORS[paletteId || "default"] || PALETTE_COLORS.default;
}

export const DEFAULT_STYLE: Record<WidgetType, WidgetStyleConfig> = {
  bar: { orientation: "vertical", showGrid: true, showLegend: false, barRadius: 2, colorPalette: "default" },
  line: { smooth: false, showPoints: true, showGrid: true, lineColor: "#118DFF", colorPalette: "default" },
  pie: { donut: false, showLegend: true, showLabels: true, innerRadiusPct: 0, colorPalette: "default" },
  heatmap: { colorScheme: "blues", showValues: false, showGrid: true },
  funnel: { sort: "desc", gap: 2, showLabels: true, colorPalette: "default" },
  gauge: { min: 0, max: 100, format: "percent", targetColor: "#107C10", showTarget: true },
  card: { format: "number", trend: "neutral", accentColor: "#118DFF" },
  waterfall: { showConnectors: true, positiveColor: "#107C10", negativeColor: "#E81123", colorPalette: "default" },
  scatter: { showGrid: true, pointSize: 8, colorPalette: "blues" },
  treemap: { showLabels: true, colorPalette: "default" },
};
