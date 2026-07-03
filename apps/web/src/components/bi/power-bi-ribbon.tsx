"use client";

import {
  Download,
  Edit3,
  Eye,
  Play,
  Plus,
  Radio,
  RefreshCw,
  X,
} from "lucide-react";
import { PBI } from "./power-bi-theme";
import type { BiScheduledReport, ReportRunStatus } from "@/lib/types/bi";

export function BiToolbar({
  editMode,
  live,
  onSetEditMode,
  onToggleLive,
  onRefresh,
}: {
  editMode: boolean;
  live: boolean;
  onSetEditMode: (edit: boolean) => void;
  onToggleLive: () => void;
  onRefresh: () => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center justify-end gap-1 px-3 py-1.5"
      style={{ background: PBI.tabBar, borderBottom: `1px solid ${PBI.paneBorder}` }}
    >
      <button
        type="button"
        onClick={() => onSetEditMode(false)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
          !editMode ? "bg-[#F2C811] text-[#252423]" : "hover:bg-[#EDEBE9] text-[#605E5C]"
        }`}
      >
        <Eye size={13} /> Read
      </button>
      <button
        type="button"
        onClick={() => onSetEditMode(true)}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
          editMode ? "bg-[#F2C811] text-[#252423]" : "hover:bg-[#EDEBE9] text-[#605E5C]"
        }`}
      >
        <Edit3 size={13} /> Edit
      </button>
      <span className="text-[#C8C6C4] mx-0.5">|</span>
      <button
        type="button"
        onClick={onToggleLive}
        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium transition-colors ${
          live ? "bg-[#DFF6DD] text-[#107C10]" : "hover:bg-[#EDEBE9] text-[#605E5C]"
        }`}
      >
        <Radio size={13} /> {live ? "Live" : "Live off"}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="flex items-center gap-1 px-2.5 py-1.5 rounded text-[11px] font-medium hover:bg-[#EDEBE9] text-[#605E5C] transition-colors"
      >
        <RefreshCw size={13} /> Refresh
      </button>
    </div>
  );
}

export function PageTabs({
  pages,
  activeId,
  onSelect,
  onAdd,
  onDelete,
}: {
  pages: { id: string; name: string; deletable?: boolean }[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDelete?: (id: string) => void;
}) {
  return (
    <div
      className="shrink-0 flex items-center min-h-[40px] overflow-x-auto"
      style={{ background: PBI.tabBar, borderTop: `1px solid ${PBI.paneBorder}` }}
    >
      {pages.map((p) => {
        const isActive = activeId === p.id;
        return (
          <div
            key={p.id}
            className="group flex items-center shrink-0"
            style={{
              background: isActive ? PBI.tabActive : "transparent",
              borderRight: `1px solid ${PBI.paneBorder}`,
              borderTop: isActive ? `2px solid ${PBI.accent}` : "2px solid transparent",
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className="px-4 py-2 text-[12px] font-medium whitespace-nowrap transition-colors"
              style={{ color: isActive ? PBI.text : PBI.textMuted }}
            >
              {p.name}
            </button>
            {p.deletable && onDelete && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(p.id);
                }}
                title={`Delete "${p.name}"`}
                aria-label={`Delete page ${p.name}`}
                className="mr-1.5 p-0.5 rounded opacity-60 hover:opacity-100 hover:bg-[#FDE7E9] hover:text-[#A4262C] transition-all"
                style={{ color: PBI.textMuted }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-2 text-[12px] hover:bg-[#EDEBE9] shrink-0"
        style={{ color: PBI.accent }}
      >
        <Plus size={14} /> New page
      </button>
    </div>
  );
}

export function ReportsDrawer({
  open,
  reports,
  runStatus,
  onClose,
  onCreate,
  onRun,
  onDownload,
  onDelete,
}: {
  open: boolean;
  reports: BiScheduledReport[];
  runStatus: Record<string, ReportRunStatus>;
  onClose: () => void;
  onCreate: () => void;
  onRun: (id: string) => void;
  onDownload: (id: string, name: string, format: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!open) return null;

  const statusLabel = (id: string) => {
    const s = runStatus[id] || "idle";
    if (s === "running") return { text: "Running…", color: "#005A9E" };
    if (s === "done") return { text: "Ready", color: "#107C10" };
    if (s === "failed") return { text: "Failed", color: "#A4262C" };
    return null;
  };

  return (
    <div className="absolute inset-0 z-30 flex">
      <div className="flex-1 bg-black/30" onClick={onClose} />
      <div className="w-[420px] bg-white shadow-xl flex flex-col" style={{ borderLeft: `1px solid ${PBI.paneBorder}` }}>
        <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: `1px solid ${PBI.paneBorder}` }}>
          <h2 className="text-[15px] font-semibold" style={{ color: PBI.text }}>Subscriptions & exports</h2>
          <button type="button" onClick={onClose} className="text-[13px]" style={{ color: PBI.accent }}>Close</button>
        </div>
        <div className="p-4 flex-1 overflow-y-auto space-y-3">
          <button
            type="button"
            onClick={onCreate}
            className="w-full py-2 text-[13px] font-semibold text-white rounded"
            style={{ background: PBI.accent }}
          >
            + New subscription
          </button>
          {reports.map((r) => {
            const status = statusLabel(r.id);
            return (
            <div key={r.id} className="p-3 rounded border" style={{ borderColor: PBI.paneBorder }}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-[13px]" style={{ color: PBI.text }}>{r.name}</p>
                {status && (
                  <span className="text-[10px] font-semibold uppercase" style={{ color: status.color }}>
                    {status.text}
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-1" style={{ color: PBI.textMuted }}>
                {r.cronExpr} · {r.format}
                {r.lastRunAt ? ` · Last run ${new Date(r.lastRunAt).toLocaleString()}` : ""}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  disabled={runStatus[r.id] === "running"}
                  onClick={() => onRun(r.id)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border disabled:opacity-50"
                  style={{ borderColor: PBI.paneBorder }}
                >
                  <Play size={12} /> Run
                </button>
                {r.lastRunAt && (
                  <button
                    type="button"
                    onClick={() => onDownload(r.id, r.name, r.format)}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border"
                    style={{ borderColor: PBI.paneBorder }}
                  >
                    <Download size={12} /> Download
                  </button>
                )}
                <button type="button" onClick={() => onDelete(r.id)} className="text-[11px] px-2 py-1 text-red-600">Delete</button>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </div>
  );
}
