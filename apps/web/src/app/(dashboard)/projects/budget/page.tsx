"use client";

import { useEffect, useState } from "react";
import { pmApi } from "@/lib/api/pm-api";

export default function ProjectsBudgetPage() {
  const [budgets, setBudgets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pmApi
      .getBudgets()
      .then(setBudgets)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading budgets…</p>;

  return (
    <div className="space-y-3">
      {budgets.length === 0 ? (
        <p className="text-sm text-muted">No project budgets set yet.</p>
      ) : (
        budgets.map((b) => (
          <div
            key={b.id}
            className="border border-[#E4E2DC] rounded-lg p-4 bg-white"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium text-[#14171F]">{b.project?.name}</p>
                <p className="text-[12px] text-[#8A8678]">
                  Planned ₹{b.plannedAmount.toLocaleString()} · Actual ₹
                  {b.actualAmount.toLocaleString()}
                </p>
              </div>
              {b.isOverrun && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#B4533B]/10 text-[#B4533B]">
                  Overrun alert
                </span>
              )}
            </div>
            <div className="mt-2 text-[12px] font-mono text-[#6B675D]">
              Variance: {b.variancePct}%
            </div>
          </div>
        ))
      )}
    </div>
  );
}
