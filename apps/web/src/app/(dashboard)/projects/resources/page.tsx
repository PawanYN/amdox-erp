"use client";

import { useEffect, useState } from "react";
import { pmApi } from "@/lib/api/pm-api";

export default function ProjectsResourcesPage() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmApi
      .getResourceHeatmap()
      .then(setPeople)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading utilisation…</p>;

  return (
    <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
          <tr>
            <th className="text-left px-4 py-2 text-[11px] text-[#8A8678]">Person</th>
            <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Hours</th>
            <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Utilisation</th>
            <th className="text-right px-4 py-2 text-[11px] text-[#8A8678]">Projects</th>
          </tr>
        </thead>
        <tbody>
          {people.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-6 text-muted text-center">
                No resource allocations yet.
              </td>
            </tr>
          ) : (
            people.map((p) => (
              <tr key={p.employeeId} className="border-b border-[#F0EEE7]">
                <td className="px-4 py-2 font-medium">{p.name}</td>
                <td className="px-4 py-2 text-right font-mono">
                  {p.totalAllocatedHours}h
                </td>
                <td className="px-4 py-2 text-right">
                  <span
                    className={
                      p.isOverAllocated ? "text-[#B4533B]" : "text-[#2F6B4F]"
                    }
                  >
                    {p.utilisationPct}%
                  </span>
                </td>
                <td className="px-4 py-2 text-right">{p.projectCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
