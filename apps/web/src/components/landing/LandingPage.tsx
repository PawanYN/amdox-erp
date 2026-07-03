"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  TrendingUp,
  Users,
  Package,
  FolderKanban,
  BarChart3,
} from "lucide-react";

const MODULES = [
  { icon: TrendingUp,   name: "Finance",      desc: "GL, AP/AR, multi-currency" },
  { icon: Users,        name: "HR & Payroll", desc: "Lifecycle, leave, payroll" },
  { icon: Package,      name: "Supply Chain", desc: "Inventory, vendors, PO" },
  { icon: FolderKanban, name: "Projects",     desc: "Budgets, milestones" },
  { icon: BarChart3,    name: "Analytics",    desc: "Dashboards, forecasting" },
];

function LiveKPI({ label, value, prefix = "", suffix = "", highlight = false }: {
  label: string; value: string | number; prefix?: string; suffix?: string; highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-medium">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold tabular-nums ${highlight ? "text-emerald-600" : "text-blue-700"}`}>
        {prefix}{value}{suffix}
      </p>
    </div>
  );
}

function DashboardPreview() {
  const [revenue, setRevenue] = useState(482300);
  const [approvals, setApprovals] = useState(7);
  const [stock, setStock] = useState(94.2);

  useEffect(() => {
    const id = setInterval(() => {
      setRevenue((r) => r + Math.floor(Math.random() * 400));
      setApprovals((a) => Math.max(0, a + (Math.random() > 0.6 ? -1 : 0)));
      setStock((s) => Math.min(99.9, +(s + (Math.random() * 0.2 - 0.05)).toFixed(1)));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-slate-400 font-medium">LIVE DASHBOARD</span>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          syncing
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LiveKPI label="Revenue (MTD)" value={revenue.toLocaleString("en-US")} prefix="$" />
        <LiveKPI label="Stock Health" value={stock} suffix="%" highlight />
        <LiveKPI label="Pending Approvals" value={approvals} />
        <LiveKPI label="Forecast Accuracy" value="91.4" suffix="%" highlight />
      </div>
      <div className="mt-4 flex items-end gap-1 h-12">
        {[40, 55, 48, 62, 58, 70, 66, 78, 74, 85].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-blue-600/15"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function Nav() {
  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-200 bg-white">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
          AX
        </div>
        <span className="text-lg font-semibold text-slate-900 tracking-tight">AmdoxERP</span>
      </div>
      <div className="hidden md:flex items-center gap-8 text-sm text-slate-500">
        <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
        <a href="#modules" className="hover:text-slate-900 transition-colors">Modules</a>
        <a href="#about" className="hover:text-slate-900 transition-colors">About</a>
        <a href="#contact" className="hover:text-slate-900 transition-colors">Contact</a>
      </div>
      <Link
        href="/login"
        className="text-sm font-medium px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
      >
        Login
      </Link>
    </nav>
  );
}

function Hero() {
  return (
    <section className="px-8 py-20 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1 className="text-5xl leading-[1.05] font-semibold text-slate-900">
          Transform Your Business
          <br />
          With AI-Powered ERP
        </h1>
        <p className="mt-5 text-slate-500 text-lg max-w-md">
          Manage HR, Payroll, Inventory, Projects and Analytics from a single
          intelligent platform.
        </p>
        <div className="mt-7 flex gap-3 flex-wrap">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Get Started <ArrowRight size={15} />
          </Link>
          <button className="px-5 py-2.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            Request Demo
          </button>
          <Link href="/home" className="inline-flex items-center px-5 py-2.5 rounded-md border border-slate-200 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors">
            Bypass to Dashboard
          </Link>
          <Link href="/create-tenant" className="inline-flex items-center px-5 py-2.5 rounded-md border border-blue-200 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors">
            Create Tenant
          </Link>
        </div>
      </div>
      <DashboardPreview />
    </section>
  );
}

function ModulesRow() {
  return (
    <section id="modules" className="px-8 py-16 bg-slate-50 border-t border-slate-200">
      <h2 className="text-center text-2xl font-semibold text-slate-900 mb-10">
        All Your Business Needs In One Platform
      </h2>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
        {MODULES.map(({ icon: Icon, name, desc }) => (
          <div
            key={name}
            className="rounded-lg border border-slate-200 bg-white p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <Icon size={20} className="mx-auto text-blue-600" />
            <p className="mt-2 text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-white min-h-screen">
      <Nav />
      <Hero />
      <ModulesRow />
    </div>
  );
}
