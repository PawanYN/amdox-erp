"use client";

import { useMemo, useState } from "react";
import {
  BarChart3,
  Filter,
  Grid3x3,
  LineChart,
  PieChart,
  Gauge,
  Square,
  TrendingUp,
  ScatterChart,
  LayoutGrid,
  Plus,
  X,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PBI, VISUAL_TYPE_META } from "./power-bi-theme";
import type { BiDataSource, WidgetType } from "@/lib/api/bi-api";
import { DATA_SOURCE_OPTIONS } from "./widget-chart";
import {
  AGGREGATIONS,
  COLOR_PALETTES,
  DATA_FIELD_LABELS,
  HEAT_COLOR_SCHEMES,
  INTERVALS,
  OPERATORS,
  STYLE_FIELD_LABELS,
  buildQuerySpec,
  getDataFields,
  getMissingRequiredFields,
  getRequiredDataFields,
  getStyleFields,
  type WidgetFilter,
  type WidgetQueryAttrs,
  type WidgetStyleConfig,
} from "./widget-config-schema";

const ICONS: Record<string, React.ReactNode> = {
  BarChart3: <BarChart3 size={22} strokeWidth={1.5} />,
  LineChart: <LineChart size={22} strokeWidth={1.5} />,
  PieChart: <PieChart size={22} strokeWidth={1.5} />,
  Filter: <Filter size={22} strokeWidth={1.5} />,
  Grid3x3: <Grid3x3 size={22} strokeWidth={1.5} />,
  Gauge: <Gauge size={22} strokeWidth={1.5} />,
  Square: <Square size={22} strokeWidth={1.5} />,
  TrendingUp: <TrendingUp size={22} strokeWidth={1.5} />,
  ScatterChart: <ScatterChart size={22} strokeWidth={1.5} />,
  LayoutGrid: <LayoutGrid size={22} strokeWidth={1.5} />,
};

const inputClass =
  "w-full text-[12px] px-2 py-1.5 rounded border outline-none focus:border-[#118DFF]";
const inputStyle = { borderColor: PBI.paneBorder, background: "#fff" } as const;

type VisualizationPaneProps = {
  selectedType: WidgetType;
  selectedSource: BiDataSource;
  widgetTitle: string;
  queryAttrs: WidgetQueryAttrs;
  filters: WidgetFilter[];
  style: WidgetStyleConfig;
  editingWidgetId: string | null;
  onTypeChange: (t: WidgetType) => void;
  onSourceChange: (s: BiDataSource) => void;
  onTitleChange: (t: string) => void;
  onQueryAttrChange: (key: string, val: string) => void;
  onFilterChange: (filters: WidgetFilter[]) => void;
  onStyleChange: (key: string, val: string | number | boolean) => void;
  onAddVisual: () => void;
  onUpdateVisual: () => void;
  onCancelEdit: () => void;
  canAdd: boolean;
};

