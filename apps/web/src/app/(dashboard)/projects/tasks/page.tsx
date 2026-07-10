"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { D3GanttChart } from "@/components/pm/D3GanttChart";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

function parseDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

type ProjectOption = { id: string; name: string };

type TaskItem = {
  id: string;
  title: string;
  status: string;
  startDate?: string;
  dueDate?: string;
  project?: { name: string };
  dependsOn?: { prerequisiteTask?: { title: string } }[];
};

export default function ProjectsTasksPage() {
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"d3" | "table">("d3");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [titleEdit, setTitleEdit] = useState("");

  const loadTasks = (pid?: string) => {
    setLoading(true);
    pmApi
      .getTasks(pid || undefined)
      .then(setTasks)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    pmApi.getProjects().then((rows) => {
      setProjects(rows);
      if (rows[0]) setProjectId(rows[0].id);
    });
  }, []);

  useEffect(() => {
    loadTasks(projectId || undefined);
  }, [projectId]);

  const range = useMemo(() => {
    const dates = tasks
      .flatMap((t) => [parseDate(t.startDate), parseDate(t.dueDate)])
      .filter(Boolean) as Date[];
    if (dates.length === 0) {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 29);
      return { start, days: 30 };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);
    const days = Math.max(7, Math.ceil((max.getTime() - min.getTime()) / 86400000) + 1);
    return { start: min, days: Math.min(days, 60) };
  }, [tasks]);

  const onStatusChange = async (taskId: string, status: string) => {
    await pmApi.updateTaskStatus(taskId, status);
    loadTasks(projectId || undefined);
  };

  const onReschedule = useCallback(
    async (taskId: string, startDate: string, dueDate: string) => {
      await pmApi.updateTask(taskId, { startDate, dueDate });
      loadTasks(projectId || undefined);
    },
    [projectId],
  );

  const handleSaveTitle = async (taskId: string) => {
    if (!titleEdit.trim()) return;
    await pmApi.updateTask(taskId, { title: titleEdit.trim() });
    setEditingTaskId(null);
    loadTasks(projectId || undefined);
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Delete task "${title}"?`)) return;
    await pmApi.deleteTask(taskId);
    loadTasks(projectId || undefined);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium text-slate-700 flex items-center gap-2">
          Project
          <select
            className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 ${view === "d3" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
            onClick={() => setView("d3")}
          >
            D3 Gantt
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 ${view === "table" ? "bg-blue-600 text-white" : "bg-white text-slate-600"}`}
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>
        {projectId && (
          <Link
            href={`/projects/${projectId}`}
            className="text-[12px] text-blue-600 hover:text-blue-700 hover:underline"
          >
            Open project detail →
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading Gantt data…</p>
      ) : view === "d3" ? (
        <div className="border border-slate-200 rounded-lg bg-white overflow-x-auto shadow-card p-4">
          {tasks.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No tasks defined yet.</p>
          ) : (
            <D3GanttChart
              tasks={tasks}
              rangeStart={range.start}
              rangeDays={range.days}
              onReschedule={onReschedule}
            />
          )}
          <p className="text-[11px] text-slate-500 mt-2">Drag task bars to reschedule dates.</p>
        </div>
      ) : (
        <div className="border border-slate-200 rounded-lg bg-white shadow-card divide-y divide-slate-100">
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-2">
              <div className="flex-1 min-w-0">
                {editingTaskId === t.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 text-sm border border-slate-200 rounded px-2 py-1"
                      value={titleEdit}
                      onChange={(e) => setTitleEdit(e.target.value)}
                    />
                    <button
                      onClick={() => handleSaveTitle(t.id)}
                      className="text-xs px-2 py-1 rounded bg-blue-600 text-white"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTaskId(null)}
                      className="text-xs px-2 py-1 rounded border"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-slate-900">{t.title}</p>
                    <p className="text-xs text-slate-500">
                      {t.startDate?.slice(0, 10)} → {t.dueDate?.slice(0, 10) || "—"}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={t.status}
                  onChange={(e) => onStatusChange(t.id, e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-1"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {editingTaskId !== t.id && (
                  <>
                    <button
                      onClick={() => {
                        setEditingTaskId(t.id);
                        setTitleEdit(t.title);
                      }}
                      className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                      title="Edit task"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(t.id, t.title)}
                      className="p-1.5 rounded text-red-500 hover:bg-red-50"
                      title="Delete task"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
