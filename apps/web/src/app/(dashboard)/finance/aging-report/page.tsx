"use client";

import { useState } from "react";
import { CalendarClock, Filter, BarChart, AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockAgingData } from "@/lib/mock/finance";
import { AgingRecord } from "@/lib/types";



const columns: ColumnDef<AgingRecord>[] = [
  {
    header: "Client",
    cell: (record) => (
      <>
        <span className="font-semibold text-ink">{record.clientName}</span>
        <p className="text-xs text-muted">{record.clientId}</p>
      </>
    ),
  },
  {
    header: "Current",
    className: "text-sm text-muted",
    cell: (record) => `$${record.current.toLocaleString()}`,
  },
  {
    header: "1 - 30 Days",
    className: "text-sm text-amber-600 font-medium",
    cell: (record) => `$${record.days30.toLocaleString()}`,
  },
  {
    header: "31 - 60 Days",
    className: "text-sm text-orange-600 font-medium",
    cell: (record) => `$${record.days60.toLocaleString()}`,
  },
  {
    header: "61 - 90 Days",
    className: "text-sm text-rose-500 font-medium",
    cell: (record) => `$${record.days90.toLocaleString()}`,
  },
  {
    header: "> 90 Days",
    className: "text-sm text-red-600 font-bold",
    cell: (record) => `$${record.days90Plus.toLocaleString()}`,
  },
  {
    header: "Total",
    className: "font-bold text-ink",
    cell: (record) => `$${record.total.toLocaleString()}`,
  },
];

export default function AgingReportPage() {
  const [records] = useState<AgingRecord[]>(mockAgingData);

  const totalOutstanding = records.reduce((acc, curr) => acc + curr.total, 0);
  const totalOver90 = records.reduce((acc, curr) => acc + curr.days90Plus, 0);

  const handleFilter = () => {
    // Stub
    console.log("Filter clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-600 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
              <CalendarClock size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Aging Report</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            View accounts receivable broken down by time past due
          </p>
        </div>
        <Button icon={<Filter size={16} />} onClick={handleFilter} variant="secondary">
          Filter
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-2xl">
        <StatCard label="Total Outstanding" value={`$${totalOutstanding.toLocaleString()}`} icon={<BarChart size={18} />} gradient="from-blue-500 to-indigo-600" delay="0.05s" />
        <StatCard label="Over 90 Days Due" value={`$${totalOver90.toLocaleString()}`} icon={<AlertOctagon size={18} />} gradient="from-rose-400 to-red-500" delay="0.10s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={records} columns={columns} keyExtractor={(record) => record.clientId} emptyMessage="No aging records found." />
      </div>
    </div>
  );
}