"use client";

import { useState } from "react";
import { Package, Plus, AlertCircle, CheckCircle2, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockInventory } from "@/lib/mock/scm";
import { InventoryItem } from "@/lib/types";



const columns: ColumnDef<InventoryItem>[] = [
  {
    header: "Item ID",
    cell: (item) => (
      <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
        {item.id}
      </span>
    ),
  },
  {
    header: "Name",
    cell: (item) => <span className="font-semibold text-ink">{item.name}</span>,
  },
  {
    header: "Category",
    cell: (item) => (
      <span className="text-xs font-medium text-muted bg-canvas border border-line rounded-lg px-2.5 py-1">
        {item.category}
      </span>
    ),
  },
  {
    header: "Stock / Min",
    cell: (item) => (
      <>
        <span className={item.stock < item.minStock ? "text-rose-500 font-bold" : "text-ink"}>
          {item.stock}
        </span>
        <span className="text-muted text-xs ml-1">/ {item.minStock}</span>
      </>
    ),
  },
  {
    header: "Unit Price",
    className: "text-muted font-medium",
    cell: (item) => `$${item.unitPrice.toLocaleString()}`,
  },
  {
    header: "Status",
    cell: (item) => (
      <Badge tone={
        item.status === "In Stock" ? "positive" :
        item.status === "Low Stock" ? "caution" : "critical"
      }>
        {item.status}
      </Badge>
    ),
  },
];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(mockInventory);

  const totalItems = items.length;
  const totalStock = items.reduce((acc, curr) => acc + curr.stock, 0);
  const lowStock = items.filter(i => i.status === "Low Stock").length;
  const outOfStock = items.filter(i => i.status === "Out of Stock").length;

  const handleAddItem = () => {
    // Stub for add item modal
    console.log("Add item clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-[0_4px_12px_rgba(59,130,246,0.3)]">
              <Package size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Inventory</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Manage your stock levels, categories, and item statuses
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleAddItem}>
          Add Item
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Items" value={totalItems} icon={<Box size={18} />} gradient="from-blue-500 to-indigo-600" delay="0.05s" />
        <StatCard label="Total Stock" value={totalStock} icon={<CheckCircle2 size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Low Stock" value={lowStock} icon={<AlertCircle size={18} />} gradient="from-amber-400 to-orange-500" delay="0.15s" />
        <StatCard label="Out of Stock" value={outOfStock} icon={<AlertCircle size={18} />} gradient="from-rose-400 to-pink-500" delay="0.20s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
        <DataTable data={items} columns={columns} keyExtractor={(item) => item.id} emptyMessage="No items found." />
      </div>
    </div>
  );
}