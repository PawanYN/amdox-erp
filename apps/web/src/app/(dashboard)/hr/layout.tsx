"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  UserCircle,
  Network,
  Building2,
  CalendarDays,
  Clock,
  Scale,
  Wallet,
} from "lucide-react";

const TABS = [
  { id: "employees", label: "Employees", path: "/hr/employees", icon: UserCircle },
  { id: "org-chart", label: "Org Chart", path: "/hr/org-chart", icon: Network },
  { id: "departments", label: "Departments", path: "/hr/departments", icon: Building2 },
  { id: "leave", label: "Leave Requests", path: "/hr/leave-requests", icon: CalendarDays },
  { id: "attendance", label: "Attendance", path: "/hr/attendance", icon: Clock },
  { id: "compliance", label: "Statutory Compliance", path: "/hr/compliance", icon: Scale },
  { id: "payroll", label: "Payroll", path: "/hr/payroll", icon: Wallet },
];

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="space-y-0">
      <div className="flex items-center gap-2 mb-0.5">
        <Users size={17} className="text-slate-500" />
        <h1 className="text-[15px] font-semibold text-slate-900">Human Resources</h1>
      </div>
      <p className="text-[12px] text-slate-500 mb-5">
        Employees · Org chart · Leave · Attendance · Statutory compliance · Payroll
      </p>

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
