"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  biApi,
  subscribeBiMetricsStream,
  type BiDataSource,
  type WidgetType,
} from "@/lib/api/bi-api";
import {
  computeTotalArOutstanding,
  type BiDashboard,
  type BiDrillDownResult,
  type BiKpis,
  type BiScheduledReport,
  type BiWidgetData,
} from "@/lib/types/bi";
import { BiWidgetChart } from "@/components/bi/widget-chart";
import { PowerBiVisual, PowerBiKpiCard } from "@/components/bi/power-bi-visual";
import { CardKpi } from "@/components/bi/advanced-charts";
import { VisualizationPane } from "@/components/bi/visualization-pane";
import { SlicerBar, slicersToFilterParams, type SlicerState } from "@/components/bi/slicer-bar";
import { DrillThroughPane } from "@/components/bi/drill-through-pane";
import { PageTabs, ReportsDrawer } from "@/components/bi/power-bi-ribbon";
import {
  GridLayoutWrapper,
  generateLayout,
  type GridLayoutConfig,
} from "@/components/bi/grid-layout-wrapper";
import { Modal, inputClasses } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { DATA_SOURCE_OPTIONS } from "@/components/bi/widget-chart";
import {
  DEFAULT_STYLE,
  type WidgetFilter,
  type WidgetQueryAttrs,
  type WidgetStyleConfig,
} from "@/components/bi/widget-config-schema";
import type { ReportRunStatus } from "@/lib/types/bi";
import {
  RefreshCw,
  Radio,
  Edit3,
  Eye,
  Plus,
  ChevronDown,
  ChevronRight,
  Wallet,
  Users,
  Package,
  FolderKanban,
  Calendar,
  Database,
  AlertCircle,
  X,
  SlidersHorizontal,
  BarChart3,
  Filter,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

const EXECUTIVE_PAGE_ID = "__executive__";
const LAYOUT_SAVE_DEBOUNCE_MS = 400;

/* ─── Fields Pane ─────────────────────────────────── */
const FIELD_TABLES = [
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    fields: [
      { name: "Revenue", type: "measure" },
      { name: "Expenses", type: "measure" },
      { name: "Net Income", type: "measure" },
      { name: "AR Outstanding", type: "measure" },
      { name: "AP Balance", type: "measure" },
      { name: "Cash Position", type: "measure" },
      { name: "Invoice Date", type: "date" },
      { name: "Period", type: "dimension" },
    ],
  },
  {
    id: "hr",
    label: "Human Resources",
    icon: Users,
    fields: [
      { name: "Headcount", type: "measure" },
      { name: "Salary Expense", type: "measure" },
      { name: "Leave Days", type: "measure" },
      { name: "Attendance %", type: "measure" },
      { name: "Department", type: "dimension" },
      { name: "Employee Status", type: "dimension" },
    ],
  },
  {
    id: "scm",
    label: "Supply Chain",
    icon: Package,
    fields: [
      { name: "Open POs", type: "measure" },
      { name: "Inventory Value", type: "measure" },
      { name: "GR Count", type: "measure" },
      { name: "Vendor Count", type: "measure" },
      { name: "SKU", type: "dimension" },
      { name: "Vendor", type: "dimension" },
    ],
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderKanban,
    fields: [
      { name: "Active Projects", type: "measure" },
      { name: "Budget Total", type: "measure" },
      { name: "Actual Cost", type: "measure" },
      { name: "Cost Overrun", type: "measure" },
      { name: "Project Name", type: "dimension" },
      { name: "Status", type: "dimension" },
    ],
  },
  {
    id: "calendar",
    label: "Calendar",
    icon: Calendar,
    fields: [
      { name: "Date", type: "date" },
      { name: "Month", type: "dimension" },
      { name: "Quarter", type: "dimension" },
      { name: "Year", type: "dimension" },
      { name: "Financial Year", type: "dimension" },
    ],
  },
];

function FieldTypeIcon({ type }: { type: string }) {
  if (type === "measure")
    return <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-1 rounded">Σ</span>;
  if (type === "date")
    return <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1 rounded">📅</span>;
  return <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 rounded">Aa</span>;
}

