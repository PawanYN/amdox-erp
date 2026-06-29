"use client";

import { useState } from "react";
import { FileSignature, Plus, Database, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockJournalEntries } from "@/lib/mock/finance";
import { JournalEntry } from "@/lib/types";



const columns: ColumnDef<JournalEntry>[] = [
  {
    header: "Entry ID",
    cell: (entry) => (
      <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
        {entry.id}
      </span>
    ),
  },
  {
    header: "Date",
    cell: (entry) => <span className="text-sm text-muted">{entry.date}</span>,
  },
  {
    header: "Description",
    cell: (entry) => <span className="font-medium text-ink">{entry.description}</span>,
  },
  {
    header: "Debit Acc.",
    cell: (entry) => <span className="text-xs text-muted">{entry.debitAccount}</span>,
  },
  {
    header: "Credit Acc.",
    cell: (entry) => <span className="text-xs text-muted">{entry.creditAccount}</span>,
  },
  {
    header: "Amount",
    className: "font-medium text-ink",
    cell: (entry) => `$${entry.amount.toLocaleString()}`,
  },
  {
    header: "Status",
    cell: (entry) => (
      <Badge tone={entry.status === "Posted" ? "positive" : "neutral"}>
        {entry.status}
      </Badge>
    ),
  },
];

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>(mockJournalEntries);

  const totalEntries = entries.length;
  const postedEntries = entries.filter(e => e.status === "Posted").length;
  const draftEntries = entries.filter(e => e.status === "Draft").length;

  const handleAddEntry = () => {
    // Stub
    console.log("Add Journal Entry clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
              <FileSignature size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Journal Entries</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Record and review double-entry bookkeeping logs
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleAddEntry}>
          New Entry
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Entries" value={totalEntries} icon={<Database size={18} />} gradient="from-indigo-500 to-blue-600" delay="0.05s" />
        <StatCard label="Posted" value={postedEntries} icon={<CheckCircle size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Drafts" value={draftEntries} icon={<Clock size={18} />} gradient="from-amber-400 to-orange-500" delay="0.15s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable data={entries} columns={columns} keyExtractor={(entry) => entry.id} emptyMessage="No journal entries found." />
      </div>
    </div>
  );
}
