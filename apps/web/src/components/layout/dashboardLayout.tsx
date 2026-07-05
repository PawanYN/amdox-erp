"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import keycloak from "../../lib/keycloak";
import { useKeycloak } from "../KeycloakProvider";
import {
  LayoutDashboard,
  Wallet,
  Users,
  Package,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  LogOut,
  BarChart2,
  TrendingUp,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
} from "lucide-react";

const ROLES: Record<string, { label: string; sections: string[]; dept: string }> = {
  tenantadmin: {
    label: "Tenant Admin",
    sections: [
      "/home",
      "/bi",
      "/forecast",
      "finance",
      "hr",
      "scm",
      "projects",
      "/notifications",
      "/settings",
    ],
    dept: "Administration",
  },
  executive: {
    label: "Executive",
    sections: ["/home", "/bi", "/forecast", "finance", "hr", "scm", "projects", "/settings"],
    dept: "Executive Office",
  },
  finance: { label: "Finance Team", sections: ["/home", "finance", "/settings"], dept: "Finance" },
  hr: { label: "HR & Payroll", sections: ["/home", "hr", "/settings"], dept: "Human Resources" },
  scm: {
    label: "Supply Chain Mgr",
    sections: ["/home", "scm", "/forecast", "/settings"],
    dept: "Supply Chain",
  },
  pm: {
    label: "Project Manager",
    sections: ["/home", "projects", "/settings"],
    dept: "Project Management",
  },
  it: { label: "IT Administrator", sections: ["/home", "/settings"], dept: "IT Administration" },
};

interface NavChild {
  id: string;
  label: string;
}
interface NavSection {
  id: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  leaf?: boolean;
  children?: NavChild[];
}

const NAV: NavSection[] = [
  { id: "/home", icon: LayoutDashboard, label: "Dashboard", leaf: true },
  { id: "/bi", icon: BarChart2, label: "BI Reports", leaf: true },
  { id: "/forecast", icon: TrendingUp, label: "AI Forecast", leaf: true },
  {
    id: "finance",
    icon: Wallet,
    label: "Finance",
    children: [
      { id: "/finance/accounts", label: "Chart of Accounts" },
      { id: "/finance/journal-entries", label: "Journal Entries" },
      { id: "/finance/invoices", label: "AP Invoices" },
      { id: "/finance/ar-invoices", label: "AR Invoices" },
      { id: "/finance/aging-report", label: "Aging Report" },
      { id: "/finance/fiscal-periods", label: "Fiscal Periods" },
    ],
  },
  {
    id: "hr",
    icon: Users,
    label: "Human Resources",
    children: [
      { id: "/hr/employees", label: "Employees" },
      { id: "/hr/departments", label: "Departments" },
      { id: "/hr/leave-requests", label: "Leave Requests" },
      { id: "/hr/attendance", label: "Attendance" },
      { id: "/hr/payroll", label: "Payroll" },
    ],
  },
  {
    id: "scm",
    icon: Package,
    label: "Supply Chain",
    children: [
      { id: "/scm/vendors", label: "Vendors" },
      { id: "/scm/products", label: "Products" },
      { id: "/scm/purchase-orders", label: "Purchase Orders" },
      { id: "/scm/goods-receipt", label: "Goods Receipt" },
      { id: "/scm/invoices", label: "AP Invoices" },
      { id: "/scm/inventory", label: "Inventory" },
    ],
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "Projects",
    children: [
      { id: "/projects/overview", label: "Overview" },
      { id: "/projects/tasks", label: "Tasks & Milestones" },
      { id: "/projects/resources", label: "Resource Allocation" },
      { id: "/projects/budget", label: "Budget Tracking" },
    ],
  },
  { id: "/notifications", icon: Bell, label: "Notifications", leaf: true },
  { id: "/settings", icon: Settings, label: "Settings", leaf: true },
];

/* ─────────────────────────────────────────────
   Top Bar
   ───────────────────────────────────────────── */
