"use client";
import { useRoles } from "@/lib/use-roles";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import {
  Play,
  Loader2,
  Download,
  Wallet,
  DollarSign,
  TrendingDown,
  CheckCircle,
  RefreshCw,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { PayrollRecord } from "@/lib/types/hr";
import { PayslipModal } from "./payslip-modal";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import { hrApi } from "@/lib/api/hr-api";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function defaultPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function PayrollPage() {
  const { canWrite } = useRoles();
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
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to run payroll", "error");
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
          <div style={{background: '#1f5fa8'}} className="h-8 w-8 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0">
            {rec.employeeName
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)}
          </div>
          <span style={{color: '#2b2f36'}} className="font-semibold">{rec.employeeName}</span>
        </div>
      ),
    },
    {
      header: "Pay Period",
      cell: (rec) => (
        <span style={{color: '#2b2f36', background: '#f7f9fb', border: '1px solid #dfe3e8'}} className="text-[12px] font-medium rounded px-2 py-0.5">
          {rec.payPeriod}
        </span>
      ),
    },
    {
      header: "Gross Pay",
      className: "text-sm font-medium",
      cell: (rec) => <span style={{color: '#2b2f36'}}>{formatINR(rec.grossPay)}</span>,
    },
    {
      header: "Deductions",
      cell: (rec) => (
        <span style={{color: '#dc2626'}} className="text-sm font-semibold">-{formatINR(rec.deductions)}</span>
      ),
    },
    {
      header: "Net Pay",
      cell: (rec) => (
        <span style={{color: '#16a34a'}} className="text-sm font-bold">{formatINR(rec.netPay)}</span>
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
              style={{color: '#2b2f36', border: '1px solid #dfe3e8', background: '#f4f6f8'}}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium hover:bg-blue-50 hover:border-blue-200 transition-colors"
              onMouseEnter={(e) => {e.currentTarget.style.color = '#1f5fa8'; e.currentTarget.style.borderColor = '#1f5fa8'}}
              onMouseLeave={(e) => {e.currentTarget.style.color = '#2b2f36'; e.currentTarget.style.borderColor = '#dfe3e8'}}
            >
              <Download size={12} />
              Payslip
            </button>
          );
        }
        return <span style={{color: '#d1d5db'}}>—</span>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet size={18} style={{color: '#6b7280'}} />
            Payroll
          </h1>
          <p className="page-subtitle mt-1" style={{color: '#6b7280'}}>Gross-to-net calculation, batch runs and payslips</p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{borderColor: '#dfe3e8', background: '#ffffff'}} className="flex items-center gap-2 border rounded-md px-3 py-1.5">
            <Calendar size={14} style={{color: '#6b7280'}} />
            <input
              type="month"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="text-sm outline-none bg-transparent"
              style={{color: '#2b2f36'}}
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
          {canWrite && (
            <Button
              icon={isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              onClick={handleRunPayroll}
              disabled={isRunning}
              style={{background: '#1f5fa8', borderColor: '#1f5fa8', color: '#fff'}}
            >
              {isRunning ? "Queuing payroll…" : `Run Payroll — ${period}`}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div style={{background: '#ffffff', borderColor: '#dfe3e8'}} className="rounded-lg border shadow-card p-5">
          <p style={{color: '#6b7280'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Total Gross
          </p>
          <p style={{color: '#2b2f36'}} className="text-2xl font-semibold">{formatINR(totalGross)}</p>
        </div>
        <div style={{background: '#dcfce7', borderColor: '#bbf7d0'}} className="rounded-lg border p-5">
          <p style={{color: '#166534'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Net Pay
          </p>
          <p style={{color: '#16a34a'}} className="text-2xl font-semibold">{formatINR(totalNet)}</p>
        </div>
        <div style={{background: '#fee2e2', borderColor: '#fecaca'}} className="rounded-lg border p-5">
          <p style={{color: '#991b1b'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Deductions
          </p>
          <p style={{color: '#dc2626'}} className="text-2xl font-semibold">{formatINR(totalDeductions)}</p>
        </div>
        <div style={{background: '#ffffff', borderColor: '#dfe3e8'}} className="rounded-lg border shadow-card p-5">
          <p style={{color: '#6b7280'}} className="text-[11px] font-semibold uppercase tracking-widest mb-1.5">
            Processed
          </p>
          <p style={{color: '#2b2f36'}} className="text-2xl font-semibold">
            {processedCount} / {records.length}
          </p>
        </div>
      </div>

      <DataTable
        data={records}
        columns={columns}
        keyExtractor={(rec) => rec.id}
        emptyMessage="No payroll records for this period yet."
      />

      <PayslipModal record={previewRecord} onClose={() => setPreviewRecord(null)} />
    </div>
  );
}
