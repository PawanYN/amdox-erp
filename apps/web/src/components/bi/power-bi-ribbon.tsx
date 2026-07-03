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
  Save,
  Share2,
  FileText,
  BarChart3,
  Type,
  Image,
  Bookmark,
  Smartphone,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";
import { useState } from "react";
import { PBI } from "./power-bi-theme";
import type { BiScheduledReport, ReportRunStatus } from "@/lib/types/bi";

type RibbonTab = "home" | "insert" | "view";

export function BiRibbon({
  editMode,
  live,
  reportName,
  onSetEditMode,
  onToggleLive,
  onRefresh,
  onOpenReports,
  onNewPage,
}: {
  editMode: boolean;
  live: boolean;
  reportName?: string;
  onSetEditMode: (edit: boolean) => void;
  onToggleLive: () => void;
  onRefresh: () => void;
  onOpenReports: () => void;
  onNewPage: () => void;
}) {
  const [activeTab, setActiveTab] = useState<RibbonTab>("home");

  const tabClass = (t: RibbonTab) =>
    `px-4 py-2 text-[12px] font-medium border-b-2 transition-colors cursor-pointer select-none ${
      activeTab === t
        ? "border-[#F2C811] text-white"
        : "border-transparent text-[#C8C6C4] hover:text-white hover:border-[#605E5C]"
    }`;

  return (
    <div className="shrink-0 flex flex-col" style={{ background: PBI.ribbon }}>
      {/* Top strip: logo + report name + share */}
      <div className="flex items-center px-3 pt-1 pb-0 gap-3 h-9">
        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="h-6 w-6 rounded-sm bg-[#F2C811] flex items-center justify-center">
            <BarChart3 size={13} className="text-[#252423]" />
          </div>
          <span className="text-[13px] font-semibold text-white tracking-tight hidden sm:block">
            Power<span className="text-[#F2C811]">BI</span>
          </span>
        </div>

        {/* Report name */}
        <span className="text-[12px] text-[#C8C6C4] hidden md:block truncate max-w-[240px]">
          {reportName || "Amdox ERP Analytics"}
        </span>

        <div className="flex-1" />

        {/* Live indicator */}
        {live && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-semibold text-[#107C10] bg-[#DFF6DD]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#107C10] animate-pulse" />
            LIVE
          </div>
        )}

        {/* Share */}
        <button
          type="button"
          onClick={onOpenReports}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-[12px] font-medium text-white bg-[#118DFF] hover:bg-[#005A9E] transition-colors"
        >
          <Share2 size={12} /> Export
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex items-end px-2 gap-0 border-b" style={{ borderColor: "#3B3A39" }}>
        {(["home", "insert", "view"] as RibbonTab[]).map((t) => (
          <button key={t} type="button" className={tabClass(t)} onClick={() => setActiveTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex items-center gap-0 px-2 py-1 min-h-[48px]">
        {activeTab === "home" && (
          <>
            {/* Mode group */}
            <RibbonGroup label="Mode">
              <RibbonBtn
                icon={<Eye size={16} />}
                label="Read"
                active={!editMode}
                onClick={() => onSetEditMode(false)}
              />
              <RibbonBtn
                icon={<Edit3 size={16} />}
                label="Edit"
                active={editMode}
                onClick={() => onSetEditMode(true)}
              />
            </RibbonGroup>

            <RibbonDivider />

            {/* Data group */}
            <RibbonGroup label="Data">
              <RibbonBtn
                icon={<RefreshCw size={16} />}
                label="Refresh"
                onClick={onRefresh}
              />
              <RibbonBtn
                icon={<Radio size={16} />}
                label={live ? "Live on" : "Live off"}
                active={live}
                activeColor="#107C10"
                activeBg="#DFF6DD"
                onClick={onToggleLive}
              />
            </RibbonGroup>

            <RibbonDivider />

            {/* Share group */}
            <RibbonGroup label="Share">
              <RibbonBtn
                icon={<FileText size={16} />}
                label="Subscribe"
                onClick={onOpenReports}
              />
              <RibbonBtn
                icon={<Download size={16} />}
                label="Export"
                onClick={onOpenReports}
              />
            </RibbonGroup>
          </>
        )}

        {activeTab === "insert" && (
          <>
            <RibbonGroup label="Visuals">
              <RibbonBtn icon={<BarChart3 size={16} />} label="Visual" onClick={onNewPage} />
            </RibbonGroup>
            <RibbonDivider />
            <RibbonGroup label="Elements">
              <RibbonBtn icon={<Type size={16} />} label="Text box" onClick={() => {}} />
              <RibbonBtn icon={<Image size={16} />} label="Image" onClick={() => {}} />
              <RibbonBtn icon={<Bookmark size={16} />} label="Bookmark" onClick={() => {}} />
            </RibbonGroup>
            <RibbonDivider />
            <RibbonGroup label="Pages">
              <RibbonBtn icon={<Plus size={16} />} label="New page" onClick={onNewPage} />
            </RibbonGroup>
          </>
        )}

        {activeTab === "view" && (
          <>
            <RibbonGroup label="Page view">
              <RibbonBtn icon={<Smartphone size={16} />} label="Mobile" onClick={() => {}} />
              <RibbonBtn icon={<SlidersHorizontal size={16} />} label="Filters" onClick={() => {}} />
            </RibbonGroup>
            <RibbonDivider />
            <RibbonGroup label="Show panes">
              <RibbonBtn icon={<BarChart3 size={16} />} label="Visuals" onClick={() => {}} />
            </RibbonGroup>
          </>
        )}
      </div>
    </div>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center mr-1">
      <div className="flex items-end gap-0.5">{children}</div>
      <span className="text-[9px] text-[#8A8886] mt-0.5 tracking-wide uppercase">{label}</span>
    </div>
  );
}

function RibbonDivider() {
  return <div className="self-stretch mx-1 mb-3 w-px" style={{ background: "#3B3A39" }} />;
}

function RibbonBtn({
  icon,
  label,
  active,
  activeColor,
  activeBg,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  activeColor?: string;
  activeBg?: string;
  onClick: () => void;
}) {
  const bg = active ? (activeBg || "#F2C81133") : "transparent";
  const color = active ? (activeColor || "#F2C811") : "#C8C6C4";

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 rounded text-[10px] font-medium transition-all min-w-[44px] hover:bg-[#3B3A39]"
      style={{ background: bg, color }}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Legacy BiToolbar — kept for compatibility, now delegates to BiRibbon ── */
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
    <BiRibbon
      editMode={editMode}
      live={live}
      onSetEditMode={onSetEditMode}
      onToggleLive={onToggleLive}
      onRefresh={onRefresh}
      onOpenReports={() => {}}
      onNewPage={() => {}}
    />
  );
}

/* ── Page Tabs ── */
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
      className="shrink-0 flex items-center min-h-[36px] overflow-x-auto"
      style={{ background: PBI.tabBar, borderTop: `1px solid ${PBI.paneBorder}` }}
    >
      {pages.map((p) => {
        const isActive = activeId === p.id;
        return (
          <div
            key={p.id}
            className="group flex items-center shrink-0"
            style={{
              background: isActive ? "#FFFFFF" : "transparent",
              borderRight: `1px solid ${PBI.paneBorder}`,
              borderTop: isActive ? `2px solid ${PBI.accent}` : "2px solid transparent",
            }}
          >
            <button
              type="button"
              onClick={() => onSelect(p.id)}
              className="px-4 py-1.5 text-[12px] font-medium whitespace-nowrap transition-colors"
              style={{ color: isActive ? PBI.text : PBI.textMuted }}
            >
              {p.name}
            </button>
            {p.deletable && onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                title={`Delete "${p.name}"`}
                className="mr-1.5 p-0.5 rounded opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-[#FDE7E9] hover:text-[#A4262C] transition-all"
                style={{ color: PBI.textMuted }}
              >
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="flex items-center gap-1 px-3 py-1.5 text-[12px] hover:bg-[#E1DFDD] shrink-0 transition-colors"
        style={{ color: PBI.accent }}
      >
        <Plus size={13} /> New page
      </button>
    </div>
  );
}

/* ── Reports / Subscriptions Drawer ── */
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
          <h2 className="text-[14px] font-semibold" style={{ color: PBI.text }}>Subscriptions & Exports</h2>
          <button type="button" onClick={onClose} className="text-[12px] hover:underline" style={{ color: PBI.accent }}>Close</button>
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
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border disabled:opacity-50 hover:bg-slate-50 transition-colors"
                    style={{ borderColor: PBI.paneBorder }}
                  >
                    <Play size={11} /> Run
                  </button>
                  {r.lastRunAt && (
                    <button
                      type="button"
                      onClick={() => onDownload(r.id, r.name, r.format)}
                      className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border hover:bg-slate-50 transition-colors"
                      style={{ borderColor: PBI.paneBorder }}
                    >
                      <Download size={11} /> Download
                    </button>
                  )}
                  <button type="button" onClick={() => onDelete(r.id)} className="text-[11px] px-2 py-1 text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && (
            <p className="text-center text-[12px] py-8" style={{ color: PBI.textMuted }}>
              No subscriptions yet. Create one to schedule PDF/Excel exports.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
