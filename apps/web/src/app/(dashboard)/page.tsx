"use client";
import { useState } from "react";
import ChartOfAccounts from "../../components/dashboard/Finance/ChartOfAccounts";
import JournalEntries from "../../components/dashboard/Finance/JournalEntries";
import Invoices from "../../components/dashboard/Finance/Invoices";
import AgingReport from "../../components/dashboard/Finance/AgingReport";
import Leads from "../../components/dashboard/CRM/Leads";
import Customers from "../../components/dashboard/CRM/Customers";
import Opportunities from "../../components/dashboard/CRM/Opportunities";
import ReportsDashboard from "../../components/dashboard/Reports/ReportsDashboard";

import {
  LayoutDashboard,
  Wallet,
  Users,
  Package,
  Bell,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  HelpCircle,
  Plus,
  Maximize2,
  User,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

/* ──────────────────────────────────────────────
   Amdox ERP — App Shell (D365-style layout)
   - Black top bar: app switcher, search, dept badge, profile
   - Vertical sidebar below it, grouped by module
   - Content area stays empty — Week 2 fills it in
   ────────────────────────────────────────────── */

const ROLES: Record<
  string,
  { label: string; sections: string[]; dept: string }
> = {
  executive: {
    label: "Executive",
    sections: ["home", "finance", "crm", "hr", "scm"],
    dept: "Executive Office",
  },

  finance: {
    label: "Finance Team",
    sections: ["home", "finance", "crm"],
    dept: "Finance",
  },

  hr: {
    label: "HR & Payroll",
    sections: ["home", "crm", "hr"],
    dept: "Human Resources",
  },

  scm: {
    label: "Supply Chain Mgr",
    sections: ["home", "crm", "scm"],
    dept: "Supply Chain",
  },

  it: {
    label: "IT Administrator",
    sections: ["home", "finance", "crm", "hr", "scm","reports", "settings"],
    dept: "IT Administration",
  },
};

interface NavChild {
  id: string;
  label: string;
  day: string;
}

interface NavSection {
  id: string;
  icon: React.ComponentType<any>;
  label: string;
  leaf?: boolean;
  children?: NavChild[];
}

interface NavItem {
  id: string;
  label: string;
  day?: string;
  icon?: React.ComponentType<any>;
  leaf?: boolean;
}

const NAV: NavSection[] = [
  { id: "home", icon: LayoutDashboard, label: "Home", leaf: true },
  {
    id: "finance",
    icon: Wallet,
    label: "Finance",
    children: [
      { id: "finance-accounts", label: "Chart of Accounts", day: "Day 8" },
      { id: "finance-journal", label: "Journal Entries", day: "Day 8" },
      { id: "finance-invoices", label: "Invoices (AP/AR)", day: "Day 9" },
      { id: "finance-aging", label: "Aging Report", day: "Day 9" },
    ],
  },
  {
  id: "crm",
  icon: Users,
  label: "CRM",
  children: [
    { id: "crm-leads", label: "Leads", day: "Day 14" },
    { id: "crm-customers", label: "Customers", day: "Day 14" },
    { id: "crm-opportunities", label: "Opportunities", day: "Day 15" },
  ],
},
  {
    id: "hr",
    icon: Users,
    label: "HR",
    children: [
      { id: "hr-employees", label: "Employees", day: "Day 10" },
      { id: "hr-leave", label: "Leave Requests", day: "Day 10" },
      { id: "hr-attendance", label: "Attendance", day: "Day 10" },
      { id: "hr-payroll", label: "Payroll", day: "Day 11" },
    ],
  },
  {
    id: "scm",
    icon: Package,
    label: "Supply Chain",
    children: [
      { id: "scm-vendors", label: "Vendors", day: "Day 12" },
      { id: "scm-po", label: "Purchase Orders", day: "Day 12" },
      { id: "scm-inventory", label: "Inventory", day: "Day 13" },
    ],
  },

  {
  id: "reports",
  icon: LayoutDashboard,
  label: "Reports",
  leaf: true,
},
  { id: "notifications", icon: Bell, label: "Notifications", leaf: true },
  { id: "settings", icon: Settings, label: "Settings", leaf: true },

  
];

interface TopBarProps {
  role: string;
  setRole: (role: string) => void;
  activePage: string;
}

/* ── Top bar — matches D365 reference layout exactly ── */
function TopBar({ role, setRole, activePage }: TopBarProps) {
  const allItems = NAV.flatMap((n) => (n.children || [n]) as NavItem[]);
  const current = allItems.find((i) => i.id === activePage);
  const parentSection = NAV.find((n) =>
    n.children?.some((c) => c.id === activePage)
  );

  return (
    <header className="h-9 bg-black flex items-center text-white text-[13px] shrink-0 divide-x divide-gray-700">
      {/* App switcher */}
      <button className="flex items-center gap-1.5 px-3 h-full hover:bg-gray-800">
        <span
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          className="font-semibold"
        >
          Amdox<span className="text-[#D9A85C]">ERP</span>
        </span>
        <ChevronDown size={12} />
      </button>

      {/* Current module name */}
      <button className="hidden sm:flex items-center gap-1.5 px-3 h-full hover:bg-gray-800 text-gray-300">
        Amdox ERP — {ROLES[role].dept}
        <ChevronDown size={12} />
      </button>

      {/* Breadcrumb */}
      <div className="hidden md:flex items-center gap-1.5 px-3 h-full text-gray-400 flex-1 truncate">
        <span>Amdox ERP</span>
        {parentSection && (
          <>
            <span>›</span>
            <span>{parentSection.label}</span>
          </>
        )}
        {current && (
          <>
            <span>›</span>
            <span className="text-white">{current.label}</span>
          </>
        )}
      </div>

      {/* Utility icons */}
      <button className="px-3 h-full hover:bg-gray-800">
        <Search size={15} />
      </button>
      <button className="px-3 h-full hover:bg-gray-800">
        <Bell size={15} />
      </button>
      <button className="px-3 h-full hover:bg-gray-800">
        <HelpCircle size={15} />
      </button>
      <button className="px-3 h-full hover:bg-gray-800">
        <Plus size={15} />
      </button>
      <button className="px-3 h-full hover:bg-gray-800">
        <Settings size={15} />
      </button>
      <button className="px-3 h-full hover:bg-gray-800">
        <Maximize2 size={14} />
      </button>

      {/* Role switcher (demo only) */}
      <select
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="bg-transparent text-[12px] text-gray-300 outline-none cursor-pointer px-3 h-full"
      >
        {Object.entries(ROLES).map(([key, r]) => (
          <option key={key} value={key} className="text-black">
            {r.label}
          </option>
        ))}
      </select>

      {/* Profile — far right */}
      <div className="flex items-center gap-2 px-3 h-full">
        <span className="font-medium">Pawan</span>
        <div className="h-5 w-5 rounded-full bg-[#D9A85C] text-[#14171F] flex items-center justify-center">
          <User size={12} />
        </div>
      </div>
    </header>
  );
}

interface SidebarProps {
  role: string;
  activePage: string;
  onSelect: (page: string) => void;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
}

/* ── Vertical sidebar — collapsible ── */
function Sidebar({
  role,
  activePage,
  onSelect,
  collapsed,
  setCollapsed,
}: SidebarProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    finance: true,
  });
  const visibleSections = ROLES[role].sections;

  const toggle = (id: string) =>
    setOpenSections((s) => ({ ...s, [id]: !s[id] }));

  const items = NAV.filter(
    (item) => item.leaf || visibleSections.includes(item.id)
  ).filter(
    (item) => item.id !== "settings" || visibleSections.includes("settings")
  );

  return (
    <aside
      className={`border-r border-[#E4E2DC] bg-[#FAFAF9] flex flex-col transition-all duration-200 ${
        collapsed ? "w-14" : "w-60"
      }`}
    >
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {items.map((item) => {
          const Icon = item.icon;

          if (item.leaf) {
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelect(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm mb-0.5 transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                } ${isActive ? "bg-[#1E3A5F] text-white" : "text-[#4A4740] hover:bg-[#EFEDE6]"}`}
              >
                <Icon size={16} />
                {!collapsed && item.label}
              </button>
            );
          }

          const isOpen = openSections[item.id] && !collapsed;
          return (
            <div key={item.id} className="mb-0.5">
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
                className={`w-full flex items-center justify-between px-3 py-2 rounded-md text-sm text-[#4A4740] hover:bg-[#EFEDE6] transition-colors ${
                  collapsed ? "justify-center px-0" : ""
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon size={16} />
                  {!collapsed && item.label}
                </span>
                {!collapsed &&
                  (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />)}
              </button>
              {isOpen && !collapsed && item.children && (
                <div className="ml-6 mt-0.5 border-l border-[#E4E2DC] pl-3">
                  {item.children.map((child) => {
                    const isActive = activePage === child.id;
                    return (
                      <button
                        key={child.id}
                        onClick={() => onSelect(child.id)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-[13px] mb-0.5 flex items-center justify-between transition-colors ${
                          isActive
                            ? "bg-[#1E3A5F]/10 text-[#1E3A5F] font-medium"
                            : "text-[#6B675D] hover:bg-[#EFEDE6]"
                        }`}
                      >
                        <span>{child.label}</span>
                        <span className="text-[10px] font-mono text-[#B0AC9F]">
                          {child.day}
                        </span>
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
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex items-center justify-center py-2.5 border-t border-[#E4E2DC] text-[#8A8678] hover:bg-[#EFEDE6] hover:text-[#1E3A5F] transition-colors"
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
      </button>

      {!collapsed && (
        <div className="px-3 py-3 border-t border-[#E4E2DC] text-[11px] text-[#8A8678]">
          Signed in as{" "}
          <span className="text-[#1E3A5F] font-medium">{ROLES[role].label}</span>
        </div>
      )}
    </aside>
  );
}

interface EmptyContentProps {
  activePage: string;
}
function EmptyContent({ activePage }: EmptyContentProps) {
  // Finance Pages
  if (activePage === "finance-accounts") {
    return <ChartOfAccounts />;
  }

  if (activePage === "finance-journal") {
    return <JournalEntries />;
  }

  if (activePage === "finance-invoices") {
  return <Invoices />;
}
if (activePage === "finance-aging") {
  return <AgingReport />;
}
if (activePage === "crm-leads") {
  return <Leads />;
}
if (activePage === "crm-customers") {
  return <Customers />;
}
if (activePage === "crm-opportunities") {
  return <Opportunities />;
}
if (activePage === "reports") {
  return <ReportsDashboard />;
}

  // Default Placeholder Pages
  const allItems = NAV.flatMap((n) => (n.children || [n]) as NavItem[]);
  const current = allItems.find((i) => i.id === activePage);
  const label = current?.label || "Home";
  const day = (current as { day?: string })?.day;

  return (
    <div className="flex-1 flex items-center justify-center bg-white">
      <div className="text-center max-w-xs">
        <div className="mx-auto h-11 w-11 rounded-lg border border-dashed border-[#D8D5CC] flex items-center justify-center">
          <span className="h-2 w-2 rounded-full bg-[#D8D5CC]" />
        </div>

        <p className="mt-4 text-[#14171F] font-medium text-sm">
          {label}
        </p>

        <p className="mt-1 text-xs text-[#8A8678]">
          {day
            ? `Scheduled to build on ${day} — empty placeholder for now.`
            : "Dashboard widgets render here once each module ships."}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState("executive");
  const [activePage, setActivePage] = useState("home");
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className="h-screen flex flex-col"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
      `}</style>

      <TopBar role={role} setRole={setRole} activePage={activePage} />

      <div className="flex-1 flex overflow-hidden">
  <Sidebar
    role={role}
    activePage={activePage}
    onSelect={setActivePage}
    collapsed={collapsed}
    setCollapsed={setCollapsed}
  />

  <EmptyContent activePage={activePage} />
</div>
    </div>
  );
}
