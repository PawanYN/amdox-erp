"use client";

import { DollarSign, AlertTriangle, Wallet } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockProjects, Project } from "@/lib/mock/projects";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ProjectBudgetPage() {
  const totalPlanned = mockProjects.reduce((sum, p) => sum + p.budgetPlanned, 0);
  const totalActual = mockProjects.reduce((sum, p) => sum + p.budgetActual, 0);
  
  // Count how many projects are over budget
  const overBudgetCount = mockProjects.filter((p) => p.budgetActual > p.budgetPlanned).length;

  const columns: ColumnDef<Project>[] = [
    {
      header: "Project",
      cell: (p) => (
        <span className="font-semibold text-ink">{p.name}</span>
      ),
    },
    {
      header: "Manager",
      cell: (p) => (
        <span className="text-sm text-muted">{p.managerName}</span>
      ),
    },
    {
      header: "Planned Budget",
      className: "font-semibold text-ink",
      cell: (p) => formatINR(p.budgetPlanned),
    },
    {
      header: "Actual Spend",
      cell: (p) => {
        const isOverBudget = p.budgetActual > p.budgetPlanned;
        return (
          <span className={`font-semibold ${isOverBudget ? "text-red-600" : "text-emerald-600"}`}>
            {formatINR(p.budgetActual)}
          </span>
        );
      },
    },
    {
      header: "Variance",
      cell: (p) => {
        const variance = p.budgetPlanned - p.budgetActual;
        const isOverBudget = variance < 0;
        
        return (
          <div className="flex items-center gap-2">
            <span className={`font-mono text-sm font-bold ${isOverBudget ? "text-red-500" : "text-emerald-500"}`}>
              {isOverBudget ? "-" : "+"}{formatINR(Math.abs(variance))}
            </span>
            {isOverBudget && (
              <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded border border-red-100 font-bold uppercase">
                Over
              </span>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)]">
              <DollarSign size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Budget Tracking</h1>
          </div>
          <p className="text-sm text-muted ml-10">Compare planned vs actual costs and track variance alerts</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="Total Planned Budget" value={formatINR(totalPlanned)} icon={<Wallet size={18} />} gradient="from-cyan-400 to-blue-500" />
        <StatCard label="Total Actual Spend" value={formatINR(totalActual)} icon={<DollarSign size={18} />} gradient="from-emerald-400 to-teal-500" />
        <StatCard label="Over Budget Alerts" value={overBudgetCount} icon={<AlertTriangle size={18} />} gradient="from-rose-400 to-pink-500" />
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={mockProjects} columns={columns} keyExtractor={(p) => p.id} emptyMessage="No projects found." />
      </div>
    </div>
  );
}
