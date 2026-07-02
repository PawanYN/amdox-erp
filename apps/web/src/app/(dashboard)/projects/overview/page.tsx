"use client";

import { useEffect, useState } from "react";
import { pmApi } from "@/lib/api/pm-api";

function StatusPill({ overrun }: { overrun: boolean }) {
  const styles = overrun
    ? "bg-[#B4533B]/10 text-[#B4533B]"
    : "bg-[#2F6B4F]/10 text-[#2F6B4F]";
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles}`}>
      {overrun ? "Over budget" : "On track"}
    </span>
  );
}

export default function ProjectsOverviewPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pmApi
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading projects…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        No projects yet. Create one from Projects → New Project.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <div key={p.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#14171F]">{p.name}</p>
              <p className="text-[12px] text-[#8A8678] mt-0.5">
                {p.taskCount} tasks · {p.milestoneCount} milestones · {p.status}
              </p>
            </div>
            <StatusPill overrun={p.budgetOverrun} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1E3A5F] rounded-full"
                style={{ width: `${Math.min(p.budgetPct, 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono text-[#6B675D] w-10 text-right">
              {p.budgetPct}%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-[#8A8678]">
            <span>
              Budget:{" "}
              <span className="font-mono text-[#4A4740]">
                ₹{p.budgetPlanned.toLocaleString()}
              </span>
            </span>
            <span>
              Spent:{" "}
              <span className="font-mono text-[#4A4740]">
                ₹{p.budgetActual.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
