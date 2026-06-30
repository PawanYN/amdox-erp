"use client";

import { TASKS } from "@/lib/mock/pm-v2";

export default function ProjectsTasksPage() {
  const totalDays = 16;
  return (
    <div className="border border-[#E4E2DC] rounded-lg bg-white overflow-x-auto">
      <div className="min-w-[700px]">
        <div className="flex border-b border-[#E4E2DC] text-[11px] text-[#8A8678] py-2 px-3">
          <span className="w-48 shrink-0">Task</span>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
            {Array.from({ length: totalDays }).map((_, i) => (
              <span key={i} className="text-center">{i + 1}</span>
            ))}
          </div>
        </div>
        {TASKS.map((t) => (
          <div key={t.name} className="flex items-center py-2 px-3 border-b border-[#F0EEE7] last:border-0">
            <span className="w-48 shrink-0 text-[12px] text-[#14171F] truncate pr-2">{t.name}</span>
            <div className="flex-1 grid relative h-5" style={{ gridTemplateColumns: `repeat(${totalDays}, 1fr)` }}>
              <div
                className="absolute h-4 top-0.5 rounded-md bg-[#1E3A5F] opacity-90"
                style={{
                  left: `${(t.start / totalDays) * 100}%`,
                  width: `${(t.len / totalDays) * 100}%`,
                }}
                title={`${t.name}: day ${t.start + 1}–${t.start + t.len}`}
              />
              {t.dep !== null && (
                <div
                  className="absolute top-2 border-t border-dashed border-[#B0AC9F]"
                  style={{
                    left: `${((TASKS[t.dep].start + TASKS[t.dep].len) / totalDays) * 100}%`,
                    width: `${((t.start - (TASKS[t.dep].start + TASKS[t.dep].len)) / totalDays) * 100}%`,
                  }}
                />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 text-[11px] text-[#8A8678] border-t border-[#E4E2DC]">
        Dashed lines show DAG dependencies — a task can't start until its dependency finishes.
      </div>
    </div>
  );
}
