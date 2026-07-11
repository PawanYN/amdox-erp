"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import keycloak from "../../lib/keycloak";
import { useKeycloak } from "../KeycloakProvider";
import { GlobalSearch, useGlobalSearchShortcut } from "./global-search";
import { ToastHost } from "../ui/toast";
import { notificationApi } from "../../lib/api/notification-api";
import { apiClient } from "../../lib/api/client";
import { isModuleAllowed } from "../../lib/erp-modules";
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
  Menu,
  X,
} from "lucide-react";

type AuthMe = {
  roles?: string[];
  modules?: string[];
  department?: { name: string; code: string } | null;
};

function primaryRoleLabel(roles: string[]): string {
  if (roles.includes("TenantAdmin") || roles.includes("SuperAdmin")) return "Tenant Admin";
  if (roles.includes("Manager")) return "Manager";
  if (roles.includes("Viewer")) return "Viewer";
  return "Employee";
}

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
      { id: "/finance/sales-orders", label: "Sales Orders" },
      { id: "/finance/intercompany", label: "Intercompany" },
      { id: "/finance/fiscal-periods", label: "Fiscal Periods" },
      { id: "/finance/aging-report", label: "Aging Report" },
    ],
  },
  {
    id: "hr",
    icon: Users,
    label: "Human Resources",
    children: [
      { id: "/hr/employees", label: "Employees" },
      { id: "/hr/org-chart", label: "Org Chart" },
      { id: "/hr/departments", label: "Departments" },
      { id: "/hr/leave-requests", label: "Leave Requests" },
      { id: "/hr/attendance", label: "Attendance" },
      { id: "/hr/compliance", label: "Statutory Compliance" },
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
      { id: "/scm/inventory", label: "Inventory" },
      { id: "/scm/purchase-orders", label: "Purchase Orders" },
      { id: "/scm/goods-receipt", label: "Goods Receipt" },
    ],
  },
  {
    id: "projects",
    icon: FolderKanban,
    label: "Projects",
    children: [
      { id: "/projects/overview", label: "Overview" },
      { id: "/projects/milestones", label: "Milestones" },
      { id: "/projects/tasks", label: "Tasks & Gantt" },
      { id: "/projects/resources", label: "Resources" },
      { id: "/projects/budget", label: "Budget" },
    ],
  },
  { id: "/notifications", icon: Bell, label: "Notifications", leaf: true },
  { id: "/settings", icon: Settings, label: "Settings, Audit & GDPR", leaf: true },
];

function TopBar({
  activePage,
  onSearchOpen,
  onMenuOpen,
  roleLabel,
}: {
  activePage: string;
  onSearchOpen: () => void;
  onMenuOpen: () => void;
  roleLabel: string;
}) {
  const router = useRouter();
  const { logout } = useKeycloak();
  const user = keycloak?.tokenParsed;
  const username = user?.preferred_username || "User";
  const initials = username.substring(0, 2).toUpperCase();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadUnread = () => {
      notificationApi
        .list()
        .then((items) => {
          if (cancelled) return;
          const list = Array.isArray(items) ? items : [];
          setUnreadCount(list.filter((n) => !n.isRead).length);
        })
        .catch(() => {});
    };
    loadUnread();
    const interval = setInterval(loadUnread, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [activePage]);

  const allItems = NAV.flatMap((n) => n.children || [{ id: n.id, label: n.label }]);
  const current = allItems.find((i) => i.id === activePage) || { label: "Dashboard" };
  const parent = NAV.find((n) => n.children?.some((c) => c.id === activePage));

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-3 sm:px-4 gap-2 sm:gap-3 shrink-0 z-20">
      <button
        type="button"
        aria-label="Open menu"
        onClick={onMenuOpen}
        className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors md:hidden shrink-0"
      >
        <Menu size={18} />
      </button>
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center shrink-0">
          <span className="text-white text-[11px] font-bold tracking-tight">AX</span>
        </div>
        <span className="font-semibold text-slate-900 text-[15px] tracking-tight hidden sm:block">
          Amdox<span className="text-blue-600">ERP</span>
        </span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 text-[13px] text-slate-500 ml-2 min-w-0">
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

      <div className="flex-1" />

      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Search"
          title="Search (Ctrl+K)"
          onClick={onSearchOpen}
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Search size={16} />
        </button>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          title="Notifications"
          onClick={() => router.push("/notifications")}
          className="relative h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
        >
          <Bell size={16} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-blue-600 text-white text-[9px] font-bold flex items-center justify-center px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        <span className="hidden sm:inline-flex h-8 items-center px-2.5 text-[11px] font-semibold text-slate-600 bg-slate-50 border border-slate-200 rounded-md">
          {roleLabel}
        </span>

        <div className="h-5 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-[11px] font-semibold">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-slate-700 hidden lg:block">{username}</span>
        </div>

        <button
          onClick={() => confirm("Sign out of Amdox ERP?") && logout()}
          title="Sign out"
          className="h-8 w-8 flex items-center justify-center rounded-md text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors ml-1"
        >
          <LogOut size={15} />
        </button>
      </div>
    </header>
  );
}

