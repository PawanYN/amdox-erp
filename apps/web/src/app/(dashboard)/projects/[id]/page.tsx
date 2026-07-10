"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Flag, Users, Wallet, Pencil, Trash2, Archive } from "lucide-react";
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
  const router = useRouter();
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
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [milestoneNameEdit, setMilestoneNameEdit] = useState("");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskTitleEdit, setTaskTitleEdit] = useState("");

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

  async function handleCloseProject() {
    if (!data || !confirm(`Close "${data.name}"? Status will be set to COMPLETED.`)) return;
    try {
      await pmApi.closeProject(projectId);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close project.");
    }
  }

  async function handleDeleteProject() {
    if (
      !data ||
      !confirm(
        `Delete "${data.name}" and all milestones, tasks, budgets, and allocations?\n\nThis cannot be undone.`,
      )
    )
      return;
    try {
      await pmApi.deleteProject(projectId);
      router.push("/projects/overview");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project.");
    }
  }

  async function handleSaveMilestone(milestoneId: string) {
    if (!milestoneNameEdit.trim()) return;
    try {
      await pmApi.updateMilestone(projectId, milestoneId, { name: milestoneNameEdit.trim() });
      setEditingMilestoneId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update milestone.");
    }
  }

  async function handleDeleteMilestone(milestoneId: string, name: string) {
    if (!confirm(`Delete milestone "${name}"? Linked tasks will be kept without this milestone.`))
      return;
    try {
      await pmApi.deleteMilestone(projectId, milestoneId);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete milestone.");
    }
  }

  async function handleSaveTask(taskId: string) {
    if (!taskTitleEdit.trim()) return;
    try {
      await pmApi.updateTask(taskId, { title: taskTitleEdit.trim() });
      setEditingTaskId(null);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task.");
    }
  }

  async function handleDeleteTask(taskId: string, title: string) {
    if (!confirm(`Delete task "${title}" and its allocations?`)) return;
    try {
      await pmApi.deleteTask(taskId);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete task.");
    }
  }

  async function handleDeleteResource(allocationId: string, name: string) {
    if (!confirm(`Remove allocation for ${name}?`)) return;
    try {
      await pmApi.deleteAllocation(allocationId);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove allocation.");
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
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[#14171F]">{data.name}</h2>
            <p className="text-[12px] text-[#8A8678] mt-1">{data.status}</p>
            {data.description && (
              <p className="text-[13px] text-[#4A4740] mt-2">{data.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {data.budget?.isOverrun && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#B4533B]/10 text-[#B4533B]">
                Budget overrun
              </span>
            )}
            <Button variant="outline" icon={<Pencil size={14} />} onClick={openEdit}>
              Edit
            </Button>
            {data.status !== "COMPLETED" && data.status !== "CANCELLED" && (
              <Button variant="outline" icon={<Archive size={14} />} onClick={handleCloseProject}>
                Close
              </Button>
            )}
            <Button
              variant="outline"
              icon={<Trash2 size={14} />}
              onClick={handleDeleteProject}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              Delete
            </Button>
          </div>
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
                className={`flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-[13px] ${
                  m.isOverdue ? "border-[#B4533B]/40 bg-[#B4533B]/5" : "border-[#E4E2DC] bg-white"
                }`}
              >
                <div className="flex-1 min-w-0">
                  {editingMilestoneId === m.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        className="flex-1 text-[13px] border border-[#E4E2DC] rounded px-2 py-1"
                        value={milestoneNameEdit}
                        onChange={(e) => setMilestoneNameEdit(e.target.value)}
                      />
                      <button
                        onClick={() => handleSaveMilestone(m.id)}
                        className="text-[11px] px-2 py-1 rounded border border-[#2F6B4F] text-[#2F6B4F]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingMilestoneId(null)}
                        className="text-[11px] px-2 py-1 rounded border border-[#E4E2DC]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      className={m.isAchieved ? "line-through text-[#8A8678]" : "text-[#14171F]"}
                    >
                      {m.name} · {new Date(m.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!m.isAchieved && editingMilestoneId !== m.id && (
                    <button
                      onClick={() => onAchieve(m.id)}
                      className="text-[11px] px-2 py-1 rounded border border-[#2F6B4F] text-[#2F6B4F] hover:bg-[#2F6B4F] hover:text-white"
                    >
                      Achieve
                    </button>
                  )}
                  {editingMilestoneId !== m.id && (
                    <>
                      <button
                        onClick={() => {
                          setEditingMilestoneId(m.id);
                          setMilestoneNameEdit(m.name);
                        }}
                        className="p-1.5 rounded text-[#8A8678] hover:bg-[#F0EEE7]"
                        title="Edit milestone"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteMilestone(m.id, m.name)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50"
                        title="Delete milestone"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
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
              {editingTaskId === t.id ? (
                <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                  <input
                    className="flex-1 text-[13px] border border-[#E4E2DC] rounded px-2 py-1"
                    value={taskTitleEdit}
                    onChange={(e) => setTaskTitleEdit(e.target.value)}
                  />
                  <button
                    onClick={() => handleSaveTask(t.id)}
                    className="text-[11px] px-2 py-1 rounded border border-[#2F6B4F] text-[#2F6B4F]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTaskId(null)}
                    className="text-[11px] px-2 py-1 rounded border border-[#E4E2DC]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <span className="flex-1 text-[13px] text-[#14171F] min-w-[120px]">{t.title}</span>
              )}
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
              {editingTaskId !== t.id && (
                <>
                  <button
                    onClick={() => {
                      setEditingTaskId(t.id);
                      setTaskTitleEdit(t.title);
                    }}
                    className="p-1.5 rounded text-[#8A8678] hover:bg-[#F0EEE7]"
                    title="Edit task"
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteTask(t.id, t.title)}
                    className="p-1.5 rounded text-red-500 hover:bg-red-50"
                    title="Delete task"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              )}
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
                  <th className="text-right px-3 py-2 text-[#8A8678]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.resources.map((r) => (
                  <tr key={r.id} className="border-t border-[#F0EEE7]">
                    <td className="px-3 py-2">{r.employeeName}</td>
                    <td className="px-3 py-2 text-[#8A8678]">{r.taskTitle ?? "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.allocatedHours}h</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => handleDeleteResource(r.id, r.employeeName)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50 inline-flex"
                        title="Remove allocation"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
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
