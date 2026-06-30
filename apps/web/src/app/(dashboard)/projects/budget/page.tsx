"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { PROJECTS } from "@/lib/mock/pm-v2";

export default function ProjectsBudgetPage() {
  return (
    <div className="space-y-3">
      {PROJECTS.map((p) => {
        const variance = p.budget - p.spent;
        const isOver = variance < 0;
        const pctSpent = Math.min(100, (p.spent / p.budget) * 100);
        return (
          <div key={p.name} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#14171F]">{p.name}</p>
              <span className={`flex items-center gap-1 text-[12px] font-medium ${isOver ? "text-[#B4533B]" : "text-[#2F6B4F]"}`}>
                {isOver ? <TrendingDown size={13} /> : <TrendingUp size={13} />}
                {isOver ? "Over budget" : "Under budget"}
              </span>
            </div>
            <div className="flex items-center gap-4 text-[12px] mb-2">
              <span className="text-[#8A8678]">Planned: <span className="font-mono text-[#14171F]">${p.budget.toLocaleString()}</span></span>
              <span className="text-[#8A8678]">Actual: <span className="font-mono text-[#14171F]">${p.spent.toLocaleString()}</span></span>
              <span className="text-[#8A8678]">Variance: <span className={`font-mono ${isOver ? "text-[#B4533B]" : "text-[#2F6B4F]"}`}>
                {isOver ? "-" : "+"}${Math.abs(variance).toLocaleString()}
              </span></span>
            </div>
            <div className="h-2 bg-[#F0EEE7] rounded-full overflow-hidden relative">
              <div
                className={`h-full rounded-full ${isOver ? "bg-[#B4533B]" : "bg-[#1E3A5F]"}`}
                style={{ width: `${pctSpent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