function Sidebar({
  modules,
  departmentName,
  roleLabel,
  activePage,
  collapsed,
  setCollapsed,
  mobileOpen,
  onClose,
}: {
  modules: string[];
  departmentName: string;
  roleLabel: string;
  activePage: string;
  collapsed: boolean;
  setCollapsed: (v: boolean | ((prev: boolean) => boolean)) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    finance: true,
    hr: true,
    scm: true,
    projects: true,
  });

  const toggle = (id: string) => setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const items = NAV.filter((item) => isModuleAllowed(modules, item.id));

  const navigate = (id: string) => {
    router.push(id);
    onClose();
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed top-14 bottom-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col shrink-0 transform transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:static md:top-auto md:bottom-auto md:z-auto md:translate-x-0 md:transition-all md:duration-200 ${
          collapsed ? "md:w-14" : "md:w-56"
        }`}
      >
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-100 md:hidden">
          <span className="text-[13px] font-semibold text-slate-700">Menu</span>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
          >
            <X size={16} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-3 space-y-0.5 px-2 custom-scrollbar">
          {items.map((item) => {
            const Icon = item.icon;

            if (item.leaf) {
              const isActive = activePage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => navigate(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                    collapsed ? "justify-center" : ""
                  } ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-blue-600" : "text-slate-500"} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            }

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
                    <Icon
                      size={16}
                      className={hasActiveChild ? "text-blue-600" : "text-slate-500"}
                    />
                    {!collapsed && item.label}
                  </span>
                  {!collapsed &&
                    (isOpen ? (
                      <ChevronDown size={13} className="text-slate-500" />
                    ) : (
                      <ChevronRight size={13} className="text-slate-500" />
                    ))}
                </button>

                {isOpen && item.children && (
                  <div className="ml-6 mt-0.5 pl-2 border-l border-slate-100">
                    {item.children.map((child) => {
                      const isActive = activePage === child.id;
                      return (
                        <button
                          key={child.id}
                          onClick={() => navigate(child.id)}
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

        <div className="hidden md:block border-t border-slate-100 p-2">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="w-full flex items-center justify-center py-1.5 rounded-md text-slate-500 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          </button>
        </div>

        {!collapsed && (
          <div className="px-3 pb-3 pt-0">
            <p className="text-[11px] text-slate-500 truncate">
              {roleLabel} · {departmentName}
            </p>
          </div>
        )}
      </aside>
    </>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { token, initialized } = useKeycloak();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [authMe, setAuthMe] = useState<AuthMe | null>(null);
  const pathname = usePathname();
  const openSearch = useCallback(() => setSearchOpen(true), []);
  useGlobalSearchShortcut(openSearch);

  useEffect(() => {
    if (!initialized || !token) {
      setAuthMe(null);
      return;
    }
    apiClient("/auth/me")
      .then((me: AuthMe) => setAuthMe(me))
      .catch(() =>
        setAuthMe({ roles: ["Employee"], modules: ["home", "settings", "notifications"] }),
      );
  }, [initialized, token]);

  const modules = authMe?.modules ?? ["home", "settings", "notifications"];
  const roles = authMe?.roles ?? [];
  const roleLabel = primaryRoleLabel(roles);
  const departmentName = authMe?.department?.name ?? "No Department";

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      <TopBar
        activePage={pathname}
        onSearchOpen={openSearch}
        onMenuOpen={() => setMobileOpen(true)}
        roleLabel={roleLabel}
      />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          modules={modules}
          departmentName={departmentName}
          roleLabel={roleLabel}
          activePage={pathname}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="p-6 max-w-screen-2xl mx-auto">{children}</div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ToastHost />
    </div>
  );
}
