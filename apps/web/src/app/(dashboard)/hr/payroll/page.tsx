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
          <div className="h-8 w-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {rec.employeeName.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="font-semibold text-slate-900">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Pay Period",
      cell: (rec) => (
        <span className="text-[12px] font-medium text-slate-600 bg-slate-100 rounded px-2 py-0.5">
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
              className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1 text-[12px] font-medium text-slate-700 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
            >
              <Download size={12} />
              Payslip
            </button>
          );
        }
        return <span className="text-slate-300">—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet size={18} className="text-slate-400" />
            Payroll
          </h1>
          <p className="page-subtitle mt-1">Gross-to-net calculation, batch runs and payslips</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-md px-3 py-1.5 bg-white">
            <Calendar size={14} className="text-slate-400" />
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Total Gross</p>
          <p className="text-2xl font-semibold text-slate-900">{formatINR(totalGross)}</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 mb-1.5">Net Pay</p>
          <p className="text-2xl font-semibold text-emerald-700">{formatINR(totalNet)}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-100 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-red-500 mb-1.5">Deductions</p>
          <p className="text-2xl font-semibold text-red-600">{formatINR(totalDeductions)}</p>
        </div>
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5">Processed</p>
          <p className="text-2xl font-semibold text-slate-900">{processedCount} / {records.length}</p>
        </div>
      </div>

      <DataTable data={records} columns={columns} keyExtractor={(rec) => rec.id} emptyMessage="No payroll records for this period yet." />

      <PayslipModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
}
