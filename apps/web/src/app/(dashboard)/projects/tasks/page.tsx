"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { pmApi } from "@/lib/api/pm-api";

const STATUSES = ["TODO", "IN_PROGRESS", "BLOCKED", "DONE"] as const;

const barColor: Record<string, string> = {
  TODO: "bg-[#8A8678]",
  IN_PROGRESS: "bg-[#1E3A5F]",
  BLOCKED: "bg-[#B4533B]",
  DONE: "bg-[#2F6B4F]",
};

function parseDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export default function ProjectsTasksPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [projectId, setProjectId] = useState("");
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
    const dates = tasks.flatMap((t) => [parseDate(t.startDate), parseDate(t.dueDate)]).filter(Boolean) as Date[];
    if (dates.length === 0) {
      const start = new Date();
      start.setDate(start.getDate() - 1);
      const end = new Date(start);
      end.setDate(end.getDate() + 29);
      return { start, end, days: 30 };
    }
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));
    min.setHours(0, 0, 0, 0);
    max.setHours(0, 0, 0, 0);
    const days = Math.max(7, Math.ceil((max.getTime() - min.getTime()) / 86400000) + 1);
    return { start: min, end: max, days: Math.min(days, 60) };
  }, [tasks]);

  const dayLabels = useMemo(() => {
    return Array.from({ length: range.days }, (_, i) => {
      const d = new Date(range.start);
      d.setDate(d.getDate() + i);
      return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    });
  }, [range]);

  const toIndex = (d: string | Date | null | undefined) => {
    const dt = parseDate(d);
    if (!dt) return 0;
    const diff = Math.floor((dt.getTime() - range.start.getTime()) / 86400000);
    return Math.max(0, Math.min(range.days - 1, diff));
  };

  const onStatusChange = async (taskId: string, status: string) => {
    await pmApi.updateTaskStatus(taskId, status);
    loadTasks(projectId || undefined);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-[12px] font-medium text-[#4A4740]">
          Project
          <select
            className="ml-2 text-sm border border-[#D8D5CC] rounded-md px-2 py-1.5"
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
        {projectId && (
          <Link
            href={`/projects/${projectId}`}
            className="text-[12px] text-[#1E3A5F] hover:underline"
          >
            Open project detail →
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading Gantt data…</p>
      ) : (
        <div className="border border-[#E4E2DC] rounded-lg bg-white overflow-x-auto">
          <div style={{ minWidth: Math.max(700, range.days * 28) }}>
            <div className="flex border-b border-[#E4E2DC] text-[10px] text-[#8A8678] py-2 px-3">
              <span className="w-52 shrink-0">Task</span>
              <div
                className="flex-1 grid"
                style={{ gridTemplateColumns: `repeat(${range.days}, minmax(24px, 1fr))` }}
              >
                {dayLabels.map((label, i) => (
                  <span key={i} className="text-center truncate px-0.5" title={label}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            {tasks.length === 0 ? (
              <p className="p-4 text-sm text-muted">No tasks defined yet.</p>
            ) : (
              tasks.map((t) => {
                const start = toIndex(t.startDate);
                const end = toIndex(t.dueDate || t.startDate);
                const len = Math.max(1, end - start + 1);
                const deps = t.dependsOn?.map((d: any) => d.prerequisiteTask?.title).filter(Boolean);
                return (
                  <div
                    key={t.id}
                    className="flex items-center py-2 px-3 border-b border-[#F0EEE7] last:border-0 gap-2"
                  >
                    <div className="w-52 shrink-0 pr-2">
                      <p className="text-[12px] text-[#14171F] truncate">{t.title}</p>
                      <p className="text-[10px] text-[#8A8678] truncate">
                        {t.project?.name}
                        {deps?.length ? ` · after ${deps.join(", ")}` : ""}
                      </p>
                      <select
                        value={t.status}
                        onChange={(e) => onStatusChange(t.id, e.target.value)}
                        className="mt-1 text-[10px] border border-[#D8D5CC] rounded px-1 py-0.5"
                      >
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      className="flex-1 grid relative h-6"
                      style={{ gridTemplateColumns: `repeat(${range.days}, minmax(24px, 1fr))` }}
                    >
                      <div
                        className={`absolute h-4 top-1 rounded-md opacity-90 ${barColor[t.status] || barColor.TODO}`}
                        style={{
                          left: `${(start / range.days) * 100}%`,
                          width: `${(len / range.days) * 100}%`,
                        }}
                        title={`${t.title}: ${t.status}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <div className="px-3 py-2 text-[11px] text-[#8A8678] border-t border-[#E4E2DC]">
            Timeline auto-scales to task dates. Bar color = status. Update status inline.
          </div>
        </div>
      )}
    </div>
  );
}
