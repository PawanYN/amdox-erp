"use client";

import { useState } from "react";
import {
  CalendarClock,
  AlertTriangle,
  BarChart,
  AlertOctagon,
} from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";

/**
 * WHAT: AR Aging Report page for the Finance module.
 * WHY: The aging report categorises outstanding customer invoices by how long
 * they have been unpaid. This is critical for:
 *   - Prioritising which customers to chase for payment.
 *   - Calculating bad-debt provisions for financial reporting.
 *
 * BUCKETS:
 *   Current      → Not yet due
 *   1–30 days    → Mildly overdue
 *   31–60 days   → Overdue — follow up needed
 *   61–90 days   → Seriously overdue
 *   90+ days     → High risk — provision for bad debt
 *
 * BACKEND ENDPOINT (when ready):
 *   GET /finance/ar/aging-report
 *   Returns: { buckets: { label, total, customers: [] }[] }
 */

type AgingRow = {
  customer: string;
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
};

const MOCK_ROWS: AgingRow[] = [
  { customer: "Acme Corp",       current: 0,       days30: 0,      days60: 480000, days90: 0, days90Plus: 0 },
  { customer: "Stark Industries", current: 920000, days30: 0,      days60: 0,      days90: 0, days90Plus: 0 },
];

const BUCKET_COLORS = ["bg-[#2F6B4F]", "bg-[#1E3A5F]", "bg-[#D9A85C]", "bg-[#B4533B]", "bg-[#7B2D2D]"];

const BUCKET_LABELS = ["Current", "1–30 days", "31–60 days", "61–90 days", "90+ days"];

function rowTotal(row: AgingRow) {
  return row.current + row.days30 + row.days60 + row.days90 + row.days90Plus;
}

const columns: ColumnDef<AgingRow>[] = [
  {
    header: "Customer",
    cell: row => <span className="font-semibold text-ink">{row.customer}</span>,
  },
  {
    header: "Current",
    cell: row => <span className="font-mono text-muted text-sm">{row.current > 0 ? `₹${row.current.toLocaleString()}` : "—"}</span>,
  },
  {
    header: "1–30 days",
    cell: row => <span className="font-mono text-sm text-amber-600">{row.days30 > 0 ? `₹${row.days30.toLocaleString()}` : "—"}</span>,
  },
  {
    header: "31–60 days",
    cell: row => <span className="font-mono text-sm text-orange-600">{row.days60 > 0 ? `₹${row.days60.toLocaleString()}` : "—"}</span>,
  },
  {
    header: "61–90 days",
    cell: row => <span className="font-mono text-sm text-rose-500">{row.days90 > 0 ? `₹${row.days90.toLocaleString()}` : "—"}</span>,
  },
  {
    header: "90+ days",
    cell: row => <span className="font-mono font-bold text-sm text-red-600">{row.days90Plus > 0 ? `₹${row.days90Plus.toLocaleString()}` : "—"}</span>,
  },
  {
    header: "Total",
    cell: row => <span className="font-mono font-semibold text-ink">₹{rowTotal(row).toLocaleString()}</span>,
  },
];

export default function AgingReportPage() {
  const [rows] = useState<AgingRow[]>(MOCK_ROWS);

  const grandTotal = rows.reduce((s, r) => s + rowTotal(r), 0);
  const overdue60  = rows.reduce((s, r) => s + r.days60 + r.days90 + r.days90Plus, 0);

  // Bucket totals for the summary cards
  const bucketTotals = [
    rows.reduce((s, r) => s + r.current, 0),
    rows.reduce((s, r) => s + r.days30, 0),
    rows.reduce((s, r) => s + r.days60, 0),
    rows.reduce((s, r) => s + r.days90, 0),
    rows.reduce((s, r) => s + r.days90Plus, 0),
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
              <CalendarClock size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">AR Aging Report</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Outstanding customer invoices categorised by days overdue. Used for bad-debt provision and collection prioritisation.
          </p>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-2xl">
        <StatCard label="Total Outstanding" value={`₹${grandTotal.toLocaleString()}`}  icon={<BarChart size={18} />}     gradient="from-blue-500 to-indigo-600"  delay="0.05s" />
        <StatCard label="Overdue (31+ days)"  value={`₹${overdue60.toLocaleString()}`} icon={<AlertOctagon size={18} />} gradient="from-rose-400 to-red-500"     delay="0.10s" />
      </div>

      {/* ── Bucket summary bar ── */}
      <div className="mt-6 grid grid-cols-5 gap-2 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        {BUCKET_LABELS.map((label, i) => (
          <div key={label} className="border border-[#E4E2DC] rounded-lg p-3 bg-white text-center">
            <p className="text-[10px] text-muted leading-tight mb-2">{label}</p>
            <div
              className={`h-1 rounded-full mb-2 ${BUCKET_COLORS[i]}`}
              style={{ opacity: bucketTotals[i] > 0 ? 1 : 0.2 }}
            />
            <p className={`text-sm font-semibold ${bucketTotals[i] > 0 ? "text-ink" : "text-[#D8D5CC]"}`}>
              {bucketTotals[i] > 0 ? `₹${bucketTotals[i].toLocaleString()}` : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* ── Overdue alert ── */}
      {overdue60 > 0 && (
        <div className="mt-4 rounded-lg border border-[#B4533B]/30 bg-[#B4533B]/5 p-3 flex items-center gap-2 text-[12px] text-[#B4533B]">
          <AlertTriangle size={14} />
          ₹{overdue60.toLocaleString()} in invoices are 31+ days overdue — follow up required.
        </div>
      )}

      {/* ── Aging Table ── */}
      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable
          data={rows}
          columns={columns}
          keyExtractor={row => row.customer}
          emptyMessage="No aging data available."
        />
      </div>
    </div>
  );
}