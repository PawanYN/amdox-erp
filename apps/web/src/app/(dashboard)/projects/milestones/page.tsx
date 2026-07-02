"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Flag, Loader2, Plus } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";

type ProjectOption = { id: string; name: string };
type MilestoneRow = {
  id: string;
  name: string;
  dueDate: string;
  isAchieved: boolean;
  isOverdue: boolean;
  alert: boolean;
  taskCount: number;
};

const inputClass =
  "w-full px-3 py-2 text-sm border border-[#D8D5CC] rounded-md bg-white text-[#14171F] focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F]";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ProjectsMilestonesPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMs, setLoadingMs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDue, setNewDue] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    pmApi
      .getProjects()
      .then((rows) => {
        setProjects(rows.map((p: ProjectOption) => ({ id: p.id, name: p.name })));
        if (rows[0]) setProjectId(rows[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const loadMilestones = (pid: string) => {
    if (!pid) return;
    setLoadingMs(true);
    pmApi
      .getMilestones(pid)
      .then(setMilestones)
      .catch((e) => setError(e.message))
      .finally(() => setLoadingMs(false));
  };

  useEffect(() => {
    if (projectId) loadMilestones(projectId);
  }, [projectId]);

  const handleCreate = async () => {
    if (!projectId || !newName.trim() || !newDue) return;
    setCreating(true);
    setError(null);
    try {
      await pmApi.createMilestone(projectId, {
        name: newName.trim(),
        dueDate: newDue,
      });
      setNewName("");
      setNewDue("");
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create milestone");
    } finally {
      setCreating(false);
    }
  };

  const handleAchieve = async (milestoneId: string) => {
    if (!projectId) return;
    try {
      await pmApi.achieveMilestone(projectId, milestoneId);
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to mark achieved");
    }
  };

  if (loading) return <p className="text-sm text-muted">Loading projects…</p>;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;
  const achievedCount = milestones.filter((m) => m.isAchieved).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] font-medium text-[#4A4740]">
          Project
          <select
            className={inputClass + " mt-1 min-w-[220px]"}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        {milestones.length > 0 && (
          <div className="flex gap-2 text-[11px] mt-5">
            <span className="px-2 py-0.5 rounded-full bg-[#2F6B4F]/10 text-[#2F6B4F]">
              {achievedCount} achieved
            </span>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#B4533B]/10 text-[#B4533B] flex items-center gap-1">
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        )}
      </div>

      <div className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
        <p className="text-[13px] font-medium text-[#14171F] mb-3 flex items-center gap-1.5">
          <Plus size={14} /> Add milestone
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className={inputClass}
            placeholder="Milestone name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <input
            type="date"
            className={inputClass}
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newDue}
            className="text-[13px] font-medium px-3 py-2 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create milestone"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-[#B4533B] bg-[#B4533B]/10 px-3 py-2 rounded-md">{error}</p>
      )}

      {loadingMs ? (
        <p className="text-sm text-muted flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading milestones…
        </p>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-muted">
          No milestones for this project. Add one above or create them in the New Project wizard.
        </p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`border rounded-lg p-4 bg-white ${
                m.isOverdue
                  ? "border-[#B4533B]/40 bg-[#B4533B]/5"
                  : m.isAchieved
                    ? "border-[#2F6B4F]/30 bg-[#2F6B4F]/5"
                    : "border-[#E4E2DC]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Flag
                    size={16}
                    className={
                      m.isAchieved
                        ? "text-[#2F6B4F] mt-0.5"
                        : m.isOverdue
                          ? "text-[#B4533B] mt-0.5"
                          : "text-[#1E3A5F] mt-0.5"
                    }
                  />
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        m.isAchieved ? "text-[#8A8678] line-through" : "text-[#14171F]"
                      }`}
                    >
                      {m.name}
                    </p>
                    <p className="text-[12px] text-[#8A8678] mt-0.5">
                      Due {formatDate(m.dueDate)} · {m.taskCount} task
                      {m.taskCount === 1 ? "" : "s"}
                    </p>
                    {m.isOverdue && (
                      <p className="text-[11px] text-[#B4533B] mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> Overdue — action required
                      </p>
                    )}
                  </div>
                </div>
                {!m.isAchieved && (
                  <button
                    onClick={() => handleAchieve(m.id)}
                    className="inline-flex items-center gap-1 text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#2F6B4F] text-[#2F6B4F] hover:bg-[#2F6B4F] hover:text-white transition-colors whitespace-nowrap"
                  >
                    <Check size={13} /> Mark achieved
                  </button>
                )}
                {m.isAchieved && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#2F6B4F]/10 text-[#2F6B4F]">
                    Achieved
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
