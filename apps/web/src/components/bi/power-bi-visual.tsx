"use client";

import { Filter, GripVertical, MoreHorizontal, Trash2 } from "lucide-react";
import { PBI } from "./power-bi-theme";

type PowerBiVisualProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  editMode?: boolean;
  selected?: boolean;
  onSelect?: () => void;
  onDelete?: () => void;
  className?: string;
  span?: "sm" | "md" | "lg" | "full";
  widgetId?: string;
};

export function PowerBiVisual({
  title,
  subtitle,
  children,
  editMode,
  selected,
  onSelect,
  onDelete,
  className = "",
  span = "md",
  widgetId,
}: PowerBiVisualProps) {
  return (
    <div
      className={`h-full flex flex-col bg-white shadow-[0_1.6px_3.6px_rgba(0,0,0,0.13),0_0.3px_0.9px_rgba(0,0,0,0.11)] rounded-sm overflow-hidden transition-all ${
        editMode && selected ? "ring-2 ring-[#F2C811] ring-offset-1" : ""
      } ${className}`}
      style={{ border: `1px solid ${PBI.visualBorder}` }}
      onClick={editMode ? onSelect : undefined}
      role={editMode ? "button" : undefined}
    >
      <div
        className={`flex items-center justify-between px-3 py-2 shrink-0 ${editMode ? "drag-handle cursor-grab active:cursor-grabbing" : ""}`}
        style={{ borderBottom: `1px solid ${PBI.visualBorder}`, background: "#FAFAFA", userSelect: editMode ? "none" : "auto" }}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {editMode && (
            <div className="shrink-0 text-[#A19F9D]">
              <GripVertical size={14} />
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: PBI.text }}>
              {title}
            </p>
            {subtitle && (
              <p className="text-[11px] truncate" style={{ color: PBI.textMuted }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            className="p-1 rounded hover:bg-[#EDEBE9] text-[#605E5C]"
            title="Filter on visual"
            onClick={(e) => e.stopPropagation()}
          >
            <Filter size={14} />
          </button>
          {editMode && onDelete && (
            <button
              type="button"
              className="p-1 rounded hover:bg-red-50 text-[#605E5C] hover:text-red-600"
              title="Remove visual"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            type="button"
            className="p-1 rounded hover:bg-[#EDEBE9] text-[#605E5C]"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreHorizontal size={14} />
          </button>
        </div>
      </div>
      <div className="flex-1 p-3 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function PowerBiKpiCard({
  label,
  value,
  format = "number",
  trend,
}: {
  label: string;
  value: number;
  format?: "number" | "currency";
  trend?: string;
}) {
  const display =
    format === "currency"
      ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
      : value.toLocaleString();

  return (
    <div className="h-full flex flex-col justify-center px-2">
      <p className="text-[11px] uppercase tracking-wide font-medium" style={{ color: PBI.textMuted }}>
        {label}
      </p>
      <p
        className="text-[32px] font-light leading-tight mt-1 tabular-nums"
        style={{ color: PBI.text, fontFamily: "'Segoe UI', sans-serif" }}
      >
        {display}
      </p>
      {trend && (
        <p className="text-[11px] mt-2" style={{ color: PBI.success }}>
          {trend}
        </p>
      )}
    </div>
  );
}
