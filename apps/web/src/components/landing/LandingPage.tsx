"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Lock,
  Loader2,
  TrendingUp,
  Users,
  Package,
  FolderKanban,
  BarChart3,
} from "lucide-react";

/* ──────────────────────────────────────────────
   Amdox ERP — Landing Page
   - Matches the existing layout (nav, hero, preview panel, modules row)
   - "Login" button routes to a TEMPORARY placeholder page
     (real flow: redirect to Keycloak hosted login — see TODO below)
   ────────────────────────────────────────────── */

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500&display=swap');
`;

const MODULES = [
  { icon: TrendingUp, name: "Finance", desc: "GL, AP/AR, multi-currency" },
  { icon: Users, name: "HR & Payroll", desc: "Lifecycle, leave, payroll" },
  { icon: Package, name: "Supply Chain", desc: "Inventory, vendors, PO" },
  { icon: FolderKanban, name: "Projects", desc: "Budgets, milestones" },
  { icon: BarChart3, name: "Analytics", desc: "Dashboards, forecasting" },
];

interface LiveKPIProps {
  label: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  tone?: "navy" | "mint";
}

function LiveKPI({ label, value, prefix = "", suffix = "", tone = "navy" }: LiveKPIProps) {
  const toneMap = {
    navy: "text-[#1E3A5F]",
    mint: "text-[#2F6B4F]",
  };
  return (
    <div className="rounded-lg border border-[#E4E2DC] bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-[#8A8678] font-medium">
        {label}
      </p>
      <p
        className={`mt-1 font-mono text-xl font-medium ${toneMap[tone]} tabular-nums`}
      >
        {prefix}
        {value}
        {suffix}
      </p>
    </div>
  );
}

function DashboardPreview() {
  const [revenue, setRevenue] = useState(482300);
  const [approvals, setApprovals] = useState(7);
  const [stock, setStock] = useState(94.2);

  // Subtle ambient motion — the one "alive" element on the page
  useEffect(() => {
    const id = setInterval(() => {
      setRevenue((r) => r + Math.floor(Math.random() * 400));
      setApprovals((a) => Math.max(0, a + (Math.random() > 0.6 ? -1 : 0)));
      setStock((s) => Math.min(99.9, +(s + (Math.random() * 0.2 - 0.05)).toFixed(1)));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-[#E4E2DC] bg-[#FCFCFB] p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-[#8A8678]">LIVE DASHBOARD</span>
        <span className="flex items-center gap-1.5 text-[11px] text-[#2F6B4F]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2F6B4F] animate-pulse" />
          syncing
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <LiveKPI label="Revenue (MTD)" value={revenue.toLocaleString("en-US")} prefix="$" tone="navy" />
        <LiveKPI label="Stock Health" value={stock} suffix="%" tone="mint" />
        <LiveKPI label="Pending Approvals" value={approvals} tone="navy" />
        <LiveKPI label="Forecast Accuracy" value="91.4" suffix="%" tone="mint" />
      </div>
      <div className="mt-4 flex items-end gap-1 h-12">
        {[40, 55, 48, 62, 58, 70, 66, 78, 74, 85].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm bg-[#1E3A5F]/15"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}

interface NavProps {
  onLoginClick: () => void;
}

function Nav({ onLoginClick }: NavProps) {
  return (
    <nav className="flex items-center justify-between px-8 py-5 border-b border-[#E4E2DC]">
      <span
        className="text-lg font-semibold tracking-tight text-[#14171F]"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        Amdox<span className="text-[#C99A4B]">ERP</span>
      </span>
      <div className="hidden md:flex items-center gap-8 text-sm text-[#4A4740]">
        <a href="#features" className="hover:text-[#14171F]">Features</a>
        <a href="#modules" className="hover:text-[#14171F]">Modules</a>
        <a href="#about" className="hover:text-[#14171F]">About</a>
        <a href="#contact" className="hover:text-[#14171F]">Contact</a>
      </div>
      <button
        onClick={onLoginClick}
        className="text-sm font-medium px-4 py-2 rounded-md border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors"
      >
        Login
      </button>
    </nav>
  );
}

interface HeroProps {
  onLoginClick: () => void;
}

function Hero({ onLoginClick }: HeroProps) {
  return (
    <section className="px-8 py-20 max-w-7xl mx-auto grid md:grid-cols-2 gap-12 items-center">
      <div>
        <h1
          className="text-5xl leading-[1.05] font-semibold text-[#14171F]"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Transform Your Business
          <br />
          With AI-Powered ERP
        </h1>
        <p className="mt-5 text-[#4A4740] text-lg max-w-md">
          Manage HR, Payroll, Inventory, Projects and Analytics from a single
          intelligent platform.
        </p>
        <div className="mt-7 flex gap-3">
          <button
            onClick={onLoginClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#1E3A5F] text-white text-sm font-medium hover:bg-[#16304d] transition-colors"
          >
            Get Started <ArrowRight size={15} />
          </button>
          <button className="px-5 py-2.5 rounded-md border border-[#D8D5CC] text-sm font-medium text-[#14171F] hover:bg-[#F4F2EC] transition-colors">
            Request Demo
          </button>
          <Link href="/home" className="inline-flex items-center px-5 py-2.5 rounded-md border border-[#D8D5CC] text-sm font-medium text-[#14171F] bg-[#F4F2EC] hover:bg-[#E4E2DC] transition-colors">
            Bypass to Dashboard
          </Link>
        </div>
      </div>
      <DashboardPreview />
    </section>
  );
}

function ModulesRow() {
  return (
    <section id="modules" className="px-8 py-16 bg-[#FAFAF9] border-t border-[#E4E2DC]">
      <h2
        className="text-center text-2xl font-semibold text-[#14171F] mb-10"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      >
        All Your Business Needs In One Platform
      </h2>
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-4">
        {MODULES.map(({ icon: Icon, name, desc }) => (
          <div
            key={name}
            className="rounded-lg border border-[#E4E2DC] bg-white p-4 text-center hover:border-[#1E3A5F] transition-colors"
          >
            <Icon size={20} className="mx-auto text-[#1E3A5F]" />
            <p className="mt-2 text-sm font-medium text-[#14171F]">{name}</p>
            <p className="text-xs text-[#8A8678] mt-0.5">{desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   TEMPORARY login placeholder page.
   Real flow (per our earlier diagram):
     window.location.href =
       `${KEYCLOAK_URL}/realms/${tenantSlug}/protocol/openid-connect/auth
        ?client_id=amdox-erp-web&response_type=code&redirect_uri=...`
   Keycloak hosts the actual login form + SSO buttons —
   this screen is just the transition state until that's wired up.
   ────────────────────────────────────────────── */
interface LoginPlaceholderProps {
  onBack: () => void;
}

function LoginPlaceholder({ onBack }: LoginPlaceholderProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
      <div className="text-center max-w-sm px-6">
        <div className="mx-auto h-12 w-12 rounded-full bg-[#1E3A5F]/10 flex items-center justify-center">
          <Lock size={20} className="text-[#1E3A5F]" />
        </div>
        <Loader2 size={22} className="mx-auto mt-5 animate-spin text-[#8A8678]" />
        <p className="mt-4 text-[#14171F] font-medium">
          Redirecting you to secure sign-in…
        </p>
        <p className="mt-1.5 text-sm text-[#8A8678]">
          This will hand off to Keycloak SSO once integration is wired up.
        </p>
        <button
          onClick={onBack}
          className="mt-6 text-sm text-[#1E3A5F] hover:underline"
        >
          ← Back to home
        </button>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [page, setPage] = useState("landing"); // "landing" | "login"

  return (
    <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      {page === "landing" ? (
        <div className="bg-white min-h-screen">
          <Nav onLoginClick={() => setPage("login")} />
          <Hero onLoginClick={() => setPage("login")} />
          <ModulesRow />
        </div>
      ) : (
        <LoginPlaceholder onBack={() => setPage("landing")} />
      )}
    </div>
  );
}
