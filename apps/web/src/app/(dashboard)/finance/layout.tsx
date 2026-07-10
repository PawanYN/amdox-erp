"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  BookOpen,
  TrendingDown,
  TrendingUp,
  Clock,
  ShoppingCart,
  ArrowLeftRight,
} from "lucide-react";

const TABS = [
  { id: "coa", label: "Chart of Accounts", path: "/finance/accounts", icon: BookOpen },
  { id: "gl", label: "Journal Entries", path: "/finance/journal-entries", icon: Wallet },
  { id: "ap", label: "AP Payable", path: "/finance/invoices", icon: TrendingDown },
  { id: "ar", label: "AR Receivable", path: "/finance/ar-invoices", icon: TrendingUp },
  { id: "so", label: "Sales Orders", path: "/finance/sales-orders", icon: ShoppingCart },
  { id: "ic", label: "Intercompany", path: "/finance/intercompany", icon: ArrowLeftRight },
  { id: "periods", label: "Fiscal Periods", path: "/finance/fiscal-periods", icon: Clock },
  { id: "aging", label: "Aging Report", path: "/finance/aging-report", icon: Clock },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0">
      {/* Module header */}
      <div className="flex items-center gap-2 mb-0.5">
        <Wallet size={17} className="text-slate-500" />
        <h1 className="text-[15px] font-semibold text-slate-900">Finance</h1>
      </div>
      <p className="text-[12px] text-slate-500 mb-5">
        GL · AP · AR · Sales Orders · Intercompany · Fiscal Periods
      </p>

      {/* Tab navigation */}
      <div className="flex gap-0 border-b border-slate-200 mb-5 overflow-x-auto">
        {TABS.map(({ id, label, path, icon: Icon }) => {
          const isActive = pathname.startsWith(path);
          return (
            <Link
              key={id}
              href={path}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon size={13} />
              {label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
