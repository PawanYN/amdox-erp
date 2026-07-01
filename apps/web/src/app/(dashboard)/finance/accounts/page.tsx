"use client";

import { useState } from "react";
import {
  BookOpen,
  Landmark,
  PieChart,
  Wallet,
  Plus,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";

/**
 * WHAT: Chart of Accounts page for the Finance module.
 * WHY: Displays all GL account codes grouped by type (Asset, Liability, Equity,
 * Revenue, Expense). These codes are the foundation that every journal entry
 * and invoice references for double-entry bookkeeping.
 *
 * DATA: Currently uses mock data. When the GL accounts API is ready, replace
 * ACCOUNTS with a useEffect call to the backend endpoint GET /finance/gl/accounts.
 */

const TYPE_COLOR: Record<string, string> = {
  asset:     "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  liability: "bg-[#B4533B]/10 text-[#B4533B]",
  equity:    "bg-[#7B61D4]/10 text-[#7B61D4]",
  revenue:   "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  expense:   "bg-[#D9A85C]/10 text-[#D9A85C]",
};

type Account = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subType: string;
  balance: number;
};

const ACCOUNTS: Account[] = [
  { code: "1000", name: "Cash & Cash Equivalents", type: "asset",     subType: "current_asset",       balance: 4820000 },
  { code: "1300", name: "Inventory",                type: "asset",     subType: "current_asset",       balance: 2150000 },
  { code: "1400", name: "Accounts Receivable",      type: "asset",     subType: "current_asset",       balance: 980000  },
  { code: "2000", name: "Accounts Payable",          type: "liability", subType: "current_liability",   balance: 1240000 },
  { code: "2100", name: "Accrued Expenses",          type: "liability", subType: "current_liability",   balance: 340000  },
  { code: "3000", name: "Retained Earnings",         type: "equity",    subType: "equity",              balance: 8600000 },
  { code: "4000", name: "Revenue",                   type: "revenue",   subType: "operating_revenue",   balance: 12400000},
  { code: "5000", name: "Cost of Goods Sold",        type: "expense",   subType: "cogs",                balance: 7800000 },
  { code: "6000", name: "Operating Expenses",        type: "expense",   subType: "opex",                balance: 2100000 },
];

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

export default function ChartOfAccountsPage() {
  const [accounts] = useState<Account[]>(ACCOUNTS);

  const totalAssets      = accounts.filter(a => a.type === "asset").reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === "liability").reduce((s, a) => s + a.balance, 0);
  const totalEquity      = accounts.filter(a => a.type === "equity").reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              <BookOpen size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Chart of Accounts</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Standard GL account codes — seeded at tenant setup. Code <span className="font-mono">2000</span> = AP, <span className="font-mono">1300</span> = Inventory, <span className="font-mono">1400</span> = AR.
          </p>
        </div>
        <Button icon={<Plus size={16} />}>New Account</Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Assets"       value={`₹${totalAssets.toLocaleString()}`}       icon={<Landmark size={18} />}    gradient="from-green-500 to-emerald-600" delay="0.05s" />
        <StatCard label="Total Liabilities"  value={`₹${totalLiabilities.toLocaleString()}`}  icon={<PieChart size={18} />}    gradient="from-rose-400 to-red-500"      delay="0.10s" />
        <StatCard label="Total Equity"       value={`₹${totalEquity.toLocaleString()}`}       icon={<Wallet size={18} />}      gradient="from-blue-500 to-indigo-600"   delay="0.15s" />
      </div>

      {/* ── Grouped account tables ── */}
      <div className="mt-8 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        {ACCOUNT_TYPES.map((type) => {
          const group = accounts.filter(a => a.type === type);
          const total = group.reduce((s, a) => s + a.balance, 0);
          return (
            <div key={type} className="border border-[#E4E2DC] rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAFAF9] border-b border-[#E4E2DC]">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[type]}`}>
                  {type}
                </span>
                <span className="text-[12px] font-mono text-[#8A8678]">
                  Total: ₹{total.toLocaleString()}
                </span>
              </div>
              {/* Rows */}
              <table className="w-full text-[13px]">
                <tbody>
                  {group.map((a, i) => (
                    <tr
                      key={a.code}
                      className={`border-b border-[#F0EEE7] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[#8A8678] w-16">{a.code}</td>
                      <td className="px-4 py-2.5 font-medium text-[#14171F]">{a.name}</td>
                      <td className="px-4 py-2.5 text-[#8A8678] text-[11px]">{a.subType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#14171F]">
                        ₹{a.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}