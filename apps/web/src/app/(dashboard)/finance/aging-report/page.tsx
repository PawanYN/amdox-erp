"use client";

import { useState, useEffect } from "react";
import { CalendarClock, AlertOctagon, BarChart2 } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";

const BUCKETS = [
  { key: "0-30",  label: "0–30 days",  color: "bg-emerald-500", textColor: "text-emerald-700" },
  { key: "31-60", label: "31–60 days", color: "bg-blue-500",    textColor: "text-blue-700" },
  { key: "61-90", label: "61–90 days", color: "bg-amber-500",   textColor: "text-amber-700" },
  { key: "90+",   label: "90+ days",   color: "bg-red-500",     textColor: "text-red-700" },
] as const;

export default function AgingReportPage() {
  const [report, setReport] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    financeApi.getAgingReport().then(setReport).finally(() => setLoading(false));
  }, []);

  const bucketTotals = BUCKETS.map((b) => report[b.key] ?? 0);
  const grandTotal   = bucketTotals.reduce((a, b) => a + b, 0);
  const overdue      = bucketTotals[1] + bucketTotals[2] + bucketTotals[3];
  const maxVal       = Math.max(...bucketTotals, 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <CalendarClock size={18} className="text-slate-400" />
          AR Aging Report
        </h1>
        <p className="page-subtitle mt-1">Outstanding receivables bucketed by age</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-lg">
          {[0,1].map(i => <div key={i} className="h-24 rounded-lg bg-slate-100 animate-pulse" />)}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 max-w-lg">
            <StatCard label="Total Outstanding" value={`₹${grandTotal.toLocaleString()}`} icon={<BarChart2 size={16} />} gradient="from-blue-500 to-blue-600" delay="0s" />
            <StatCard label="Overdue 31+ days"  value={`₹${overdue.toLocaleString()}`}    icon={<AlertOctagon size={16} />} gradient="from-red-400 to-red-500" delay="0.05s" />
          </div>

          {/* Bucket breakdown */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-card p-6">
            <p className="text-[12px] font-semibold text-slate-500 uppercase tracking-wider mb-5">Aging Buckets</p>
            <div className="space-y-4">
              {BUCKETS.map((b, i) => (
                <div key={b.key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-slate-700">{b.label}</span>
                    <span className={`text-[13px] font-mono font-semibold ${b.textColor}`}>
                      ₹{bucketTotals[i].toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${b.color} transition-all duration-500`}
                      style={{ width: `${(bucketTotals[i] / maxVal) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {BUCKETS.map((b, i) => (
              <div key={b.key} className="bg-white rounded-lg border border-slate-200 shadow-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${b.color}`} />
                  <span className="text-[11px] text-slate-500 font-medium">{b.label}</span>
                </div>
                <p className="text-xl font-semibold font-mono text-slate-900">
                  ₹{bucketTotals[i].toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
