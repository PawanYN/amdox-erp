"use client";

import {
  Download,
  Edit3,
  Eye,
  FileText,
  MoreHorizontal,
  Play,
  Plus,
  Radio,
  RefreshCw,
  Share2,
} from "lucide-react";
import { PBI } from "./power-bi-theme";
import type { BiScheduledReport, ReportRunStatus } from "@/lib/types/bi";

type RibbonProps = {
  reportName: string;
  editMode: boolean;
  live: boolean;
  onSetEditMode: (edit: boolean) => void;
  onToggleLive: () => void;
  onRefresh: () => void;
  onSubscribe?: () => void;
};

export function PowerBiRibbon({
  reportName,
  editMode,
  live,
  onSetEditMode,
  onToggleLive,
  onRefresh,
  onSubscribe,
}: RibbonProps) {
  return (
    <header
      className="shrink-0 flex flex-col"
      style={{ background: PBI.ribbon, fontFamily: "'Segoe UI', 'IBM Plex Sans', sans-serif" }}
    >
      <div className="flex items-center h-9 px-2 text-white text-[13px] gap-1">
        <span className="font-semibold px-2 truncate max-w-[200px]">{reportName}</span>
        <span className="text-[#A19F9D]">|</span>
        <button type="button" className="flex items-center gap-1.5 px-3 h-7 rounded hover:bg-[#323130]">
          <FileText size={14} /> File
        </button>
        <button type="button" className="px-3 h-7 rounded hover:bg-[#323130]">View</button>
        <button type="button" className="px-3 h-7 rounded hover:bg-[#323130]">Insert</button>
        <button type="button" className="px-3 h-7 rounded hover:bg-[#323130]">Modeling</button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={onToggleLive}
          className={`flex items-center gap-1.5 px-3 h-7 rounded text-[12px] ${
            live ? "bg-[#107C10] text-white" : "hover:bg-[#323130] text-[#F3F2F1]"
          }`}
        >
          <Radio size={13} /> {live ? "Live" : "Live off"}
        </button>
        <button type="button" onClick={onRefresh} className="flex items-center gap-1.5 px-3 h-7 rounded hover:bg-[#323130] text-[#F3F2F1]">
          <RefreshCw size={13} /> Refresh
        </button>
        <button type="button" onClick={onSubscribe} className="flex items-center gap-1.5 px-3 h-7 rounded hover:bg-[#323130] text-[#F3F2F1]">
          <Share2 size={13} /> Subscribe
        </button>
        <button type="button" className="p-1.5 rounded hover:bg-[#323130] text-[#F3F2F1]">
          <MoreHorizontal size={16} />
        </button>
      </div>

      <div
        className="flex items-center gap-2 px-3 py-1.5"
        style={{ background: "#323130", borderTop: "1px solid #3B3A39" }}
      >
        <button
          type="button"
          onClick={() => onSetEditMode(false)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-medium transition-colors ${
            !editMode
              ? "bg-[#F2C811] text-[#252423]"
              : "text-[#F3F2F1] hover:bg-[#3B3A39]"
          }`}
        >
          <Eye size={14} /> Reading view
        </button>
        <button
          type="button"
          onClick={() => onSetEditMode(true)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-medium transition-colors ${
            editMode
              ? "bg-[#F2C811] text-[#252423]"
              : "text-[#F3F2F1] hover:bg-[#3B3A39]"
          }`}
        >
          <Edit3 size={14} /> Edit
        </button>
        <span className="text-[#605E5C] mx-1">|</span>
        <span className="text-[11px] text-[#A19F9D]">
          Click a data point to cross-filter · Drill-through opens below
        </span>
      </div>
    </header>
  );
}

export function PageTabs({
  pages,
  activeId,
  onSelect,
  onAdd,
}: {
  pages: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div
      className="flex items-center gap-0 shrink-0 overflow-x-auto"
      style={{ background: PBI.tabBar, borderTop: `1px solid ${PBI.paneBorder}` }}
    >
      {pages.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onSelect(p.id)}
          className="px-4 py-2 text-[12px] font-medium whitespace-nowrap transition-colors relative"
          style={{
            color: activeId === p.id ? PBI.text : PBI.textMuted,
            background: activeId === p.id ? PBI.tabActive : "transparent",
            borderRight: `1px solid ${PBI.paneBorder}`,
            borderTop: activeId === p.id ? `2px solid ${PBI.accent}` : "2px solid transparent",
          }}
        >
          {p.name}
        </button>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-2 text-[12px] hover:bg-[#EDEBE9]"
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
