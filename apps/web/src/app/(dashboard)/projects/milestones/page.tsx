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
      await pmApi.createMilestone(projectId, { name: newName.trim(), dueDate: newDue });
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

  if (loading) return <p className="text-sm text-slate-400">Loading projects…</p>;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;
  const achievedCount = milestones.filter((m) => m.isAchieved).length;

  const inputClass =
    "w-full px-3 py-2 text-sm border border-slate-200 rounded-md bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium text-slate-700 flex flex-col gap-1">
          Project
          <select
            className={`${inputClass} min-w-[220px]`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        {milestones.length > 0 && (
          <div className="flex gap-2 text-[11px] mt-5">
            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
              {achievedCount} achieved
            </span>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium flex items-center gap-1">
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        )}
      </div>

      {/* Add milestone form */}
      <div className="border border-slate-200 rounded-lg p-4 bg-white shadow-card">
        <p className="text-[13px] font-semibold text-slate-700 mb-3 flex items-center gap-1.5">
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
            className="text-[13px] font-medium px-3 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "Create milestone"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-md">{error}</p>
      )}

      {loadingMs ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading milestones…
        </p>
      ) : milestones.length === 0 ? (
        <p className="text-sm text-slate-400">
          No milestones for this project. Add one above or create them in the New Project wizard.
        </p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`border rounded-lg p-4 bg-white ${
                m.isOverdue
                  ? "border-red-200 bg-red-50/40"
                  : m.isAchieved
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Flag
                    size={16}
                    className={`mt-0.5 ${
                      m.isAchieved ? "text-emerald-600" : m.isOverdue ? "text-red-500" : "text-blue-600"
                    }`}
                  />
                  <div>
                    <p className={`text-sm font-semibold ${m.isAchieved ? "text-slate-400 line-through" : "text-slate-900"}`}>
                      {m.name}
                    </p>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      Due {formatDate(m.dueDate)} · {m.taskCount} task{m.taskCount === 1 ? "" : "s"}
                    </p>
                    {m.isOverdue && (
                      <p className="text-[11px] text-red-600 mt-1 flex items-center gap-1">
                        <AlertTriangle size={12} /> Overdue — action required
                      </p>
                    )}
                  </div>
                </div>
                {!m.isAchieved ? (
                  <button
                    onClick={() => handleAchieve(m.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-600 hover:text-white transition-colors whitespace-nowrap"
                  >
                    <Check size={13} /> Mark achieved
                  </button>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
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
