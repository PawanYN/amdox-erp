"use client";

import { ArrowLeft, X } from "lucide-react";
import { PBI } from "./power-bi-theme";

type DrillDownResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export function DrillThroughPane({
  title,
  data,
  onClose,
}: {
  title: string;
  data: DrillDownResult | null;
  onClose: () => void;
}) {
  if (!data) return null;

  return (
    <div
      className="shrink-0 flex flex-col max-h-[240px] animate-in slide-in-from-bottom-2"
      style={{ background: "#fff", borderTop: `2px solid ${PBI.accent}` }}
    >
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ background: "#FAFAFA", borderBottom: `1px solid ${PBI.paneBorder}` }}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-[12px] font-medium hover:underline"
            style={{ color: PBI.accent }}
          >
            <ArrowLeft size={14} /> Back to report
          </button>
          <span className="text-[#C8C6C4]">|</span>
          <span className="text-[13px] font-semibold" style={{ color: PBI.text }}>
            {title}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#DEECF9] text-[#005A9E]">
            {data.rows.length} rows
          </span>
        </div>
        <button type="button" onClick={onClose} className="p-1 hover:bg-[#EDEBE9] rounded">
          <X size={16} style={{ color: PBI.textMuted }} />
        </button>
      </div>
      <div className="overflow-auto flex-1">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10" style={{ background: "#F3F2F1" }}>
            <tr>
              {data.columns.map((col) => (
                <th
                  key={col}
                  className="text-left px-4 py-2 font-semibold whitespace-nowrap"
                  style={{ color: PBI.text, borderBottom: `1px solid ${PBI.paneBorder}` }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-4 py-6 text-center" style={{ color: PBI.textMuted }}>
                  No rows match this segment. Try clearing filters or selecting another chart segment.
                </td>
              </tr>
            ) : (
              data.rows.map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-[#DEECF9]/40"
                  style={{ borderBottom: `1px solid ${PBI.paneBorder}` }}
                >
                  {data.columns.map((_, colIdx) => {
                    const val = Object.values(row)[colIdx];
                    return (
                      <td key={colIdx} className="px-4 py-2 whitespace-nowrap" style={{ color: PBI.text }}>
                        {typeof val === "number" ? val.toLocaleString() : String(val ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