function TopBar({
  role,
  setRole,
  activePage,
  onMenuToggle,
}: {
  role: string;
  setRole: (r: string) => void;
  activePage: string;
  onMenuToggle: () => void;
}) {
  const { logout } = useKeycloak();
  const user = keycloak?.tokenParsed;
  const username = user?.preferred_username || "User";
  const initials = username.substring(0, 2).toUpperCase();

  const allItems = NAV.flatMap((n) => n.children || [{ id: n.id, label: n.label }]);
  const current = allItems.find((i) => i.id === activePage) || { label: "Dashboard" };
  const parent = NAV.find((n) => n.children?.some((c) => c.id === activePage));

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 shrink-0 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-bold tracking-tight">AX</span>
        </div>
        <span className="font-semibold text-slate-900 text-[15px] tracking-tight hidden sm:block">
          Amdox<span className="text-blue-600">ERP</span>
        </span>
      </div>

      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 text-[13px] text-slate-400 ml-2 min-w-0">
        <span>Amdox ERP</span>
        {parent && (
          <>
            <ChevronRight size={14} className="shrink-0" />
            <span>{parent.label}</span>
          </>
        )}
        <ChevronRight size={14} className="shrink-0" />
        <span className="text-slate-700 font-medium truncate">{current.label}</span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <button className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <Search size={16} />
        </button>
        <button className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors">
          <Bell size={16} />
        </button>

        {/* Role switcher */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="h-8 text-[12px] text-slate-600 border border-slate-200 rounded-md px-2 pr-6 bg-white outline-none cursor-pointer hover:border-slate-300 transition-colors appearance-none"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath fill='%2364748B' d='M4.5 6.5l3.5 3.5 3.5-3.5'/%3E%3C/svg%3E\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 6px center",
            backgroundSize: "14px",
          }}
        >
          {Object.entries(ROLES).map(([key, r]) => (
            <option key={key} value={key}>
              {r.label}
            </option>
          ))}
        </select>

        {/* Divider */}
        <div className="h-5 w-px bg-slate-200 mx-1" />

        {/* User avatar */}
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-semibold">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-slate-700 hidden lg:block">{username}</span>
        </div>

        {/* Logout */}
        <button
          onClick={() => confirm("Sign out of Amdox ERP?") && logout()}
          title="Sign out"
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors ml-1"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────
   Sidebar
   ───────────────────────────────────────────── */
function Sidebar({
  role,
  activePage,
  collapsed,
  setCollapsed,
}: {
  role: string;
  activePage: string;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
}) {
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    finance: true,
    hr: true,
    scm: true,
    projects: true,
  });
  const visibleSections = ROLES[role].sections;

  const toggle = (id: string) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const items = NAV.filter((item) =>
    item.leaf
      ? visibleSections.some((s) => item.id === s || item.id.startsWith(s))
      : visibleSections.includes(item.id),
  ).filter((item) => item.id !== "/settings" || visibleSections.includes("/settings"));

  return (
    <aside
      className={`bg-white border-r border-slate-200 flex flex-col shrink-0 transition-all duration-200 ${
        collapsed ? "w-14" : "w-56"
      }`}
    >
      <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2 custom-scrollbar">
        {items.map((item) => {
          const Icon = item.icon;

          /* Leaf item (direct link) */
          if (item.leaf) {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => router.push(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                  collapsed ? "justify-center" : ""
                } ${
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon size={16} className={isActive ? "text-blue-600" : "text-slate-400"} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
          }

          /* Section with children */
          const isOpen = !collapsed && openSections[item.id];
          const hasActiveChild = item.children?.some((c) => c.id === activePage);

          return (
            <div key={item.id}>
              <button
                onClick={() => {
                  if (collapsed) {
                    setCollapsed(false);
                    setOpenSections((s) => ({ ...s, [item.id]: true }));
                  } else {
                    toggle(item.id);
                  }
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                  collapsed ? "justify-center" : ""
                } ${
                  hasActiveChild
                    ? "text-blue-700"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} className={hasActiveChild ? "text-blue-600" : "text-slate-400"} />
                  {!collapsed && item.label}
                </span>
                {!collapsed &&
                  (isOpen ? (
                    <ChevronDown size={13} className="text-slate-400" />
                  ) : (
                    <ChevronRight size={13} className="text-slate-400" />
                  ))}
              </button>

              {isOpen && item.children && (
                <div className="ml-6 mt-0.5 pl-2 border-l border-slate-100">
                  {item.children.map((child) => {
                    const isActive = activePage === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => router.push(child.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-[12.5px] mb-0.5 transition-all duration-150 ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                      >
                        {child.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-slate-100 p-2">
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center justify-center py-1.5 rounded-md text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Signed-in role */}
      {!collapsed && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-[11px] text-slate-400 truncate">
            {ROLES[role].label} · {ROLES[role].dept}
          </p>
        </div>
      )}
    </aside>
  );
}

/* ─────────────────────────────────────────────
   Root layout
   ───────────────────────────────────────────── */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState("tenantadmin");
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopBar
        role={role}
        setRole={setRole}
        activePage={pathname}
        onMenuToggle={() => setCollapsed((c) => !c)}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          role={role}
          activePage={pathname}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 max-w-screen-2xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
