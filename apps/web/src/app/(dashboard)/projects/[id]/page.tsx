"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Flag, Users, Wallet, Pencil } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";

const TASK_STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;
const PROJECT_STATUSES = ["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"] as const;

const statusColor: Record<string, string> = {
  TODO: "bg-[#F0EEE7] text-[#8A8678]",
  IN_PROGRESS: "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  BLOCKED: "bg-[#B4533B]/10 text-[#B4533B]",
  DONE: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
};

type ProjectMilestone = {
  id: string;
  name: string;
  dueDate: string;
  isOverdue: boolean;
  isAchieved: boolean;
};

type ProjectTask = {
  id: string;
  title: string;
  status: string;
  milestone?: { name: string };
};

type ProjectResource = {
  id: string;
  employeeName: string;
  taskTitle?: string;
  allocatedHours: number;
};

type ProjectData = {
  name: string;
  description?: string;
  status: string;
  startDate?: string;
  endDate?: string;
  budget?: {
    isOverrun: boolean;
    plannedAmount: number;
    actualAmount: number;
    variancePct: number;
  };
  milestones: ProjectMilestone[];
  tasks: ProjectTask[];
  resources: ProjectResource[];
};

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    pmApi
      .getProject(projectId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const onStatusChange = async (taskId: string, status: string) => {
    await pmApi.updateTaskStatus(taskId, status);
    load();
  };

  const onAchieve = async (milestoneId: string) => {
    await pmApi.achieveMilestone(projectId, milestoneId);
    load();
  };

  function openEdit() {
    if (!data) return;
    setEditName(data.name);
    setEditDescription(data.description || "");
    setEditStatus(data.status);
    setEditStart(data.startDate ? data.startDate.slice(0, 10) : "");
    setEditEnd(data.endDate ? data.endDate.slice(0, 10) : "");
    setEditOpen(true);
  }

  async function handleSaveProject() {
    setSaving(true);
    try {
      await pmApi.updateProject(projectId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        status: editStatus,
        startDate: editStart || undefined,
        endDate: editEnd || undefined,
      });
      setEditOpen(false);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update project.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-muted">Loading project…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-5">
      <Link
        href="/projects/overview"
        className="inline-flex items-center gap-1 text-[12px] text-[#8A8678] hover:text-[#1E3A5F]"
      >
        <ChevronLeft size={14} /> Back to projects
      </Link>

      <div className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#14171F]">{data.name}</h2>
            <p className="text-[12px] text-[#8A8678] mt-1">{data.status}</p>
            {data.description && (
              <p className="text-[13px] text-[#4A4740] mt-2">{data.description}</p>
            )}
          </div>
          {data.budget?.isOverrun && (
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#B4533B]/10 text-[#B4533B]">
              Budget overrun
            </span>
          )}
          <Button variant="outline" icon={<Pencil size={14} />} onClick={openEdit}>
            Edit
          </Button>
        </div>
        {data.budget && (
          <div className="mt-3 flex items-center gap-2 text-[12px] text-[#8A8678]">
            <Wallet size={14} />
            Planned ₹{data.budget.plannedAmount.toLocaleString()} · Actual ₹
            {data.budget.actualAmount.toLocaleString()} ({data.budget.variancePct}%)
          </div>
        )}
      </div>

      <section>
        <h3 className="text-[13px] font-semibold text-[#14171F] mb-2 flex items-center gap-1.5">
          <Flag size={14} /> Milestones ({data.milestones.length})
        </h3>
        <div className="space-y-2">
          {data.milestones.length === 0 ? (
            <p className="text-sm text-muted">No milestones.</p>
          ) : (
            data.milestones.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between border rounded-lg px-3 py-2 text-[13px] ${
                  m.isOverdue ? "border-[#B4533B]/40 bg-[#B4533B]/5" : "border-[#E4E2DC] bg-white"
                }`}
              >
                <span className={m.isAchieved ? "line-through text-[#8A8678]" : "text-[#14171F]"}>
                  {m.name} · {new Date(m.dueDate).toLocaleDateString()}
                </span>
                {!m.isAchieved && (
                  <button
                    onClick={() => onAchieve(m.id)}
                    className="text-[11px] px-2 py-1 rounded border border-[#2F6B4F] text-[#2F6B4F] hover:bg-[#2F6B4F] hover:text-white"
                  >
                    Achieve
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-[#14171F] mb-2">
          Tasks ({data.tasks.length})
        </h3>
        <div className="space-y-2">
          {data.tasks.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center gap-2 border border-[#E4E2DC] rounded-lg px-3 py-2 bg-white"
            >
              <span className="flex-1 text-[13px] text-[#14171F] min-w-[120px]">{t.title}</span>
              {t.milestone && (
                <span className="text-[10px] text-[#2F6B4F]">→ {t.milestone.name}</span>
              )}
              <select
                value={t.status}
                onChange={(e) => onStatusChange(t.id, e.target.value)}
                className={`text-[11px] px-2 py-1 rounded-full border-0 cursor-pointer ${statusColor[t.status]}`}
              >
                {TASK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[13px] font-semibold text-[#14171F] mb-2 flex items-center gap-1.5">
          <Users size={14} /> Team ({data.resources.length})
        </h3>
        {data.resources.length === 0 ? (
          <p className="text-sm text-muted">No allocations.</p>
        ) : (
          <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead className="bg-[#FAFAF9]">
                <tr>
                  <th className="text-left px-3 py-2 text-[#8A8678]">Person</th>
                  <th className="text-left px-3 py-2 text-[#8A8678]">Task</th>
                  <th className="text-right px-3 py-2 text-[#8A8678]">Hours</th>
                </tr>
              </thead>
              <tbody>
                {data.resources.map((r) => (
                  <tr key={r.id} className="border-t border-[#F0EEE7]">
                    <td className="px-3 py-2">{r.employeeName}</td>
                    <td className="px-3 py-2 text-[#8A8678]">{r.taskTitle ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.allocatedHours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Project">
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Name *</label>
            <input
              className={inputClasses}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Description</label>
            <textarea
              className={inputClasses}
              rows={3}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Status</label>
            <select
              className={inputClasses}
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value)}
            >
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace("_", " ")}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">Start date</label>
              <input
                type="date"
                className={inputClasses}
                value={editStart}
                onChange={(e) => setEditStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">End date</label>
              <input
                type="date"
                className={inputClasses}
                value={editEnd}
                onChange={(e) => setEditEnd(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProject} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
