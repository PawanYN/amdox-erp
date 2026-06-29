"use client";

import { useState } from "react";
import { ShoppingCart, Plus, FileText, CheckCircle2, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockPurchaseOrders } from "@/lib/mock/scm";
import { PurchaseOrder } from "@/lib/types";



const columns: ColumnDef<PurchaseOrder>[] = [
  {
    header: "PO Number",
    cell: (order) => (
      <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
        {order.id}
      </span>
    ),
  },
  {
    header: "Vendor",
    cell: (order) => (
      <>
        <span className="font-semibold text-ink">{order.vendorName}</span>
        <p className="text-xs text-muted">{order.vendorId}</p>
      </>
    ),
  },
  {
    header: "Date",
    cell: (order) => <span className="text-sm text-muted">{order.date}</span>,
  },
  {
    header: "Amount",
    className: "font-medium text-ink",
    cell: (order) => `$${order.amount.toLocaleString()}`,
  },
  {
    header: "Status",
    cell: (order) => (
      <Badge tone={
        order.status === "Fulfilled" ? "positive" :
        order.status === "Sent" ? "caution" :
        order.status === "Cancelled" ? "critical" : "neutral"
      }>
        {order.status}
      </Badge>
    ),
  },
];

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>(mockPurchaseOrders);

  const totalOrders = orders.length;
  const draftOrders = orders.filter(o => o.status === "Draft").length;
  const sentOrders = orders.filter(o => o.status === "Sent").length;
  const fulfilledOrders = orders.filter(o => o.status === "Fulfilled").length;

  const handleCreateOrder = () => {
    // Stub
    console.log("Create PO clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(6,182,212,0.3)]">
              <ShoppingCart size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Purchase Orders</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Create and track purchase orders with your vendors
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleCreateOrder}>
          New PO
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total POs" value={totalOrders} icon={<FileText size={18} />} gradient="from-cyan-500 to-blue-600" delay="0.05s" />
        <StatCard label="Draft" value={draftOrders} icon={<FileEdit size={18} />} gradient="from-slate-400 to-gray-500" delay="0.10s" />
        <StatCard label="Sent" value={sentOrders} icon={<ShoppingCart size={18} />} gradient="from-amber-400 to-orange-500" delay="0.15s" />
        <StatCard label="Fulfilled" value={fulfilledOrders} icon={<CheckCircle2 size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.20s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
        <DataTable data={orders} columns={columns} keyExtractor={(order) => order.id} emptyMessage="No purchase orders found." />
      </div>
    </div>
  );
}