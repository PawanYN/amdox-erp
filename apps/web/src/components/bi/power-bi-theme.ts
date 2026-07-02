/** Power BI–inspired design tokens */
export const PBI = {
  ribbon: "#252423",
  ribbonHover: "#323130",
  canvas: "#F3F2F1",
  canvasGrid: "#E1DFDD",
  visualBg: "#FFFFFF",
  visualBorder: "#EDEBE9",
  visualSelected: "#F2C811",
  accent: "#118DFF",
  accentDark: "#005A9E",
  text: "#252423",
  textMuted: "#605E5C",
  tabActive: "#FFFFFF",
  tabBar: "#EDEBE9",
  paneBg: "#FAFAFA",
  paneBorder: "#EDEBE9",
  slicerBg: "#FFFFFF",
  success: "#107C10",
} as const;

/** Default Power BI chart palette */
export const PBI_CHART_COLORS = [
  "#118DFF",
  "#12239E",
  "#E66C37",
  "#6B007B",
  "#E044A7",
  "#744EC2",
  "#D9B300",
  "#009988",
  "#E81123",
  "#737373",
];

export const VISUAL_TYPE_META = [
  { type: "bar" as const, label: "Clustered bar", icon: "BarChart3" },
  { type: "line" as const, label: "Line chart", icon: "LineChart" },
  { type: "pie" as const, label: "Pie chart", icon: "PieChart" },
  { type: "funnel" as const, label: "Funnel", icon: "Filter" },
  { type: "heatmap" as const, label: "Matrix / heatmap", icon: "Grid3x3" },
  { type: "gauge" as const, label: "Gauge", icon: "Gauge" },
  { type: "card" as const, label: "Card", icon: "Square" },
  { type: "waterfall" as const, label: "Waterfall", icon: "TrendingUp" },
  { type: "scatter" as const, label: "Scatter", icon: "ScatterChart" },
  { type: "treemap" as const, label: "Treemap", icon: "LayoutGrid" },
];
