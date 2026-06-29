"use client";

import { useState } from "react";
import { FolderOpen, Plus, Landmark, PieChart, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockAccounts } from "@/lib/mock/finance";
import { Account } from "@/lib/types";



const columns: ColumnDef<Account>[] = [
  {
    header: "Account ID",
    cell: (account) => (
      <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
        {account.id}
      </span>
    ),
  },
  {
    header: "Name",
    cell: (account) => <span className="font-semibold text-ink">{account.name}</span>,
  },
  {
    header: "Type",
    cell: (account) => (
      <Badge tone={
        account.type === "Asset" ? "positive" :
        account.type === "Liability" ? "critical" :
        account.type === "Equity" ? "info" : "neutral"
      }>
        {account.type}
      </Badge>
    ),
  },
  {
    header: "Balance",
    cell: (account) => (
      <span className={`font-medium ${account.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
        ${Math.abs(account.balance).toLocaleString()} {account.balance < 0 && '(Cr)'}
      </span>
    ),
  },
];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(mockAccounts);

  const totalAssets = accounts.filter(a => a.type === "Asset").reduce((acc, curr) => acc + curr.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === "Liability").reduce((acc, curr) => acc + curr.balance, 0);
  const totalEquity = accounts.filter(a => a.type === "Equity").reduce((acc, curr) => acc + curr.balance, 0);

  const handleAddAccount = () => {
    // Stub
    console.log("Add Account clicked");
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              <FolderOpen size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Chart of Accounts</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Manage your ledger accounts and monitor balances
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleAddAccount}>
          New Account
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Assets" value={`$${totalAssets.toLocaleString()}`} icon={<Landmark size={18} />} gradient="from-green-500 to-emerald-600" delay="0.05s" />
        <StatCard label="Total Liabilities" value={`$${Math.abs(totalLiabilities).toLocaleString()}`} icon={<PieChart size={18} />} gradient="from-rose-400 to-red-500" delay="0.10s" />
        <StatCard label="Total Equity" value={`$${Math.abs(totalEquity).toLocaleString()}`} icon={<Wallet size={18} />} gradient="from-blue-500 to-indigo-600" delay="0.15s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable data={accounts} columns={columns} keyExtractor={(account) => account.id} emptyMessage="No accounts found." />
      </div>
    </div>
  );
}