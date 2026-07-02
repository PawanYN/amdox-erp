"use client";

import { useEffect, useState } from "react";
import { pmApi } from "@/lib/api/pm-api";

export default function ProjectsTasksPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmApi
      .getTasks()
      .then(setTasks)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading Gantt data…</p>;

  const totalDays = 30;
  const origin = new Date();
  origin.setDate(origin.getDate() - 1);

  const toDayIndex = (d: string | Date | null | undefined) => {
    if (!d) return 0;
    const diff = Math.floor(
      (new Date(d).getTime() - origin.getTime()) / 86400000,
    );
    return Math.max(0, Math.min(totalDays - 1, diff));
  };

  return (
    <div className="border border-[#E4E2DC] rounded-lg bg-white overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex border-b border-[#E4E2DC] text-[11px] text-[#8A8678] py-2 px-3">
          <span className="w-48 shrink-0">Task</span>
          <div
            className="flex-1 grid"
            style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}
          >
            {Array.from({ length: totalDays }).map((_, i) => (
              <span key={i} className="text-center">
                D{i + 1}
              </span>
            ))}
          </div>
        </div>
        {tasks.length === 0 ? (
          <p className="p-4 text-sm text-muted">No tasks defined yet.</p>
        ) : (
          tasks.map((t) => {
            const start = toDayIndex(t.startDate);
            const end = toDayIndex(t.dueDate || t.startDate);
            const len = Math.max(1, end - start + 1);
            return (
              <div
                key={t.id}
                className="flex items-center py-2 px-3 border-b border-[#F0EEE7] last:border-0"
              >
                <span className="w-48 shrink-0 text-[12px] text-[#14171F] truncate pr-2">
                  {t.title}
                </span>
                <div
                  className="flex-1 grid relative h-5"
                  style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}
                >
                  <div
                    className="absolute h-4 top-0.5 rounded-md bg-[#1E3A5F] opacity-90"
                    style={{
                      left: `${(start / totalDays) * 100}%`,
                      width: `${(len / totalDays) * 100}%`,
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
        Gantt timeline from task start/due dates (F-07). Dependencies validated as DAG on create.
      </div>
    </div>
  );
}
