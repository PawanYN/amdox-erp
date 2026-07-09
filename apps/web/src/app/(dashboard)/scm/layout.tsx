"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Truck, FileText, CheckCircle, TrendingUp, Building2, Boxes } from "lucide-react";

const TABS = [
  { id: "vendors", label: "Vendors", path: "/scm/vendors", icon: Building2 },
  { id: "products", label: "Products", path: "/scm/products", icon: Boxes },
  { id: "inventory", label: "Inventory", path: "/scm/inventory", icon: Package },
  { id: "po", label: "Purchase Orders", path: "/scm/purchase-orders", icon: FileText },
  { id: "gr", label: "Goods Receipt", path: "/scm/goods-receipt", icon: Truck },
  { id: "invoice", label: "AP Invoice (3-way)", path: "/scm/invoices", icon: CheckCircle },
  { id: "forecast", label: "AI Forecast", path: "/scm/forecast", icon: TrendingUp },
];

export default function SCMLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0">
      {/* Module header */}
      <div className="flex items-center gap-2 mb-0.5">
        <Package size={17} className="text-slate-500" />
        <h1 className="text-[15px] font-semibold text-slate-900">Supply Chain</h1>
      </div>
      <p className="text-[12px] text-slate-500 mb-5">
        Procure-to-Pay: Inventory · Purchase Orders · Goods Receipt · AP Invoice (3-way match)
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
