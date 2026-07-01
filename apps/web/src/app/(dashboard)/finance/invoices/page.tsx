"use client";

import { useState, useEffect } from "react";
import {
  FileText,
  Plus,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Check,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";

/**
 * WHAT: AP Invoices page — shows all vendor invoices fetched from the backend.
 * WHY: Accounts Payable is the record of money owed to suppliers. This page
 * lets finance users see invoice status and manually approve invoices that
 * failed the automatic 3-way match (SCM → AP → GL flow).
 *
 * BACKEND FLOW:
 *   1. SCM triggers goods receipt → BullMQ event → AP Service auto-generates invoice.
 *   2. If 3-way match passes, invoice is auto-approved.
 *   3. If it fails, the "Manual Approve" button here triggers POST /finance/ap/invoices/:id/approve.
 *   4. Approval emits invoice.approved → GL posts Debit AP / Credit Cash.
 *
 * ENDPOINTS:
 *   GET  /finance/ap/invoices
 *   POST /finance/ap/invoices/:id/approve
 */

type BackendInvoice = {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string | number;
  status: string;
  type: string;
};

const STATUS_TONE: Record<string, "positive" | "info" | "caution" | "critical" | "neutral"> = {
  PAID:          "positive",
  APPROVED:      "info",
  PENDING_MATCH: "caution",
  OVERDUE:       "critical",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await financeApi.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await financeApi.approveInvoice(id);
      fetchInvoices();
    } catch (err) {
      console.error("Approval failed", err);
    }
  };

  const totalAmount    = invoices.reduce((acc, i) => acc + Number(i.totalAmount), 0);
  const pendingCount   = invoices.filter(i => i.status === "PENDING_MATCH").length;
  const approvedAmount = invoices.filter(i => i.status === "APPROVED" || i.status === "PAID")
                                 .reduce((acc, i) => acc + Number(i.totalAmount), 0);

  const columns: ColumnDef<BackendInvoice>[] = [
    {
      header: "Invoice #",
      cell: invoice => (
        <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
          {invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor ID",
      cell: invoice => <span className="font-medium text-ink text-sm">{invoice.vendorId || "—"}</span>,
    },
    {
      header: "Date Issued",
      cell: invoice => (
        <span className="text-sm text-muted">{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</span>
      ),
    },
    {
      header: "Due Date",
      cell: invoice => {
        const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== "PAID";
        return (
          <span className={`text-sm ${isOverdue ? "text-rose-600 font-medium" : "text-muted"}`}>
            {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
          </span>
        );
      },
    },
    {
      header: "Amount",
      cell: invoice => (
        <span className="font-mono font-medium text-ink">
          ₹{Number(invoice.totalAmount).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Status",
      cell: invoice => (
        <Badge tone={STATUS_TONE[invoice.status] || "neutral"}>
          {invoice.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Action",
      cell: invoice => (
        invoice.status === "PENDING_MATCH" ? (
          <Button size="sm" variant="outline" onClick={() => handleApprove(invoice.id)} icon={<Check size={14} />}>
            Manual Approve
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
              <TrendingDown size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">AP Invoices (Payable)</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Vendor invoices auto-generated via SCM 3-way match. Approve manually if match fails.
          </p>
        </div>
        <Button icon={<Plus size={16} />}>New Invoice</Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total AP"          value={`₹${totalAmount.toLocaleString()}`}    icon={<Receipt size={18} />}       gradient="from-violet-500 to-fuchsia-600" delay="0.05s" />
        <StatCard label="Approved / Paid"   value={`₹${approvedAmount.toLocaleString()}`} icon={<CheckCircle2 size={18} />}  gradient="from-emerald-400 to-teal-500"   delay="0.10s" />
        <StatCard label="Pending Approval"  value={pendingCount}                           icon={<AlertTriangle size={18} />} gradient="from-amber-400 to-orange-500"   delay="0.15s" />
      </div>

      {/* ── Table ── */}
      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable
          data={invoices}
          columns={columns}
          keyExtractor={invoice => invoice.id}
          emptyMessage={loading ? "Loading invoices…" : "No AP invoices found."}
        />
      </div>
    </div>
  );
}
