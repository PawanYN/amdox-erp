"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Wallet,
  BookOpen,
  FileText,
  TrendingDown,
  TrendingUp,
  Clock,
} from "lucide-react";

/**
 * WHAT: Shared layout wrapper for all Finance module pages.
 * WHY: Just like SCM has its own layout, Finance needs a consistent header,
 * module-level KPI stats, and tab navigation shared across all finance sub-pages
 * (Chart of Accounts, Journal Entries, AP Invoices, Aging Report).
 *
 * HOW IT WORKS:
 * Next.js automatically wraps every page inside /finance/** with this layout.
 * The `children` prop receives the specific page content (e.g. accounts/page.tsx).
 * The active tab is detected using `usePathname()` so no extra state is needed.
 */

const TABS = [
  { id: "coa",     label: "Chart of Accounts",   path: "/finance/accounts",        icon: BookOpen     },
  { id: "gl",      label: "Journal Entries (GL)", path: "/finance/journal-entries", icon: Wallet       },
  { id: "ap",      label: "AP (Payable)",         path: "/finance/invoices",        icon: TrendingDown },
  { id: "ar",      label: "AR (Receivable)",      path: "/finance/ar-invoices",     icon: TrendingUp   },
  { id: "periods", label: "Fiscal Periods",       path: "/finance/fiscal-periods",  icon: Clock        },
  { id: "aging",   label: "Aging Report",         path: "/finance/aging-report",    icon: Clock        },
];

const KPI_STATS = [
  { label: "AR Outstanding",   value: "₹14.0L", alert: false },
  { label: "Overdue AR",       value: "₹4.8L",  alert: true  },
  { label: "AP Outstanding",   value: "₹1.98L", alert: false },
  { label: "Open Period",      value: "Jun 2026", alert: false },
];

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div
      className="min-h-[calc(100vh-64px)] bg-[#FAFAF9]"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div className="max-w-5xl mx-auto p-8">

        {/* ── Module Header ── */}
        <div className="flex items-center justify-between mb-1">
          <h1
            className="text-lg font-semibold text-[#14171F] flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            <Wallet size={20} className="text-[#1E3A5F]" /> Finance
          </h1>
        </div>
        <p className="text-[12px] text-[#8A8678] mb-5">
          GL · AP · AR · Aging Report · Fiscal Periods · FX Rates
        </p>

        {/* ── Module KPI Row ── */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {KPI_STATS.map((s) => (
            <div
              key={s.label}
              className={`rounded-lg border p-3 bg-white ${s.alert ? "border-[#B4533B]/30" : "border-[#E4E2DC]"}`}
            >
              <p className="text-[11px] text-[#8A8678]">{s.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${s.alert ? "text-[#B4533B]" : "text-[#14171F]"}`}>
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1 border-b border-[#E4E2DC] mb-5 overflow-x-auto">
          {TABS.map(({ id, label, path, icon: Icon }) => {
            const isActive = pathname.startsWith(path);
            return (
              <Link
                key={id}
                href={path}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[#1E3A5F] text-[#1E3A5F]"
                    : "border-transparent text-[#8A8678] hover:text-[#4A4740]"
                }`}
              >
                <Icon size={14} /> {label}
              </Link>
            );
          })}
        </div>

        {/* ── Page Content ── */}
        {children}
      </div>
    </div>
  );
}
