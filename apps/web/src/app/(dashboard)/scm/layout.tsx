"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Truck, FileText, CheckCircle } from "lucide-react";

export default function SCMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const TABS = [
    { id: "inventory", label: "Inventory", path: "/scm/inventory", icon: Package },
    { id: "po", label: "Purchase Orders", path: "/scm/purchase-orders", icon: FileText },
    { id: "gr", label: "Goods Receipt", path: "/scm/goods-receipt", icon: Truck },
    { id: "invoice", label: "AP Invoice (3-way)", path: "/scm/invoices", icon: CheckCircle },
  ];

  const stats = [
    { label: "Items below reorder", value: "2", alert: true },
    { label: "Open POs", value: "3", alert: false },
    { label: "Pending GRs", value: "1", alert: false },
    { label: "Invoices in review", value: "1", alert: true },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAFAF9]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
      `}</style>
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-lg font-semibold text-[#14171F] flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            <Package size={20} className="text-[#1E3A5F]" /> Supply Chain Management
          </h1>
        </div>
        <p className="text-[12px] text-[#8A8678] mb-5">
          Procure-to-Pay chain: Inventory → Purchase Order → Goods Receipt → AP Invoice (3-way match)
        </p>

        {/* KPI row */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          {stats.map((s) => (
            <div key={s.label} className={`rounded-lg border p-3 bg-white ${s.alert ? "border-[#B4533B]/30" : "border-[#E4E2DC]"}`}>
              <p className="text-[11px] text-[#8A8678]">{s.label}</p>
              <p className={`text-2xl font-semibold mt-1 ${s.alert ? "text-[#B4533B]" : "text-[#14171F]"}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* tabs */}
        <div className="flex gap-1 border-b border-[#E4E2DC] mb-5">
          {TABS.map(({ id, label, path, icon: Icon }) => {
            const isActive = pathname.startsWith(path);
            return (
              <Link key={id} href={path}
                className={`flex items-center gap-1.5 px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  isActive ? "border-[#1E3A5F] text-[#1E3A5F]" : "border-transparent text-[#8A8678] hover:text-[#4A4740]"
                }`}>
                <Icon size={14} /> {label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
