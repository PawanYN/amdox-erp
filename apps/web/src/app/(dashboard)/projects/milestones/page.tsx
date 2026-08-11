"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Flag, Loader2, Plus, Pencil, Trash2 } from "lucide-react";
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

function toDateInputValue(d: string) {
  return d.slice(0, 10);
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
  const [savingDueId, setSavingDueId] = useState<string | null>(null);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameEdit, setNameEdit] = useState("");

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

  const handleDueDateChange = async (milestoneId: string, dueDate: string) => {
    if (!projectId || !dueDate) return;
    setSavingDueId(milestoneId);
    setError(null);
    try {
      await pmApi.updateMilestone(projectId, milestoneId, { dueDate });
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update due date");
    } finally {
      setSavingDueId(null);
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

  const handleSaveName = async (milestoneId: string) => {
    if (!projectId || !nameEdit.trim()) return;
    try {
      await pmApi.updateMilestone(projectId, milestoneId, { name: nameEdit.trim() });
      setEditingNameId(null);
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update name");
    }
  };

  const handleDelete = async (milestoneId: string, name: string) => {
    if (!projectId) return;
    if (
      !confirm(
        `Delete milestone "${name}"? Tasks stay on the project but lose this milestone link.`,
      )
    )
      return;
    try {
      await pmApi.deleteMilestone(projectId, milestoneId);
      loadMilestones(projectId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete milestone");
    }
  };

  if (loading) return <p className="text-sm text-slate-500">Loading projects…</p>;

  const overdueCount = milestones.filter((m) => m.isOverdue).length;
  const achievedCount = milestones.filter((m) => m.isAchieved).length;

  const inputClass =
    "w-full px-3 py-2 text-sm rounded-md bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
  const inputStyle = {borderColor: '#dfe3e8', color: '#2b2f36'};

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium flex flex-col gap-1" style={{color: '#2b2f36'}}>
          Project
          <select
            className={`${inputClass} min-w-[220px] border`}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={inputStyle}
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
            <span className="px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: '#f0f9ff', color: '#0ea5e9'}}>
              {achievedCount} achieved
            </span>
            {overdueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{backgroundColor: '#fff5f5', color: '#d9534f'}}>
                <AlertTriangle size={11} /> {overdueCount} overdue
              </span>
            )}
          </div>
        )}
      </div>

      {/* Add milestone form */}
      <div className="border rounded-lg p-4 bg-white" style={{borderColor: '#dfe3e8'}}>
        <p className="text-[13px] font-semibold mb-3 flex items-center gap-1.5" style={{color: '#2b2f36'}}>
          <Plus size={14} /> Add milestone
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            className={`${inputClass} border`}
            placeholder="Milestone name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="date"
            className={`${inputClass} border`}
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim() || !newDue}
            className="text-[13px] font-medium px-3 py-2 rounded-md disabled:opacity-50 transition-colors"
            style={{background: '#1f5fa8', color: '#fff'}}
          >
            {creating ? "Creating…" : "Create milestone"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-[12px] px-3 py-2 rounded-md" style={{color: '#d9534f', backgroundColor: '#fff5f5', border: '1px solid #dfe3e8'}}>
          {error}
        </p>
      )}

      {loadingMs ? (
        <p className="text-sm flex items-center gap-2" style={{color: '#6b7280'}}>
          <Loader2 size={14} className="animate-spin" /> Loading milestones…
        </p>
      ) : milestones.length === 0 ? (
        <p className="text-sm" style={{color: '#6b7280'}}>
          No milestones for this project. Add one above or create them in the New Project wizard.
        </p>
      ) : (
        <div className="space-y-2">
          {milestones.map((m) => (
            <div
              key={m.id}
              className={`border rounded-lg p-4 bg-white`}
              style={{
                borderColor: m.isOverdue ? '#dfe3e8' : m.isAchieved ? '#dfe3e8' : '#dfe3e8',
                backgroundColor: m.isOverdue ? '#fff5f5' : m.isAchieved ? '#f0f9ff' : '#ffffff'
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2">
                  <Flag
                    size={16}
                    className={`mt-0.5`}
                    style={{
                      color: m.isAchieved ? '#0ea5e9' : m.isOverdue ? '#d9534f' : '#1f5fa8'
                    }}
                  />
                  <div>
                    {editingNameId === m.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          className={`${inputClass} text-sm py-1 border`}
                          value={nameEdit}
                          onChange={(e) => setNameEdit(e.target.value)}
                          style={inputStyle}
                        />
                        <button
                          onClick={() => handleSaveName(m.id)}
                          className="text-[12px] font-medium px-2 py-1 rounded-md"
                          style={{background: '#1f5fa8', color: '#fff'}}
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingNameId(null)}
                          className="text-[12px] px-2 py-1 rounded-md border"
                          style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <p
                        className={`text-sm font-semibold ${m.isAchieved ? "line-through" : ""}`}
                        style={{color: m.isAchieved ? '#6b7280' : '#2b2f36'}}
                      >
                        {m.name}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-0.5">
                      {!m.isAchieved ? (
                        <label className="flex items-center gap-1.5 text-[12px]" style={{color: '#6b7280'}}>
                          <span>Due</span>
                          <input
                            type="date"
                            className={`${inputClass} w-auto py-1 px-2 text-[12px] border`}
                            value={toDateInputValue(m.dueDate)}
                            disabled={savingDueId === m.id}
                            onChange={(e) => handleDueDateChange(m.id, e.target.value)}
                            style={inputStyle}
                          />
                          {savingDueId === m.id && (
                            <Loader2 size={12} className="animate-spin" style={{color: '#6b7280'}} />
                          )}
                        </label>
                      ) : (
                        <p className="text-[12px]" style={{color: '#6b7280'}}>Due {formatDate(m.dueDate)}</p>
                      )}
                      <span className="text-[12px]" style={{color: '#6b7280'}}>
                        · {m.taskCount} task{m.taskCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {m.isOverdue && (
                      <p className="text-[11px] mt-1 flex items-center gap-1" style={{color: '#d9534f'}}>
                        <AlertTriangle size={12} /> Overdue — action required
                      </p>
                    )}
                    {m.alert && !m.isOverdue && (
                      <p className="text-[11px] mt-1 flex items-center gap-1" style={{color: '#d9534f'}}>
                        <AlertTriangle size={12} /> Alert: Check milestone status
                      </p>
                    )}
                  </div>
                </div>
                {!m.isAchieved ? (
                  <button
                    onClick={() => handleAchieve(m.id)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border transition-colors whitespace-nowrap hover:opacity-80"
                    style={{borderColor: '#dfe3e8', color: '#2b2f36', background: '#fff'}}
                  >
                    <Check size={13} /> Mark achieved
                  </button>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{backgroundColor: '#f0f9ff', color: '#0ea5e9'}}>
                    Achieved
                  </span>
                )}
                {editingNameId !== m.id && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingNameId(m.id);
                        setNameEdit(m.name);
                      }}
                      className="p-1.5 rounded-md hover:opacity-80 transition-colors"
                      style={{color: '#6b7280'}}
                      title="Edit name"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id, m.name)}
                      className="p-1.5 rounded-md hover:opacity-80 transition-colors"
                      style={{color: '#d9534f'}}
                      title="Delete milestone"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
