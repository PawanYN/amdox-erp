"use client";

import { useState, useEffect } from "react";
import { CalendarClock, AlertOctagon, BarChart } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";

const BUCKET_LABELS = ["0–30 days", "31–60 days", "61–90 days", "90+ days"];
const BUCKET_KEYS = ["0-30", "31-60", "61-90", "90+"] as const;
const BUCKET_COLORS = ["bg-[#2F6B4F]", "bg-[#1E3A5F]", "bg-[#D9A85C]", "bg-[#B4533B]"];

export default function AgingReportPage() {
  const [report, setReport] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    financeApi
      .getAgingReport()
      .then(setReport)
      .finally(() => setLoading(false));
  }, []);

  const bucketTotals = BUCKET_KEYS.map((k) => report[k] ?? 0);
  const grandTotal = bucketTotals.reduce((a, b) => a + b, 0);
  const overdue60 = bucketTotals[1] + bucketTotals[2] + bucketTotals[3];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-white">
              <CalendarClock size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">AR Aging Report</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Live data from GET /finance/ar/aging-report
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading aging report…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-2xl">
            <StatCard
              label="Total Outstanding"
              value={`₹${grandTotal.toLocaleString()}`}
              icon={<BarChart size={18} />}
              gradient="from-blue-500 to-indigo-600"
              delay="0.05s"
            />
            <StatCard
              label="Overdue (31+ days)"
              value={`₹${overdue60.toLocaleString()}`}
              icon={<AlertOctagon size={18} />}
              gradient="from-rose-400 to-red-500"
              delay="0.10s"
            />
          </div>

          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {BUCKET_LABELS.map((label, i) => (
              <div
                key={label}
                className="border border-[#E4E2DC] rounded-lg p-4"
              >
                <span
                  className={`inline-block w-2 h-2 rounded-full ${BUCKET_COLORS[i]} mr-2`}
                />
                <span className="text-[11px] text-muted">{label}</span>
                <p className="text-lg font-mono font-semibold mt-1">
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
