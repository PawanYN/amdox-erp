import type { BiDataSource, WidgetType } from "@/lib/api/bi-api";
import type { GridLayoutConfig } from "@/components/bi/grid-layout-wrapper";

export type BiKpiTotals = {
  invoices: number;
  openArInvoices: number;
  openPurchaseOrders: number;
  activeEmployees: number;
  activeProjects: number;
  reorderRules: number;
};

export type BiArAging = {
  current: number;
  d31_60: number;
  d61_90: number;
  over90: number;
};

export type BiInventorySnapshot = {
  sku: string;
  name: string;
  quantity: number;
};

export type BiKpis = {
  totals: BiKpiTotals;
  arAging: BiArAging;
  inventorySnapshot: BiInventorySnapshot[];
  departments?: string[];
};

export type ReportRunStatus = 'idle' | 'running' | 'done' | 'failed';

export type BiWidgetConfig = {
  title?: string;
  dataSource?: BiDataSource;
  max?: number;
  format?: "number" | "percent" | "currency";
  change?: number;
  trend?: "up" | "down" | "neutral";
};

export type BiWidget = {
  id: string;
  type: WidgetType | string;
  config: BiWidgetConfig;
};

export type BiDashboard = {
  id: string;
  name: string;
  layout?: GridLayoutConfig | null;
  widgets: BiWidget[];
};

export type BiScheduledReport = {
  id: string;
  name: string;
  cronExpr: string;
  format: string;
  recipients: string[];
  lastRunAt?: string;
};

export type BiDrillDownResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export type BiWidgetData = {
  series?: { name: string; value: number; key?: string }[];
  heatmap?: { x: string; y: string; value: number }[];
  meta?: { dataSource?: string };
};

export function computeTotalArOutstanding(aging: BiArAging): number {
  return aging.current + aging.d31_60 + aging.d61_90 + aging.over90;
}
