"use client";

import { AlertTriangle } from "lucide-react";
import { PEOPLE, WEEKS, HEATMAP } from "@/lib/mock/pm-v2";

function heatColor(val: number) {
  if (val >= 105) return "bg-[#B4533B] text-white";
  if (val >= 90) return "bg-[#E0A458]/80 text-[#14171F]";
  if (val >= 60) return "bg-[#1E3A5F]/20 text-[#14171F]";
  return "bg-[#1E3A5F]/5 text-[#8A8678]";
}

export default function ProjectsResourcesPage() {
  return (
    <div className="border border-[#E4E2DC] rounded-lg bg-white p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[12px] text-[#8A8678]">Utilisation % — color shows overload risk</p>
        <div className="flex items-center gap-3 text-[11px] text-[#8A8678]">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1E3A5F]/5" /> Light</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1E3A5F]/20" /> Normal</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#E0A458]/80" /> High</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#B4533B]" /> Overloaded</span>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: `140px repeat(${WEEKS.length}, 1fr)` }}>
        <div />
        {WEEKS.map((w) => (
          <div key={w} className="text-center text-[11px] text-[#8A8678] pb-2 font-mono">{w}</div>
        ))}
        {PEOPLE.map((person, r) => (
          <div key={person} className="contents">
            <div className="text-[13px] text-[#14171F] py-1.5 flex items-center gap-1.5">
              {person}
              {HEATMAP[r].some((v) => v >= 105) && (
                <AlertTriangle size={12} className="text-[#B4533B]" />
              )}
            </div>
            {HEATMAP[r].map((val, c) => (
              <div key={c} className="p-0.5">
                <div className={`h-8 rounded-md flex items-center justify-center text-[11px] font-mono ${heatColor(val)}`}>
                  {val}%
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
