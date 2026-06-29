"use client";

import { useState } from "react";
import { FileText, Plus, Receipt, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockInvoices } from "@/lib/mock/finance";
import { Invoice } from "@/lib/types";



const columns: ColumnDef<Invoice>[] = [
  {
    header: "Invoice ID",
    cell: (invoice) => (
      <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
        {invoice.id}
      </span>
    ),
  },
  {
    header: "Client",
    cell: (invoice) => (
      <>
        <span className="font-semibold text-ink">{invoice.clientName}</span>
        <p className="text-xs text-muted">{invoice.clientId}</p>
      </>
    ),
  },
  {
    header: "Date Issued",
    cell: (invoice) => <span className="text-sm text-muted">{invoice.date}</span>,
  },
  {
    header: "Due Date",
    cell: (invoice) => (
      <span className={`text-sm ${invoice.status === "Overdue" ? "text-rose-600 font-medium" : "text-muted"}`}>
        {invoice.dueDate}
      </span>
    ),
  },
  {
    header: "Amount",
    className: "font-medium text-ink",
    cell: (invoice) => `$${invoice.amount.toLocaleString()}`,
  },
  {
    header: "Status",
    cell: (invoice) => (
      <Badge tone={
        invoice.status === "Paid" ? "positive" :
        invoice.status === "Overdue" ? "critical" :
        invoice.status === "Sent" ? "info" : "neutral"
      }>
        {invoice.status}
      </Badge>
    ),
  },
];

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>(mockInvoices);

  const totalInvoices = invoices.length;
  const totalAmount = invoices.reduce((acc, curr) => acc + curr.amount, 0);
  const overdueAmount = invoices.filter(i => i.status === "Overdue").reduce((acc, curr) => acc + curr.amount, 0);

  const handleCreateInvoice = () => {
    // Stub
    console.log("Create Invoice clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
              <FileText size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Invoices</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Track client invoices, payments, and overdue amounts
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleCreateInvoice}>
          New Invoice
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Invoices" value={totalInvoices} icon={<Receipt size={18} />} gradient="from-violet-500 to-fuchsia-600" delay="0.05s" />
        <StatCard label="Total Amount" value={`$${totalAmount.toLocaleString()}`} icon={<CheckCircle2 size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Overdue Amount" value={`$${overdueAmount.toLocaleString()}`} icon={<AlertTriangle size={18} />} gradient="from-rose-400 to-red-500" delay="0.15s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable data={invoices} columns={columns} keyExtractor={(invoice) => invoice.id} emptyMessage="No invoices found." />
      </div>
    </div>
  );
}
