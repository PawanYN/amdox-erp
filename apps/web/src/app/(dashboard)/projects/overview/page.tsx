"use client";

import { PROJECTS } from "@/lib/mock/pm-v2";

function StatusPill({ status }: { status: string }) {
  const styles =
    status === "On Track"
      ? "bg-[#2F6B4F]/10 text-[#2F6B4F]"
      : "bg-[#B4533B]/10 text-[#B4533B]";
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles}`}>
      {status}
    </span>
  );
}

export default function ProjectsOverviewPage() {
  return (
    <div className="space-y-3">
      {PROJECTS.map((p) => (
        <div key={p.name} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#14171F]">{p.name}</p>
              <p className="text-[12px] text-[#8A8678] mt-0.5">Owner: {p.owner}</p>
            </div>
            <StatusPill status={p.status} />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1E3A5F] rounded-full"
                style={{ width: `${p.pct}%` }}
              />
            </div>
            <span className="text-[12px] font-mono text-[#6B675D] w-10 text-right">
              {p.pct}%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-[#8A8678]">
            <span>
              Budget: <span className="font-mono text-[#4A4740]">${p.budget.toLocaleString()}</span>
            </span>
            <span>
              Spent: <span className="font-mono text-[#4A4740]">${p.spent.toLocaleString()}</span>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
