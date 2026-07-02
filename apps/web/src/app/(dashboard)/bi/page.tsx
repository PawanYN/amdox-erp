"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { biApi } from "@/lib/api/bi-api";
import { StatCard } from "@/components/ui/stat-card";
import { LayoutDashboard, Users, Package, FolderKanban } from "lucide-react";

const AGING_COLORS = ["#2F6B4F", "#1E3A5F", "#D9A85C", "#B4533B", "#7B2D2D"];

export default function ExecutiveDashboardPage() {
  const [kpis, setKpis] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    biApi
      .getKpis()
      .then(setKpis)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-600 text-sm">{error}</p>;
  if (!kpis) return <p className="text-sm text-muted">Loading executive KPIs…</p>;

  const agingData = [
    { name: "Current", value: kpis.arAging.current },
    { name: "31–60", value: kpis.arAging.d31_60 },
    { name: "61–90", value: kpis.arAging.d61_90 },
    { name: "90+", value: kpis.arAging.over90 },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink flex items-center gap-2">
          <LayoutDashboard size={22} /> Executive Dashboard
        </h1>
        <p className="text-sm text-muted mt-1">
          Real-time KPI monitoring and board-level reporting (PDF §1.2, F-08).
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <StatCard
          label="Open POs"
          value={String(kpis.totals.openPurchaseOrders)}
          icon={<Package size={18} />}
          gradient="from-blue-500 to-indigo-600"
        />
        <StatCard
          label="Active employees"
          value={String(kpis.totals.activeEmployees)}
          icon={<Users size={18} />}
          gradient="from-green-500 to-emerald-600"
        />
        <StatCard
          label="Active projects"
          value={String(kpis.totals.activeProjects)}
          icon={<FolderKanban size={18} />}
          gradient="from-violet-500 to-purple-600"
        />
        <StatCard
          label="Invoices"
          value={String(kpis.totals.invoices)}
          icon={<LayoutDashboard size={18} />}
          gradient="from-amber-400 to-orange-500"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="border border-[#E4E2DC] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">AR Aging (₹)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={agingData} dataKey="value" nameKey="name" outerRadius={80} label>
                {agingData.map((_, i) => (
                  <Cell key={i} fill={AGING_COLORS[i % AGING_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => `₹${Number(v ?? 0).toLocaleString()}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="border border-[#E4E2DC] rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-4">Inventory snapshot</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={kpis.inventorySnapshot.slice(0, 8)}>
              <XAxis dataKey="sku" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="quantity" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
