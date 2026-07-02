"use client";

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
} from "lucide-react";
import { PBI, VISUAL_TYPE_META } from "./power-bi-theme";
import type { BiDataSource, WidgetType } from "@/lib/api/bi-api";
import { DATA_SOURCE_OPTIONS } from "./widget-chart";

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

type VisualizationPaneProps = {
  selectedType: WidgetType;
  selectedSource: BiDataSource;
  widgetTitle: string;
  editingWidgetId: string | null;
  onTypeChange: (t: WidgetType) => void;
  onSourceChange: (s: BiDataSource) => void;
  onTitleChange: (t: string) => void;
  onAddVisual: () => void;
  onUpdateVisual: () => void;
  onCancelEdit: () => void;
  canAdd: boolean;
};

export function VisualizationPane({
  selectedType,
  selectedSource,
  widgetTitle,
  editingWidgetId,
  onTypeChange,
  onSourceChange,
  onTitleChange,
  onAddVisual,
  onUpdateVisual,
  onCancelEdit,
  canAdd,
}: VisualizationPaneProps) {
  const isEditing = !!editingWidgetId;

  return (
    <aside
      className="w-[260px] shrink-0 flex flex-col overflow-hidden"
      style={{ background: PBI.paneBg, borderLeft: `1px solid ${PBI.paneBorder}` }}
    >
      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: PBI.textMuted, borderBottom: `1px solid ${PBI.paneBorder}` }}>
        Visualizations
      </div>

      {isEditing && (
        <div className="px-3 py-2 text-[11px]" style={{ background: "#DEECF9", color: "#005A9E", borderBottom: `1px solid ${PBI.paneBorder}` }}>
          Editing selected visual — change fields below and click Update.
        </div>
      )}

      <div className="p-3 grid grid-cols-3 gap-2">
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

      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: PBI.textMuted, borderTop: `1px solid ${PBI.paneBorder}`, borderBottom: `1px solid ${PBI.paneBorder}` }}>
        Fields
      </div>

      <div className="p-3 space-y-3 flex-1 overflow-y-auto">
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: PBI.textMuted }}>
            Visual title
          </label>
          <input
            value={widgetTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled visual"
            className="w-full text-[13px] px-2 py-1.5 rounded border outline-none focus:border-[#118DFF]"
            style={{ borderColor: PBI.paneBorder, background: "#fff" }}
          />
        </div>
        <div>
          <label className="text-[11px] font-medium block mb-1" style={{ color: PBI.textMuted }}>
            Data source
          </label>
          <select
            value={selectedSource}
            onChange={(e) => onSourceChange(e.target.value as BiDataSource)}
            className="w-full text-[13px] px-2 py-1.5 rounded border outline-none focus:border-[#118DFF]"
            style={{ borderColor: PBI.paneBorder, background: "#fff" }}
          >
            {DATA_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded border p-2" style={{ borderColor: PBI.paneBorder, background: "#fff" }}>
          <p className="text-[10px] uppercase font-semibold mb-2" style={{ color: PBI.textMuted }}>
            Values
          </p>
          <div className="flex flex-wrap gap-1">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#DEECF9] text-[#005A9E]">
              Sum of value
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#EDEBE9] text-[#605E5C]">
              Category
            </span>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-2" style={{ borderTop: `1px solid ${PBI.paneBorder}` }}>
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
