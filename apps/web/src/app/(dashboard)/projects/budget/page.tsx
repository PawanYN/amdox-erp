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
    <div
      className={`border rounded-lg bg-white overflow-hidden`}
      style={{borderColor: b.isOverrun ? '#dfe3e8' : '#dfe3e8'}}
    >
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold" style={{color: '#2b2f36'}}>{b.project?.name}</p>
            <p className="text-[12px] mt-0.5" style={{color: '#6b7280'}}>
              Planned ₹{b.plannedAmount.toLocaleString()} · Actual ₹
              {b.actualAmount.toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {b.isOverrun && (
              <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{backgroundColor: '#fff5f5', color: '#d9534f'}}>
                Overrun
              </span>
            )}
            <button
              onClick={toggle}
              className="p-1 rounded hover:opacity-80 transition-opacity"
              style={{color: '#6b7280'}}
              title="Show cost lines"
            >
              {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{backgroundColor: '#f0f0f0'}}>
            <div
              className={`h-full rounded-full transition-all duration-500`}
              style={{
                width: `${b.plannedAmount > 0 ? Math.min((b.actualAmount / b.plannedAmount) * 100, 100) : 0}%`,
                backgroundColor: b.isOverrun ? '#d9534f' : '#1f5fa8'
              }}
            />
          </div>
          <span
            className={`text-[12px] font-mono font-semibold w-10 text-right`}
            style={{color: b.isOverrun ? '#d9534f' : '#2b2f36'}}
          >
            {pct}%
          </span>
        </div>
      </div>

      {/* Budget lines drill-down */}
      {open && (
        <div className="px-4 py-3" style={{borderTop: '1px solid #dfe3e8', backgroundColor: '#f4f6f8'}}>
          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{color: '#6b7280'}}>
            Cost lines (auto-posted from AP invoices &amp; payroll)
          </p>
          {loadingLines ? (
            <p className="text-[12px]" style={{color: '#6b7280'}}>Loading…</p>
          ) : lines.length === 0 ? (
            <p className="text-[12px]" style={{color: '#6b7280'}}>
              No cost lines yet. Approve an AP invoice linked to this project or run payroll to see
              entries here.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{color: '#6b7280'}}>
                    <th className="text-left pb-1.5 font-medium">Description</th>
                    <th className="text-left pb-1.5 font-medium">Source</th>
                    <th className="text-right pb-1.5 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.id} style={{borderTop: '1px solid #dfe3e8'}}>
                      <td className="py-1.5" style={{color: '#2b2f36'}}>{line.description}</td>
                      <td className="py-1.5 font-mono" style={{color: '#6b7280'}}>
                        {line.sourceModule ?? "—"}
                      </td>
                      <td className="py-1.5 text-right font-mono" style={{color: '#2b2f36'}}>
                        ₹{Number(line.amount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                  <tr style={{borderTop: '1px solid #dfe3e8'}}>
                    <td colSpan={2} className="pt-2 font-semibold" style={{color: '#2b2f36'}}>
                      Total actual
                    </td>
                    <td className="pt-2 text-right font-mono font-semibold" style={{color: '#2b2f36'}}>
                      ₹{b.actualAmount.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
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

  if (loading) return <p className="text-sm" style={{color: '#6b7280'}}>Loading budgets…</p>;

  return (
    <div className="space-y-3">
      {budgets.length === 0 ? (
        <p className="text-sm" style={{color: '#6b7280'}}>No project budgets set yet.</p>
      ) : (
        budgets.map((b) => <BudgetCard key={b.id} b={b} />)
      )}
    </div>
  );
}
