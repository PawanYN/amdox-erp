"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { D3GanttChart } from "@/components/pm/d3-gantt-chart";

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
    try {
      await pmApi.updateTaskStatus(taskId, status);
      loadTasks(projectId || undefined);
    } catch (e) {
      console.error("Failed to update task status:", e);
      alert(e instanceof Error ? e.message : "Failed to update task status");
    }
  };

  const onReschedule = useCallback(
    async (taskId: string, startDate: string, dueDate: string) => {
      try {
        await pmApi.updateTask(taskId, { startDate, dueDate });
        loadTasks(projectId || undefined);
      } catch (e) {
        console.error("Failed to reschedule task:", e);
        alert(e instanceof Error ? e.message : "Failed to reschedule task");
      }
    },
    [projectId],
  );

  const handleSaveTitle = async (taskId: string) => {
    if (!titleEdit.trim()) return;
    try {
      await pmApi.updateTask(taskId, { title: titleEdit.trim() });
      setEditingTaskId(null);
      loadTasks(projectId || undefined);
    } catch (e) {
      console.error("Failed to update task title:", e);
      alert(e instanceof Error ? e.message : "Failed to update task title");
    }
  };

  const handleDeleteTask = async (taskId: string, title: string) => {
    if (!confirm(`Delete task "${title}"?`)) return;
    try {
      await pmApi.deleteTask(taskId);
      loadTasks(projectId || undefined);
    } catch (e) {
      console.error("Failed to delete task:", e);
      alert(e instanceof Error ? e.message : "Failed to delete task");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[13px] font-medium flex items-center gap-2" style={{color: '#2b2f36'}}>
          Project
          <select
            className="text-sm rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 border"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-md border overflow-hidden text-xs" style={{borderColor: '#dfe3e8'}}>
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors`}
            style={{
              backgroundColor: view === "d3" ? '#1f5fa8' : '#fff',
              color: view === "d3" ? '#fff' : '#2b2f36'
            }}
            onClick={() => setView("d3")}
          >
            D3 Gantt
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 transition-colors`}
            style={{
              backgroundColor: view === "table" ? '#1f5fa8' : '#fff',
              color: view === "table" ? '#fff' : '#2b2f36'
            }}
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>
        {projectId && (
          <Link
            href={`/projects/${projectId}`}
            className="text-[12px] hover:underline"
            style={{color: '#1f5fa8'}}
          >
            Open project detail →
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm" style={{color: '#6b7280'}}>Loading Gantt data…</p>
      ) : view === "d3" ? (
        <div className="rounded-lg bg-white overflow-x-auto p-4 border" style={{borderColor: '#dfe3e8'}}>
          {tasks.length === 0 ? (
            <p className="p-6 text-sm text-center" style={{color: '#6b7280'}}>No tasks defined yet.</p>
          ) : (
            <D3GanttChart
              tasks={tasks}
              rangeStart={range.start}
              rangeDays={range.days}
              onReschedule={onReschedule}
            />
          )}
          <p className="text-[11px] mt-2" style={{color: '#6b7280'}}>Drag task bars to reschedule dates.</p>
        </div>
      ) : (
        <div className="rounded-lg bg-white divide-y border" style={{borderColor: '#dfe3e8'}}>
          {tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between px-4 py-3 gap-2 hover:opacity-95 transition-opacity" style={{borderBottomColor: '#f0f0f0'}}>
              <div className="flex-1 min-w-0">
                {editingTaskId === t.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      className="flex-1 text-sm rounded px-2 py-1 border"
                      value={titleEdit}
                      onChange={(e) => setTitleEdit(e.target.value)}
                      style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                    />
                    <button
                      onClick={() => handleSaveTitle(t.id)}
                      className="text-xs px-2 py-1 rounded"
                      style={{background: '#1f5fa8', color: '#fff'}}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingTaskId(null)}
                      className="text-xs px-2 py-1 rounded border"
                      style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-medium" style={{color: '#2b2f36'}}>{t.title}</p>
                    <p className="text-xs" style={{color: '#6b7280'}}>
                      {t.startDate?.slice(0, 10)} → {t.dueDate?.slice(0, 10) || "—"}
                    </p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={t.status}
                  onChange={(e) => onStatusChange(t.id, e.target.value)}
                  className="text-xs rounded px-2 py-1 border"
                  style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
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
                      className="p-1.5 rounded hover:opacity-80 transition-opacity"
                      style={{color: '#6b7280'}}
                      title="Edit task"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteTask(t.id, t.title)}
                      className="p-1.5 rounded hover:opacity-80 transition-opacity"
                      style={{color: '#d9534f'}}
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