function FieldsPane({ visible }: { visible: boolean }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ finance: true });

  if (!visible) return null;

  return (
    <aside className="w-56 shrink-0 flex flex-col overflow-hidden border-r border-slate-200 bg-white">
      <div className="px-3 py-2.5 border-b border-slate-100 flex items-center gap-2">
        <Database size={13} className="text-slate-400" />
        <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
          Data
        </span>
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar py-1">
        {FIELD_TABLES.map((table) => {
          const Icon = table.icon;
          const isOpen = open[table.id];
          return (
            <div key={table.id}>
              <button
                type="button"
                onClick={() => setOpen((p) => ({ ...p, [table.id]: !p[table.id] }))}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 transition-colors"
              >
                <Icon size={13} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-[12px] font-medium text-slate-700 truncate">
                  {table.label}
                </span>
                {isOpen ? (
                  <ChevronDown size={11} className="text-slate-400" />
                ) : (
                  <ChevronRight size={11} className="text-slate-400" />
                )}
              </button>
              {isOpen && (
                <div className="ml-5 border-l border-slate-100">
                  {table.fields.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center gap-2 px-3 py-1.5 hover:bg-blue-50 cursor-pointer group transition-colors"
                    >
                      <FieldTypeIcon type={f.type} />
                      <span className="text-[11.5px] text-slate-600 group-hover:text-blue-700 truncate">
                        {f.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}

/* ─── KPI Card ─────────────────────────────────────── */
function KpiCard({
  label,
  value,
  sub,
  trend,
  format = "number",
}: {
  label: string;
  value: number | null | undefined;
  sub?: string;
  trend?: "up" | "down" | "neutral";
  format?: "number" | "currency" | "percent";
}) {
  const display =
    value == null
      ? "—"
      : format === "currency"
        ? `$${value >= 1_000_000 ? (value / 1_000_000).toFixed(1) + "M" : value >= 1_000 ? (value / 1_000).toFixed(1) + "K" : value.toLocaleString()}`
        : format === "percent"
          ? `${value.toFixed(1)}%`
          : value.toLocaleString();

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-500" : "text-slate-400";

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-1 hover:shadow-md transition-shadow">
      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider truncate">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-900 tabular-nums">{display}</span>
        {trend && <TrendIcon size={14} className={`mb-0.5 shrink-0 ${trendColor}`} />}
      </div>
      {sub && <span className="text-[11px] text-slate-400">{sub}</span>}
    </div>
  );
}

/* ─── Visual Card ──────────────────────────────────── */
function VisualCard({
  title,
  subtitle,
  children,
  selected,
  editMode,
  onSelect,
  onDelete,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  selected?: boolean;
  editMode?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl border shadow-sm flex flex-col overflow-hidden transition-all ${
        selected ? "border-blue-500 shadow-blue-100 shadow-md" : "border-slate-200 hover:shadow-md"
      } ${editMode ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center justify-between px-4 pt-3 pb-1 shrink-0">
        <div className="min-w-0">
          <p className="text-[12px] font-semibold text-slate-800 truncate">{title}</p>
          {subtitle && <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>}
        </div>
        {editMode && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="h-5 w-5 flex items-center justify-center rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0 ml-2"
          >
            <X size={11} />
          </button>
        )}
      </div>
      <div className="flex-1 min-h-0 p-3 pt-1">{children}</div>
    </div>
  );
}

/* ─── Right Pane ───────────────────────────────────── */
function RightPane({
  editMode,
  activeDashboard,
  selectedWidgetId,
  widgetType,
  widgetSource,
  widgetTitle,
  widgetQueryAttrs,
  widgetFilters,
  widgetStyle,
  slicers,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onQueryAttrChange,
  onFilterChange,
  onStyleChange,
  onAddVisual,
  onUpdateVisual,
  onCancelEdit,
}: {
  editMode: boolean;
  activeDashboard: BiDashboard | null;
  selectedWidgetId: string | null;
  widgetType: WidgetType;
  widgetSource: BiDataSource;
  widgetTitle: string;
  widgetQueryAttrs: WidgetQueryAttrs;
  widgetFilters: WidgetFilter[];
  widgetStyle: WidgetStyleConfig;
  slicers: SlicerState;
  onTypeChange: (t: WidgetType) => void;
  onSourceChange: (s: BiDataSource) => void;
  onTitleChange: (v: string) => void;
  onQueryAttrChange: (k: string, v: string) => void;
  onFilterChange: (f: WidgetFilter[]) => void;
  onStyleChange: (k: string, v: string | number | boolean) => void;
  onAddVisual: () => void;
  onUpdateVisual: () => void;
  onCancelEdit: () => void;
}) {
  const [tab, setTab] = useState<"filters" | "viz">("filters");
  const activeTab = editMode && activeDashboard ? tab : "filters";

  return (
    <aside className="w-64 shrink-0 flex flex-col overflow-hidden border-l border-slate-200 bg-white">
      {/* Tab strip */}
      <div className="flex border-b border-slate-100 shrink-0">
        <TabBtn
          label="Filters"
          icon={<Filter size={12} />}
          active={activeTab === "filters"}
          onClick={() => setTab("filters")}
        />
        {editMode && activeDashboard && (
          <TabBtn
            label="Visualizations"
            icon={<BarChart3 size={12} />}
            active={activeTab === "viz"}
            onClick={() => setTab("viz")}
          />
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === "filters" && (
          <div className="p-3 space-y-3">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
              Report filters
            </p>
            <FilterField
              label="Period"
              value={slicers.period}
              options={["all", "this_month", "last_month", "this_quarter", "ytd"]}
            />
            <FilterField
              label="Status"
              value={slicers.status}
              options={["all", "open", "closed", "pending"]}
            />
            <FilterField
              label="Department"
              value={slicers.department}
              options={["all", "Finance", "HR", "Engineering", "Sales"]}
            />
            <div className="pt-2 border-t border-slate-100">
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Visual filters
              </p>
              <p className="text-[11px] text-slate-400">
                Select a visual on the canvas to apply visual-level filters.
              </p>
            </div>
          </div>
        )}
        {activeTab === "viz" && editMode && activeDashboard && (
          <VisualizationPane
            selectedType={widgetType}
            selectedSource={widgetSource}
            widgetTitle={widgetTitle}
            queryAttrs={widgetQueryAttrs}
            filters={widgetFilters}
            style={widgetStyle}
            editingWidgetId={selectedWidgetId}
            onTypeChange={onTypeChange}
            onSourceChange={onSourceChange}
            onTitleChange={onTitleChange}
            onQueryAttrChange={onQueryAttrChange}
            onFilterChange={onFilterChange}
            onStyleChange={onStyleChange}
            onAddVisual={onAddVisual}
            onUpdateVisual={onUpdateVisual}
            onCancelEdit={onCancelEdit}
            canAdd={true}
          />
        )}
      </div>
    </aside>
  );
}

function TabBtn({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
        active
          ? "border-blue-600 text-blue-700 bg-blue-50/50"
          : "border-transparent text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterField({
  label,
  value,
  options,
}: {
  label: string;
  value: string;
  options: string[];
}) {
  return (
    <div>
      <p className="text-[11px] font-medium text-slate-600 mb-1">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <span
            key={o}
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
              value === o
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-slate-500 border-slate-200"
            }`}
          >
            {o === "all" ? "All" : o}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Toolbar ──────────────────────────────────────── */
function Toolbar({
  editMode,
  live,
  showFields,
  showRightPane,
  onSetEditMode,
  onToggleLive,
  onRefresh,
  onToggleFields,
  onToggleRightPane,
}: {
  editMode: boolean;
  live: boolean;
  showFields: boolean;
  showRightPane: boolean;
  onSetEditMode: (v: boolean) => void;
  onToggleLive: () => void;
  onRefresh: () => void;
  onToggleFields: () => void;
  onToggleRightPane: () => void;
}) {
  return (
    <div className="shrink-0 h-11 bg-white border-b border-slate-200 flex items-center px-4 gap-2">
      {/* Report label */}
      <div className="flex items-center gap-2 mr-3">
        <div className="h-6 w-6 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <BarChart3 size={12} className="text-white" />
        </div>
        <span className="text-[13px] font-semibold text-slate-800">Analytics</span>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200" />

      {/* Mode toggle */}
      <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
        <button
          type="button"
          onClick={() => onSetEditMode(false)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            !editMode ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Eye size={12} /> View
        </button>
        <button
          type="button"
          onClick={() => onSetEditMode(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
            editMode ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <Edit3 size={12} /> Edit
        </button>
      </div>

      {/* Divider */}
      <div className="h-4 w-px bg-slate-200" />

      {/* Actions */}
      <button
        type="button"
        onClick={onRefresh}
        className="h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
      >
        <RefreshCw size={12} /> Refresh
      </button>

      <button
        type="button"
        onClick={onToggleLive}
        className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${
          live
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : "text-slate-500 hover:bg-slate-100"
        }`}
      >
        <Radio size={12} />
        {live ? (
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live
          </span>
        ) : (
          "Live"
        )}
      </button>

      <div className="flex-1" />

      {/* Pane toggles */}
      <button
        type="button"
        onClick={onToggleFields}
        className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${
          showFields
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "text-slate-500 hover:bg-slate-100 border border-transparent"
        }`}
      >
        <Database size={12} /> Data
      </button>
      <button
        type="button"
        onClick={onToggleRightPane}
        className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-medium transition-colors ${
          showRightPane
            ? "bg-blue-50 text-blue-700 border border-blue-200"
            : "text-slate-500 hover:bg-slate-100 border border-transparent"
        }`}
      >
        <SlidersHorizontal size={12} /> Filters
      </button>
    </div>
  );
}

/* ─── Main Workspace ───────────────────────────────── */
export function BiWorkspace() {
  const [editMode, setEditMode] = useState(false);
  const [live, setLive] = useState(true);
  const [showFields, setShowFields] = useState(true);
  const [showRightPane, setShowRightPane] = useState(true);
  const [activePageId, setActivePageId] = useState(EXECUTIVE_PAGE_ID);
  const [kpis, setKpis] = useState<BiKpis | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dashboards, setDashboards] = useState<BiDashboard[]>([]);
  const [widgetDataMap, setWidgetDataMap] = useState<Record<string, BiWidgetData>>({});
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [crossFilterKey, setCrossFilterKey] = useState<string | null>(null);
  const [drillDown, setDrillDown] = useState<BiDrillDownResult | null>(null);
  const [drillTitle, setDrillTitle] = useState("");
  const [slicers, setSlicers] = useState<SlicerState>({
    period: "all",
    status: "all",
    department: "all",
  });
  const [reports, setReports] = useState<BiScheduledReport[]>([]);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [dashModalOpen, setDashModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [newDashName, setNewDashName] = useState("");
  const [widgetTitle, setWidgetTitle] = useState("");
  const [widgetType, setWidgetType] = useState<WidgetType>("bar");
  const [widgetSource, setWidgetSource] = useState<BiDataSource>("ar_aging");
  const [widgetQueryAttrs, setWidgetQueryAttrs] = useState<WidgetQueryAttrs>({});
  const [widgetFilters, setWidgetFilters] = useState<WidgetFilter[]>([]);
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyleConfig>(DEFAULT_STYLE.bar);
  const [reportName, setReportName] = useState("");
  const [reportCron, setReportCron] = useState("weekly");
  const [reportFormat, setReportFormat] = useState<"PDF" | "EXCEL">("PDF");
  const [reportRecipients, setReportRecipients] = useState("");
  const [reportRunStatus, setReportRunStatus] = useState<Record<string, ReportRunStatus>>({});
  const layoutSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterParams = useMemo(() => slicersToFilterParams(slicers), [slicers]);
  const activeDashboard = dashboards.find((d) => d.id === activePageId) || null;
  const isExecutive = activePageId === EXECUTIVE_PAGE_ID;

  const pages = useMemo(
    () => [
      { id: EXECUTIVE_PAGE_ID, name: "Executive Overview", deletable: false },
      ...dashboards.map((d) => ({ id: d.id, name: d.name, deletable: true })),
    ],
    [dashboards],
  );

  const currentLayout = useMemo(() => {
    if (!activeDashboard) return { lg: [], md: [], sm: [] };
    const layout = activeDashboard.layout as GridLayoutConfig | undefined;
    const widgetIds = activeDashboard.widgets.map((w) => w.id);
    return generateLayout(widgetIds, layout);
  }, [activeDashboard]);

  const loadKpis = useCallback(() => {
    biApi
      .getKpis(filterParams)
      .then((data) => {
        setKpis(data);
        setLoadError(null);
      })
      .catch((err) => {
        console.error(err);
        setLoadError("Could not load analytics data. Check API connection.");
      });
  }, [filterParams]);

  const loadDashboards = useCallback(() => {
    biApi.getDashboards().then(setDashboards).catch(console.error);
  }, []);

  const loadReports = useCallback(() => {
    biApi.getReports().then(setReports).catch(console.error);
  }, []);

  useEffect(() => {
    loadKpis();
    loadDashboards();
    loadReports();
  }, [loadKpis, loadDashboards, loadReports]);

  useEffect(() => {
    if (!live) return;
    let unsub: (() => void) | undefined;
    subscribeBiMetricsStream(
      (data) => setKpis(data as BiKpis),
      (err) => console.warn("SSE metrics stream:", err.message),
      filterParams,
    ).then((fn) => {
      unsub = fn;
    });
    return () => unsub?.();
  }, [live, filterParams]);

  useEffect(() => {
    if (!selectedWidgetId || !activeDashboard) return;
    const widget = activeDashboard.widgets.find((w) => w.id === selectedWidgetId);
    if (!widget) return;
    loadWidgetDraft(widget);
  }, [selectedWidgetId, activeDashboard]);

  function resetWidgetDraft(type: WidgetType = "bar") {
    setWidgetTitle("");
    setWidgetType(type);
    setWidgetSource("ar_aging");
    setWidgetQueryAttrs({});
    setWidgetFilters([]);
    setWidgetStyle(DEFAULT_STYLE[type] || {});
  }

  function buildWidgetConfig(): Record<string, unknown> {
    return {
      title: widgetTitle || widgetSource,
      dataSource: widgetSource,
      queryAttrs: widgetQueryAttrs,
      filters: widgetFilters.filter((f) => f.field && f.value),
      style: widgetStyle,
      ...(widgetStyle.format ? { format: widgetStyle.format } : {}),
      ...(widgetStyle.max !== undefined ? { max: widgetStyle.max } : {}),
      ...(widgetStyle.trend ? { trend: widgetStyle.trend } : {}),
    };
  }

  function loadWidgetDraft(widget: BiDashboard["widgets"][number]) {
    const type = widget.type as WidgetType;
    setWidgetTitle(widget.config?.title || "");
    setWidgetType(widget.type as WidgetType);
    setWidgetSource((widget.config?.dataSource || "ar_aging") as BiDataSource);
    setWidgetQueryAttrs(widget.config?.queryAttrs || {});
    setWidgetFilters(widget.config?.filters || []);
    setWidgetStyle({ ...(DEFAULT_STYLE[type] || {}), ...(widget.config?.style || {}) });
  }

  useEffect(() => {
    if (!activeDashboard?.widgets.length) return;
    let cancelled = false;
    (async () => {
      for (const w of activeDashboard.widgets) {
        try {
          const data = await biApi.getWidgetData(w.id, filterParams);
          if (!cancelled) setWidgetDataMap((prev) => ({ ...prev, [w.id]: data }));
        } catch {
          /* widget data optional */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeDashboard, filterParams]);

  async function handleCrossFilter(source: BiDataSource, key: string, name: string) {
    setCrossFilterKey(key);
    try {
      const result = await biApi.drillDown(source, key, name);
      setDrillDown(result);
      setDrillTitle(name);
    } catch {
      /* drill optional */
    }
  }

  async function createDashboard() {
    if (!newDashName.trim()) return;
    const created = await biApi.createDashboard(newDashName.trim());
    setNewDashName("");
    setDashModalOpen(false);
    await loadDashboards();
    setActivePageId(created.id);
    setEditMode(true);
  }

  async function deletePage(id: string) {
    const page = dashboards.find((d) => d.id === id);
    if (!page || !confirm(`Delete report page "${page.name}"?`)) return;
    await biApi.deleteDashboard(id);
    setDashboards((prev) => prev.filter((d) => d.id !== id));
    if (activePageId === id) {
      setActivePageId(EXECUTIVE_PAGE_ID);
      setSelectedWidgetId(null);
      resetWidgetDraft();
      setDrillDown(null);
      setCrossFilterKey(null);
    }
  }

  async function addWidget() {
    if (!activeDashboard) return;
    await biApi.addWidget(activeDashboard.id, widgetType, buildWidgetConfig());
    resetWidgetDraft(widgetType);
    const updated = await biApi.getDashboard(activeDashboard.id);
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  async function updateSelectedWidget() {
    if (!selectedWidgetId || !activeDashboard) return;
    await biApi.updateWidget(selectedWidgetId, { type: widgetType, config: buildWidgetConfig() });
    const updated = await biApi.getDashboard(activeDashboard.id);
    setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    const data = await biApi.getWidgetData(selectedWidgetId, filterParams);
    setWidgetDataMap((prev) => ({ ...prev, [selectedWidgetId]: data }));
    setSelectedWidgetId(null);
    resetWidgetDraft();
  }

  function cancelWidgetEdit() {
    setSelectedWidgetId(null);
    resetWidgetDraft();
  }

  function handleTypeChange(type: WidgetType) {
    setWidgetType(type);
    setWidgetQueryAttrs({});
    setWidgetStyle(DEFAULT_STYLE[type] || {});
  }

  function handleSourceChange(source: BiDataSource) {
    setWidgetSource(source);
    const match = DATA_SOURCE_OPTIONS.find((o) => o.value === source);
    if (match) handleTypeChange(match.defaultType);
  }

  function handleQueryAttrChange(key: string, val: string) {
    setWidgetQueryAttrs((a) => ({ ...a, [key]: val }));
  }

  function handleStyleChange(key: string, val: string | number | boolean) {
    setWidgetStyle((s) => ({ ...s, [key]: val }));
  }

  async function deleteWidget(id: string) {
    if (!confirm("Remove this visual from the report page?")) return;
    await biApi.deleteWidget(id);
    if (activeDashboard) {
      const updated = await biApi.getDashboard(activeDashboard.id);
      setDashboards((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
    }
  }

  const handleLayoutChange = useCallback(
    (layout: GridLayoutConfig) => {
      if (!activeDashboard || !editMode) return;
      setDashboards((prev) =>
        prev.map((d) => (d.id === activeDashboard.id ? { ...d, layout } : d)),
      );
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
      layoutSaveTimer.current = setTimeout(async () => {
        try {
          await biApi.updateDashboard(activeDashboard.id, { layout });
        } catch {
          /* ignore */
        }
      }, LAYOUT_SAVE_DEBOUNCE_MS);
    },
    [activeDashboard, editMode],
  );

  useEffect(
    () => () => {
      if (layoutSaveTimer.current) clearTimeout(layoutSaveTimer.current);
    },
    [],
  );

  async function createReport() {
    const recipients = reportRecipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (!reportName.trim() || !recipients.length) return;
    await biApi.createReport({
      name: reportName.trim(),
      cronExpr: reportCron,
      format: reportFormat,
      recipients,
      dashboardId: activeDashboard?.id,
    });
    setReportModalOpen(false);
    setReportName("");
    setReportRecipients("");
    loadReports();
  }

  const totalArOutstanding = kpis ? computeTotalArOutstanding(kpis.arAging) : 0;
  const collectionHealthPct =
    totalArOutstanding > 0 ? (kpis!.arAging.current / totalArOutstanding) * 100 : 0;

  const agingData = kpis
    ? [
        { name: "Current", value: kpis.arAging.current, key: "Current" },
        { name: "31–60 days", value: kpis.arAging.d31_60, key: "31-60" },
        { name: "61–90 days", value: kpis.arAging.d61_90, key: "61-90" },
        { name: "90+ days", value: kpis.arAging.over90, key: "90+" },
      ]
    : [];

  const inventoryData =
    kpis?.inventorySnapshot?.slice(0, 8).map((s) => ({
      name: s.sku,
      value: s.quantity,
      key: s.sku,
    })) || [];

  /* ─── Layout: -m-6 escapes the parent p-6 padding so BI fills edge-to-edge ─── */
  return (
    <div className="-m-6 flex flex-col overflow-hidden" style={{ height: "calc(100vh - 56px)" }}>
      {/* TOP TOOLBAR — fixed, never scrolls */}
      <Toolbar
        editMode={editMode}
        live={live}
        showFields={showFields}
        showRightPane={showRightPane}
        onSetEditMode={setEditMode}
        onToggleLive={() => setLive((v) => !v)}
        onRefresh={loadKpis}
        onToggleFields={() => setShowFields((v) => !v)}
        onToggleRightPane={() => setShowRightPane((v) => !v)}
      />

      {/* SLICER BAR — fixed, never scrolls */}
      <div className="shrink-0">
        <SlicerBar slicers={slicers} onChange={setSlicers} departmentOptions={kpis?.departments} />
      </div>

      {/* ERROR BANNER */}
      {loadError && (
        <div className="shrink-0 mx-4 mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-[12px]">
          <AlertCircle size={14} className="shrink-0" />
          {loadError}
        </div>
      )}

      {/* MAIN BODY — left panel + canvas + right panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT: DATA FIELDS PANE */}
        <FieldsPane visible={showFields} />

        {/* CENTER: CANVAS — ONLY THIS SCROLLS */}
        <div className="flex-1 flex flex-col overflow-hidden bg-slate-50">
          <div
            className="flex-1 overflow-y-auto custom-scrollbar p-5"
            style={{
              backgroundImage: editMode
                ? "radial-gradient(#CBD5E1 1px, transparent 1px)"
                : undefined,
              backgroundSize: editMode ? "20px 20px" : undefined,
            }}
          >
            {/* Loading state */}
            {!kpis && isExecutive && (
              <div className="flex items-center justify-center py-20 text-slate-400 text-[13px] gap-2">
                <RefreshCw size={14} className="animate-spin" /> Loading analytics data…
              </div>
            )}

            {/* EXECUTIVE OVERVIEW */}
            {isExecutive && kpis && (
              <div className="space-y-5 animate-fade-in-up">
                {/* Page header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-[16px] font-semibold text-slate-900">Executive Overview</h1>
                    <p className="text-[12px] text-slate-500 mt-0.5">
                      Live cross-module analytics · Updated just now
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live feed active
                  </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                  <KpiCard
                    label="AR Outstanding"
                    value={totalArOutstanding}
                    format="currency"
                    trend="down"
                    sub="Total unpaid receivables"
                  />
                  <KpiCard
                    label="Active Employees"
                    value={kpis.totals.activeEmployees}
                    trend="up"
                    sub="Live from HR module"
                  />
                  <KpiCard
                    label="Open Purchase Orders"
                    value={kpis.totals.openPurchaseOrders}
                    trend="neutral"
                    sub="Pending fulfilment"
                  />
                  <KpiCard
                    label="Active Projects"
                    value={kpis.totals.activeProjects}
                    trend="up"
                    sub="Across all departments"
                  />
                </div>

                {/* Chart row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <VisualCard title="AR Aging Breakdown" subtitle="Click segment to drill down">
                    <div style={{ height: 260 }}>
                      <BiWidgetChart
                        type="pie"
                        series={agingData}
                        activeKey={crossFilterKey}
                        onSegmentClick={(key, name) => handleCrossFilter("ar_aging", key, name)}
                      />
                    </div>
                  </VisualCard>

                  <VisualCard title="Inventory by SKU" subtitle="Top 8 by quantity on hand">
                    <div style={{ height: 260 }}>
                      <BiWidgetChart
                        type="bar"
                        series={inventoryData}
                        activeKey={crossFilterKey}
                        onSegmentClick={(key, name) => handleCrossFilter("inventory", key, name)}
                      />
                    </div>
                  </VisualCard>

                  <VisualCard title="Collection Health" subtitle="Current bucket as % of total AR">
                    <div style={{ height: 220 }}>
                      <BiWidgetChart
                        type="gauge"
                        series={[
                          {
                            name: "Collection health",
                            value: Math.round(collectionHealthPct),
                            key: "health",
                          },
                        ]}
                        config={{ max: 100, format: "percent", title: "Current AR %" }}
                      />
                    </div>
                  </VisualCard>

                  <VisualCard title="Open AR Invoices" subtitle="Count of outstanding invoices">
                    <div className="flex items-center justify-center h-[220px]">
                      <div className="text-center">
                        <p className="text-5xl font-bold text-slate-900 tabular-nums">
                          {kpis.totals.openArInvoices ?? kpis.totals.invoices}
                        </p>
                        <p className="text-[12px] text-slate-500 mt-2">invoices pending</p>
                        <div className="mt-3 inline-flex items-center gap-1 text-[11px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          Requires attention
                        </div>
                      </div>
                    </div>
                  </VisualCard>
                </div>
              </div>
            )}

            {/* CUSTOM DASHBOARD PAGES */}
            {!isExecutive && activeDashboard && activeDashboard.widgets.length > 0 && (
              <GridLayoutWrapper
                layout={currentLayout}
                editMode={editMode}
                onLayoutChange={handleLayoutChange}
              >
                {activeDashboard.widgets.map((w) => {
                  const data = widgetDataMap[w.id];
                  const source = (w.config?.dataSource || "ar_aging") as BiDataSource;
                  return (
                    <div key={w.id} className="h-full">
                      <VisualCard
                        title={w.config?.title || w.type}
                        subtitle={source.replace(/_/g, " ")}
                        editMode={editMode}
                        selected={selectedWidgetId === w.id}
                        onSelect={() => setSelectedWidgetId(w.id)}
                        onDelete={editMode ? () => deleteWidget(w.id) : undefined}
                      >
                        <BiWidgetChart
                          type={w.type as WidgetType}
                          series={data?.series}
                          heatmap={data?.heatmap}
                          activeKey={crossFilterKey}
                          onSegmentClick={(key, name) => handleCrossFilter(source, key, name)}
                          config={w.config}
                        />
                      </VisualCard>
                    </div>
                  );
                })}
              </GridLayoutWrapper>
            )}

            {/* Empty page state */}
            {!isExecutive && activeDashboard && activeDashboard.widgets.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center">
                  <BarChart3 size={28} className="text-slate-400" />
                </div>
                <div className="text-center">
                  <p className="text-[14px] font-semibold text-slate-700">This page is empty</p>
                  <p className="text-[12px] text-slate-400 mt-1">
                    Switch to <strong>Edit</strong> mode and use the Visualizations pane to add
                    charts.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-[12px] font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus size={13} /> Add a visual
                </button>
              </div>
            )}

            {/* No page selected */}
            {!isExecutive && !activeDashboard && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 text-[13px] gap-2">
                Select a report page or create a new one.
              </div>
            )}
          </div>

          {/* DRILL THROUGH — inside canvas column, above page tabs */}
          <DrillThroughPane
            title={drillTitle}
            data={drillDown}
            onClose={() => {
              setDrillDown(null);
              setCrossFilterKey(null);
            }}
          />
        </div>

        {/* RIGHT: FILTERS / VIZ PANE */}
        {showRightPane && (
          <RightPane
            editMode={editMode}
            activeDashboard={activeDashboard}
            selectedWidgetId={selectedWidgetId}
            widgetType={widgetType}
            widgetSource={widgetSource}
            widgetTitle={widgetTitle}
            widgetQueryAttrs={widgetQueryAttrs}
            widgetFilters={widgetFilters}
            widgetStyle={widgetStyle}
            slicers={slicers}
            onTypeChange={handleTypeChange}
            onSourceChange={handleSourceChange}
            onTitleChange={setWidgetTitle}
            onQueryAttrChange={handleQueryAttrChange}
            onFilterChange={setWidgetFilters}
            onStyleChange={handleStyleChange}
            onAddVisual={addWidget}
            onUpdateVisual={updateSelectedWidget}
            onCancelEdit={cancelWidgetEdit}
          />
        )}
      </div>

      {/* BOTTOM PAGE TABS — fixed, never scrolls */}
      <PageTabs
        pages={pages}
        activeId={activePageId}
        onSelect={(id) => {
          setActivePageId(id);
          setDrillDown(null);
          setCrossFilterKey(null);
        }}
        onAdd={() => setDashModalOpen(true)}
        onDelete={deletePage}
      />

      {/* SUBSCRIPTIONS DRAWER */}
      <ReportsDrawer
        open={reportsOpen}
        reports={reports}
        runStatus={reportRunStatus}
        onClose={() => setReportsOpen(false)}
        onCreate={() => {
          setReportsOpen(false);
          setReportModalOpen(true);
        }}
        onRun={async (id) => {
          setReportRunStatus((prev) => ({ ...prev, [id]: "running" }));
          try {
            await biApi.runReport(id);
            setReportRunStatus((prev) => ({ ...prev, [id]: "done" }));
            loadReports();
          } catch {
            setReportRunStatus((prev) => ({ ...prev, [id]: "failed" }));
          }
        }}
        onDownload={async (id, name, format) => {
          const blob = await biApi.downloadReport(id);
          const ext = format === "EXCEL" ? "csv" : "pdf";
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.${ext}`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onDelete={async (id) => {
          await biApi.deleteReport(id);
          loadReports();
        }}
      />

      {/* NEW PAGE MODAL */}
      <Modal open={dashModalOpen} onClose={() => setDashModalOpen(false)} title="New report page">
        <p className="text-[13px] text-slate-500 mb-3">
          Create a new canvas page for your visuals.
        </p>
        <input
          className={inputClasses}
          placeholder="Page name"
          value={newDashName}
          onChange={(e) => setNewDashName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createDashboard()}
        />
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setDashModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={createDashboard}>Create page</Button>
        </div>
      </Modal>

      {/* NEW SUBSCRIPTION MODAL */}
      <Modal
        open={reportModalOpen}
        onClose={() => setReportModalOpen(false)}
        title="New subscription"
      >
        <div className="space-y-3">
          <input
            className={inputClasses}
            placeholder="Subscription name"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
          />
          <select
            className={inputClasses}
            value={reportCron}
            onChange={(e) => setReportCron(e.target.value)}
          >
            <option value="daily">Daily at 8 AM</option>
            <option value="weekly">Weekly (Monday 8 AM)</option>
            <option value="monthly">Monthly (1st, 8 AM)</option>
          </select>
          <select
            className={inputClasses}
            value={reportFormat}
            onChange={(e) => setReportFormat(e.target.value as "PDF" | "EXCEL")}
          >
            <option value="PDF">PDF</option>
            <option value="EXCEL">Excel (CSV)</option>
          </select>
          <input
            className={inputClasses}
            placeholder="Recipient emails (comma-separated)"
            value={reportRecipients}
            onChange={(e) => setReportRecipients(e.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => setReportModalOpen(false)}>
            Cancel
          </Button>
          <Button onClick={createReport}>Create subscription</Button>
        </div>
      </Modal>
    </div>
  );
}
