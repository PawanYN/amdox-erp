"use client";

import { useState, useEffect } from "react";
import { TrendingDown, Plus, Receipt, AlertTriangle, CheckCircle2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";

type BackendInvoice = {
  id: string; invoiceNumber: string; vendorId: string;
  issueDate: string; dueDate: string; totalAmount: string | number; status: string; type: string;
};

const STATUS_TONE: Record<string, "approved" | "pending" | "rejected" | "processed" | "inactive"> = {
  PAID:          "processed",
  APPROVED:      "approved",
  PENDING_MATCH: "pending",
  OVERDUE:       "rejected",
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchInvoices = async () => {
    try { setLoading(true); setInvoices(await financeApi.getInvoices()); }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleApprove = async (id: string) => {
    try { await financeApi.approveInvoice(id); fetchInvoices(); }
    catch (err) { console.error("Approval failed", err); }
  };

  const totalAmount    = invoices.reduce((a, i) => a + Number(i.totalAmount), 0);
  const pendingCount   = invoices.filter((i) => i.status === "PENDING_MATCH").length;
  const approvedAmount = invoices.filter((i) => ["APPROVED","PAID"].includes(i.status))
                                  .reduce((a, i) => a + Number(i.totalAmount), 0);

  const columns: ColumnDef<BackendInvoice>[] = [
    {
      header: "Invoice #",
      cell: (inv) => (
        <span className="font-mono text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
          {inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor",
      cell: (inv) => <span className="text-[13px] text-slate-700">{inv.vendorId || "—"}</span>,
    },
    {
      header: "Issued",
      cell: (inv) => <span className="text-[13px] text-slate-500">{new Date(inv.issueDate).toLocaleDateString("en-IN")}</span>,
    },
    {
      header: "Due Date",
      cell: (inv) => {
        const overdue = new Date(inv.dueDate) < new Date() && inv.status !== "PAID";
        return (
          <span className={`text-[13px] ${overdue ? "text-red-600 font-medium" : "text-slate-500"}`}>
            {new Date(inv.dueDate).toLocaleDateString("en-IN")}
          </span>
        );
      },
    },
    {
      header: "Amount",
      cell: (inv) => <span className="font-mono font-semibold text-slate-900">₹{Number(inv.totalAmount).toLocaleString()}</span>,
    },
    {
      header: "Status",
      cell: (inv) => <Badge tone={STATUS_TONE[inv.status] || "inactive"}>{inv.status.replace("_", " ")}</Badge>,
    },
    {
      header: "Action",
      cell: (inv) =>
        inv.status === "PENDING_MATCH" ? (
          <Button size="sm" variant="outline" onClick={() => handleApprove(inv.id)} icon={<Check size={13} />}>
            Approve
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingDown size={18} className="text-slate-400" />
            AP Invoices
          </h1>
          <p className="page-subtitle mt-1">Vendor invoices auto-generated via SCM 3-way match. Approve manually if match fails.</p>
        </div>
        <Button icon={<Plus size={14} />}>New Invoice</Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total AP"         value={`₹${totalAmount.toLocaleString()}`}    icon={<Receipt size={16} />}       gradient="from-violet-500 to-violet-600" delay="0s" />
        <StatCard label="Approved / Paid"  value={`₹${approvedAmount.toLocaleString()}`} icon={<CheckCircle2 size={16} />}  gradient="from-emerald-500 to-emerald-600" delay="0.05s" />
        <StatCard label="Pending Approval" value={pendingCount}                           icon={<AlertTriangle size={16} />} gradient="from-amber-400 to-amber-500"   delay="0.1s" />
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        keyExtractor={(inv) => inv.id}
        emptyMessage={loading ? "Loading invoices…" : "No AP invoices found."}
      />
    </div>
  );
}
