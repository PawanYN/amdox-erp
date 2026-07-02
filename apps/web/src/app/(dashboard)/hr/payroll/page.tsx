"use client";

import { useState, useEffect } from "react";
import { Play, Loader2, Download, Wallet, DollarSign, TrendingDown, CheckCircle, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { PayrollRecord } from "@/lib/types";
import { PayslipModal } from "./payslip-modal";
import { useKeycloak } from "@/components/KeycloakProvider";
import { hrApi } from "@/lib/api/hr-api";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function defaultPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollPage() {
  const { token } = useKeycloak();
  const [period, setPeriod] = useState(defaultPeriod);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [previewRecord, setPreviewRecord] = useState<PayrollRecord | null>(null);

  const fetchPayroll = async () => {
    if (!token) return;
    setIsRefreshing(true);
    try {
      const { data } = await hrApi.getPayroll(period);
      setRecords(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPayroll();
  }, [token, period]);

  async function handleRunPayroll() {
    if (!token) return;
    setIsRunning(true);
    try {
      await hrApi.runPayroll(period);
      await fetchPayroll();
    } catch (e: any) {
      alert(e.message || "Failed to run payroll");
    } finally {
      setIsRunning(false);
    }
  }

  const totalGross = records.reduce((s, r) => s + r.grossPay, 0);
  const totalNet = records.reduce((s, r) => s + r.netPay, 0);
  const totalDeductions = records.reduce((s, r) => s + r.deductions, 0);
  const processedCount = records.filter((r) => r.status === "Processed").length;

  const columns: ColumnDef<PayrollRecord>[] = [
    {
      header: "Employee",
      cell: (rec) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {rec.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-semibold text-ink">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Pay Period",
      cell: (rec) => (
        <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
          {rec.payPeriod}
        </span>
      ),
    },
    {
      header: "Gross Pay",
      className: "text-sm font-medium text-ink",
      cell: (rec) => formatINR(rec.grossPay),
    },
    {
      header: "Deductions",
      cell: (rec) => (
        <span className="text-sm font-semibold text-red-500">-{formatINR(rec.deductions)}</span>
      ),
    },
    {
      header: "Net Pay",
      cell: (rec) => (
        <span className="text-sm font-bold text-emerald-700">{formatINR(rec.netPay)}</span>
      ),
    },
    {
      header: "Status",
      cell: (rec) => <Badge tone={statusToTone(rec.status)}>{rec.status}</Badge>,
    },
    {
      header: "Payslip",
      cell: (rec) => {
        if (rec.status === "Processed") {
          return (
            <button
              onClick={() => setPreviewRecord(rec)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-violet-50 border border-violet-200 px-3 py-1.5 text-xs font-semibold text-brand-purple hover:bg-violet-100 transition-all hover:shadow-sm hover:-translate-y-0.5 active:scale-95"
            >
              <Download size={12} />
              Payslip
            </button>
          );
        }
        return <span className="text-muted">—</span>;
      },
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              <Wallet size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Payroll</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Gross-to-net calculation, batch runs &amp; payslips
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-line rounded-lg px-3 py-1.5 bg-white">
            <Calendar size={14} className="text-muted" />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm outline-none bg-transparent"
            />
          </div>
          <Button
            variant="outline"
            icon={<RefreshCw size={16} className={isRefreshing ? "animate-spin" : ""} />}
            onClick={fetchPayroll}
            disabled={isRefreshing}
          >
            Refresh
          </Button>
          <Button
            icon={isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            onClick={handleRunPayroll}
            disabled={isRunning}
          >
            {isRunning ? "Queuing payroll…" : `Run Payroll — ${period}`}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Total Gross</p>
          <p className="mt-2 text-2xl font-bold text-ink">{formatINR(totalGross)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600/70">Total Net Pay</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{formatINR(totalNet)}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-gradient-to-br from-red-50 to-rose-50 p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <p className="text-xs font-bold uppercase tracking-widest text-red-500/70">Total Deductions</p>
          <p className="mt-2 text-2xl font-bold text-red-600">{formatINR(totalDeductions)}</p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all hover:-translate-y-0.5 group">
          <p className="text-xs font-bold uppercase tracking-widest text-muted/70">Processed</p>
          <p className="mt-2 text-2xl font-bold text-ink">{processedCount} / {records.length}</p>
        </div>
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={records} columns={columns} keyExtractor={(rec) => rec.id} emptyMessage="No payroll records for this period yet." />
      </div>

      <PayslipModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
}
