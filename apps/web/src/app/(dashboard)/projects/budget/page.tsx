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

  const pct = b.plannedAmount > 0 ? Math.round((b.actualAmount / b.plannedAmount) * 100) : 0;

  return (
    <div className={`border rounded-lg bg-white overflow-hidden shadow-card ${b.isOverrun ? "border-red-200" : "border-slate-200"}`}>
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold text-slate-900">{b.project?.name}</p>
            <p className="text-[12px] text-slate-400 mt-0.5">
              Planned ₹{b.plannedAmount.toLocaleString()} · Actual ₹{b.actualAmount.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {b.isOverrun && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium">
                Overrun
              </span>
            )}
            <button
              onClick={toggle}
              className="text-slate-400 hover:text-slate-700 p-1 rounded transition-colors"
              title="Show cost lines"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${b.isOverrun ? "bg-red-500" : "bg-blue-600"}`}
              style={{ width: `${b.plannedAmount > 0 ? Math.min((b.actualAmount / b.plannedAmount) * 100, 100) : 0}%` }}
            />
          </div>
          <span className={`text-[12px] font-mono font-semibold w-10 text-right ${b.isOverrun ? "text-red-600" : "text-slate-600"}`}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Budget lines drill-down */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Cost lines (auto-posted from AP invoices &amp; payroll)
          </p>
          {loadingLines ? (
            <p className="text-[12px] text-slate-400">Loading…</p>
          ) : lines.length === 0 ? (
            <p className="text-[12px] text-slate-400">
              No cost lines yet. Approve an AP invoice linked to this project or run payroll to see entries here.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left pb-1.5 font-medium">Description</th>
                  <th className="text-left pb-1.5 font-medium">Source</th>
                  <th className="text-right pb-1.5 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-t border-slate-100">
                    <td className="py-1.5 text-slate-700">{line.description}</td>
                    <td className="py-1.5 text-slate-400 font-mono">{line.sourceModule ?? "—"}</td>
                    <td className="py-1.5 text-right font-mono text-slate-900">₹{Number(line.amount).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t border-slate-200">
                  <td colSpan={2} className="pt-2 font-semibold text-slate-700">Total actual</td>
                  <td className="pt-2 text-right font-mono font-semibold text-slate-900">₹{b.actualAmount.toLocaleString()}</td>
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
    pmApi.getBudgets().then(setBudgets).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-400">Loading budgets…</p>;

  return (
    <div className="space-y-3">
      {budgets.length === 0 ? (
        <p className="text-sm text-slate-400">No project budgets set yet.</p>
      ) : (
        budgets.map((b) => <BudgetCard key={b.id} b={b} />)
      )}
    </div>
  );
}
