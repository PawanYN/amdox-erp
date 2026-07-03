"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";

type BudgetLine = {
  id: string;
  description: string;
  amount: number;
  sourceModule: string | null;
  sourceId: string | null;
};

type Budget = {
  id: string;
  project?: { name: string };
  plannedAmount: number;
  actualAmount: number;
  variancePct: number;
  isOverrun: boolean;
};

function BudgetCard({ b }: { b: Budget }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loadingLines, setLoadingLines] = useState(false);

  const toggle = async () => {
    if (!open && lines.length === 0) {
      setLoadingLines(true);
      try {
        const data = await pmApi.getBudgetLines(b.id);
        setLines(data);
      } finally {
        setLoadingLines(false);
      }
    }
    setOpen((v) => !v);
  };

  return (
    <div className="border border-[#E4E2DC] rounded-lg bg-white overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-[#14171F]">{b.project?.name}</p>
            <p className="text-[12px] text-[#8A8678]">
              Planned ₹{b.plannedAmount.toLocaleString()} · Actual ₹
              {b.actualAmount.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {b.isOverrun && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#B4533B]/10 text-[#B4533B]">
                Overrun alert
              </span>
            )}
            <button
              onClick={toggle}
              className="text-[#8A8678] hover:text-[#14171F] p-1"
              title="Show cost lines"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>
        <div className="mt-2 text-[12px] font-mono text-[#6B675D]">
          Variance: {b.variancePct}%
        </div>

        {/* Progress bar */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${b.isOverrun ? "bg-[#B4533B]" : "bg-[#1E3A5F]"}`}
              style={{
                width: `${b.plannedAmount > 0 ? Math.min((b.actualAmount / b.plannedAmount) * 100, 100) : 0}%`,
              }}
            />
          </div>
          <span className="text-[11px] font-mono text-[#6B675D] w-8 text-right">
            {b.plannedAmount > 0
              ? Math.round((b.actualAmount / b.plannedAmount) * 100)
              : 0}
            %
          </span>
        </div>
      </div>

      {/* Budget lines drill-down */}
      {open && (
        <div className="border-t border-[#F0EEE7] bg-[#FAFAF9] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#8A8678] mb-2">
            Cost lines (auto-posted from AP invoices &amp; payroll)
          </p>
          {loadingLines ? (
            <p className="text-[12px] text-muted">Loading…</p>
          ) : lines.length === 0 ? (
            <p className="text-[12px] text-[#8A8678]">
              No cost lines yet. Approve an AP invoice linked to this project or
              run payroll to see entries here.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[#8A8678]">
                  <th className="text-left pb-1">Description</th>
                  <th className="text-left pb-1">Source</th>
                  <th className="text-right pb-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-[#F0EEE7]">
                    <td className="py-1 text-[#4A4740]">{line.description}</td>
                    <td className="py-1 text-[#8A8678] font-mono">
                      {line.sourceModule ?? "—"}
                    </td>
                    <td className="py-1 text-right font-mono text-[#14171F]">
                      ₹{Number(line.amount).toLocaleString()}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[#D8D5CC]">
                  <td colSpan={2} className="pt-1 font-semibold text-[#4A4740]">
                    Total actual
                  </td>
                  <td className="pt-1 text-right font-mono font-semibold text-[#14171F]">
                    ₹{b.actualAmount.toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default function ProjectsBudgetPage() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
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
        budgets.map((b) => <BudgetCard key={b.id} b={b} />)
      )}
    </div>
  );
}