function renderDataField(
  key: string,
  value: string | undefined,
  onChange: (key: string, val: string) => void,
) {
  if (key === "aggregation") {
    return (
      <select
        value={value || ""}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="">Select…</option>
        {AGGREGATIONS.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    );
  }
  if (key === "interval") {
    return (
      <select
        value={value || ""}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="">Select…</option>
        {INTERVALS.map((i) => (
          <option key={i} value={i}>
            {i}
          </option>
        ))}
      </select>
    );
  }
  if (key === "maxSlices") {
    return (
      <input
        type="number"
        min={2}
        max={12}
        value={value || ""}
        placeholder="e.g. 6"
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      />
    );
  }
  return (
    <input
      type="text"
      value={value || ""}
      placeholder={
        key === "stages"
          ? "requisitioned, approved, ordered, received"
          : "Field name"
      }
      onChange={(e) => onChange(key, e.target.value)}
      className={inputClass}
      style={inputStyle}
    />
  );
}

function renderStyleField(
  key: string,
  style: WidgetStyleConfig,
  onChange: (key: string, val: string | number | boolean) => void,
) {
  const val = style[key as keyof WidgetStyleConfig];

  if (key === "colorPalette") {
    return (
      <select
        value={(val as string) || "default"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        {COLOR_PALETTES.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    );
  }
  if (key === "colorScheme") {
    return (
      <select
        value={(val as string) || "blues"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        {HEAT_COLOR_SCHEMES.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
    );
  }
  if (key === "orientation") {
    return (
      <select
        value={(val as string) || "vertical"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option>
      </select>
    );
  }
  if (key === "sort") {
    return (
      <select
        value={(val as string) || "desc"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="desc">Descending</option>
        <option value="asc">Ascending</option>
        <option value="none">Data order</option>
      </select>
    );
  }
  if (key === "format") {
    return (
      <select
        value={(val as string) || "number"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="number">Number</option>
        <option value="percent">Percent</option>
        <option value="currency">Currency</option>
      </select>
    );
  }
  if (key === "trend") {
    return (
      <select
        value={(val as string) || "neutral"}
        onChange={(e) => onChange(key, e.target.value)}
        className={inputClass}
        style={inputStyle}
      >
        <option value="up">Up</option>
        <option value="down">Down</option>
        <option value="neutral">Neutral</option>
      </select>
    );
  }
  if (
    key.startsWith("show") ||
    key === "donut" ||
    key === "smooth"
  ) {
    return (
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!val}
          onChange={(e) => onChange(key, e.target.checked)}
          className="rounded border-slate-300"
        />
        <span className="text-[11px]" style={{ color: PBI.textMuted }}>
          {val ? "On" : "Off"}
        </span>
      </label>
    );
  }
  if (
    key === "barRadius" ||
    key === "gap" ||
    key === "innerRadiusPct" ||
    key === "pointSize" ||
    key === "min" ||
    key === "max"
  ) {
    return (
      <input
        type="number"
        value={val !== undefined ? String(val) : ""}
        onChange={(e) => onChange(key, Number(e.target.value))}
        className={inputClass}
        style={inputStyle}
      />
    );
  }
  if (
    key === "lineColor" ||
    key === "targetColor" ||
    key === "accentColor" ||
    key === "positiveColor" ||
    key === "negativeColor"
  ) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={(val as string) || "#118DFF"}
          onChange={(e) => onChange(key, e.target.value)}
          className="h-8 w-10 rounded border cursor-pointer"
          style={{ borderColor: PBI.paneBorder }}
        />
        <input
          type="text"
          value={(val as string) || ""}
          onChange={(e) => onChange(key, e.target.value)}
          className={`${inputClass} flex-1`}
          style={inputStyle}
        />
      </div>
    );
  }
  return null;
}

export function VisualizationPane({
  selectedType,
  selectedSource,
  widgetTitle,
  queryAttrs,
  filters,
  style,
  editingWidgetId,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onQueryAttrChange,
  onFilterChange,
  onStyleChange,
  onAddVisual,
  onUpdateVisual,
  onCancelEdit,
  canAdd,
}: VisualizationPaneProps) {
  const isEditing = !!editingWidgetId;
  const [showQueryPreview, setShowQueryPreview] = useState(false);
  const [dataOpen, setDataOpen] = useState(true);
  const [styleOpen, setStyleOpen] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const dataFields = getDataFields(selectedType);
  const styleFields = getStyleFields(selectedType);
  const requiredFields = getRequiredDataFields(selectedType);
  const missing = getMissingRequiredFields(selectedType, queryAttrs);
  const missingLabels = missing.map((f) => DATA_FIELD_LABELS[f] || f);

  const querySpec = useMemo(
    () => buildQuerySpec(selectedSource, selectedType, queryAttrs, filters),
    [selectedSource, selectedType, queryAttrs, filters],
  );

  const addFilter = () =>
    onFilterChange([...filters, { field: "", op: "=", value: "" }]);
  const updateFilter = (i: number, key: keyof WidgetFilter, val: string) =>
    onFilterChange(filters.map((row, idx) => (idx === i ? { ...row, [key]: val } : row)));
  const removeFilter = (i: number) =>
    onFilterChange(filters.filter((_, idx) => idx !== i));

  return (
    <aside
      className="w-[300px] shrink-0 flex flex-col overflow-hidden"
      style={{ background: PBI.paneBg, borderLeft: `1px solid ${PBI.paneBorder}` }}
    >
      <div
        className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: PBI.textMuted, borderBottom: `1px solid ${PBI.paneBorder}` }}
      >
        Visualizations
      </div>

      {isEditing && (
        <div
          className="px-3 py-2 text-[11px]"
          style={{ background: "#DEECF9", color: "#005A9E", borderBottom: `1px solid ${PBI.paneBorder}` }}
        >
          Editing selected visual — configure fields below and click Update.
        </div>
      )}

      <div className="p-3 grid grid-cols-3 gap-2 shrink-0">
        {VISUAL_TYPE_META.map((v) => (
          <button
            key={v.type}
            type="button"
            title={v.label}
            onClick={() => onTypeChange(v.type)}
            className={`flex flex-col items-center justify-center gap-1 p-2 rounded border transition-all ${
              selectedType === v.type
                ? "border-[#118DFF] bg-[#DEECF9] text-[#005A9E]"
                : "border-transparent hover:bg-[#EDEBE9] text-[#323130]"
            }`}
          >
            {ICONS[v.icon]}
            <span className="text-[9px] leading-tight text-center">{v.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* General */}
        <div className="px-3 pb-3 space-y-3">
          <div>
            <label className="text-[11px] font-medium block mb-1" style={{ color: PBI.textMuted }}>
              Visual title
            </label>
            <input
              value={widgetTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Untitled visual"
              className={inputClass}
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium block mb-1" style={{ color: PBI.textMuted }}>
              Source (read model)
            </label>
            <select
              value={selectedSource}
              onChange={(e) => onSourceChange(e.target.value as BiDataSource)}
              className={inputClass}
              style={inputStyle}
            >
              {DATA_SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-[10px] mt-1" style={{ color: PBI.textMuted }}>
              Query Guard blocks anything outside approved read models.
            </p>
          </div>
        </div>

        {/* Data fields — changes per chart type */}
        <SectionHeader
          title="Data fields"
          subtitle={VISUAL_TYPE_META.find((v) => v.type === selectedType)?.label}
          open={dataOpen}
          onToggle={() => setDataOpen((v) => !v)}
        />
        {dataOpen && (
          <div className="px-3 pb-3 grid grid-cols-1 gap-2.5">
            {dataFields.map((key) => (
              <div key={key}>
                <label className="text-[11px] font-medium block mb-1 flex items-center gap-1" style={{ color: PBI.textMuted }}>
                  {DATA_FIELD_LABELS[key] || key}
                  {requiredFields.includes(key) && <span className="text-red-500">*</span>}
                </label>
                {renderDataField(key, queryAttrs[key], onQueryAttrChange)}
              </div>
            ))}
            {missingLabels.length > 0 && (
              <p className="text-[10px] text-amber-600">
                Recommended: {missingLabels.join(", ")}
              </p>
            )}
          </div>
        )}

        {/* Format & style — chart-specific */}
        <SectionHeader
          title="Format & style"
          subtitle="Colors, labels, layout"
          open={styleOpen}
          onToggle={() => setStyleOpen((v) => !v)}
        />
        {styleOpen && (
          <div className="px-3 pb-3 grid grid-cols-1 gap-2.5">
            {styleFields.map((key) => (
              <div key={key}>
                <label className="text-[11px] font-medium block mb-1" style={{ color: PBI.textMuted }}>
                  {STYLE_FIELD_LABELS[key] || key}
                </label>
                {renderStyleField(key, style, onStyleChange)}
              </div>
            ))}
          </div>
        )}

        {/* Filters */}
        <SectionHeader
          title="Filters"
          subtitle={`${filters.filter((f) => f.field && f.value).length} active`}
          open={filtersOpen}
          onToggle={() => setFiltersOpen((v) => !v)}
        />
        {filtersOpen && (
          <div className="px-3 pb-3 space-y-1.5">
            {filters.map((f, i) => (
              <div key={i} className="flex items-center gap-1">
                <input
                  value={f.field}
                  placeholder="field"
                  onChange={(e) => updateFilter(i, "field", e.target.value)}
                  className="flex-1 text-[11px] px-1.5 py-1 rounded border"
                  style={inputStyle}
                />
                <select
                  value={f.op}
                  onChange={(e) => updateFilter(i, "op", e.target.value)}
                  className="text-[11px] px-1 py-1 rounded border"
                  style={inputStyle}
                >
                  {OPERATORS.map((op) => (
                    <option key={op} value={op}>
                      {op}
                    </option>
                  ))}
                </select>
                <input
                  value={f.value}
                  placeholder="value"
                  onChange={(e) => updateFilter(i, "value", e.target.value)}
                  className="flex-1 text-[11px] px-1.5 py-1 rounded border"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => removeFilter(i)}
                  className="text-slate-400 hover:text-red-500 p-0.5"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addFilter}
              className="flex items-center gap-1 text-[11px] text-[#005A9E] hover:text-[#118DFF]"
            >
              <Plus size={12} /> Add filter
            </button>
          </div>
        )}

        {/* Query spec preview */}
        <button
          type="button"
          onClick={() => setShowQueryPreview((v) => !v)}
          className="w-full px-3 py-2 flex items-center gap-1 text-[11px] font-medium"
          style={{ color: PBI.textMuted, borderTop: `1px solid ${PBI.paneBorder}` }}
        >
          {showQueryPreview ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          querySpec preview
        </button>
        {showQueryPreview && (
          <pre
            className="mx-3 mb-3 p-2 rounded text-[10px] leading-relaxed overflow-auto max-h-40"
            style={{ background: "#252423", color: "#6EE7B7" }}
          >
            {JSON.stringify(querySpec, null, 2)}
          </pre>
        )}
      </div>

      <div className="p-3 space-y-2 shrink-0" style={{ borderTop: `1px solid ${PBI.paneBorder}` }}>
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={onUpdateVisual}
              className="w-full py-2 text-[13px] font-semibold rounded text-white transition-colors hover:opacity-90"
              style={{ background: PBI.accent }}
            >
              Update visual
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="w-full py-2 text-[13px] font-medium rounded border"
              style={{ borderColor: PBI.paneBorder, color: PBI.text }}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled={!canAdd}
            onClick={onAddVisual}
            className="w-full py-2 text-[13px] font-semibold rounded disabled:opacity-40 text-white transition-colors hover:opacity-90"
            style={{ background: PBI.accent }}
          >
            Add to report
          </button>
        )}
      </div>
    </aside>
  );
}

function SectionHeader({
  title,
  subtitle,
  open,
  onToggle,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full px-3 py-2 flex items-center justify-between text-left"
      style={{ borderTop: `1px solid ${PBI.paneBorder}`, background: "#fff" }}
    >
      <div className="flex items-center gap-1.5">
        {open ? <ChevronDown size={14} style={{ color: PBI.textMuted }} /> : <ChevronRight size={14} style={{ color: PBI.textMuted }} />}
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PBI.textMuted }}>
          {title}
        </span>
      </div>
      {subtitle && (
        <span className="text-[10px] truncate max-w-[120px]" style={{ color: PBI.textMuted }}>
          {subtitle}
        </span>
      )}
    </button>
  );
}
