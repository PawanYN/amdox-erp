"use client";

import { FolderKanban, CheckCircle2, Clock, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, statusToTone } from "@/components/ui/badge";
import { mockProjects, Project } from "@/lib/mock/projects";

function formatINR(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ProjectsOverviewPage() {
  const activeProjects = mockProjects.filter((p) => p.status === "Active").length;
  const completedProjects = mockProjects.filter((p) => p.status === "Completed").length;
  const totalBudget = mockProjects.reduce((sum, p) => sum + p.budgetPlanned, 0);

  const columns: ColumnDef<Project>[] = [
    {
      header: "Project Name",
      cell: (p) => (
        <div>
          <span className="font-semibold text-ink block">{p.name}</span>
          <span className="text-xs text-muted truncate max-w-[200px] block">{p.description}</span>
        </div>
      ),
    },
    {
      header: "Manager",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
            {p.managerName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="text-sm text-ink">{p.managerName}</span>
        </div>
      ),
    },
    {
      header: "Timeline",
      cell: (p) => (
        <div className="text-xs text-muted">
          <span className="block">{p.startDate} to</span>
          <span className="block">{p.endDate}</span>
        </div>
      ),
    },
    {
      header: "Budget (Planned vs Actual)",
      cell: (p) => (
        <div>
          <span className="text-sm font-semibold text-ink block">{formatINR(p.budgetPlanned)}</span>
          <span className={`text-xs ${p.budgetActual > p.budgetPlanned ? "text-red-500" : "text-emerald-600"}`}>
            Actual: {formatINR(p.budgetActual)}
          </span>
        </div>
      ),
    },
    {
      header: "Progress",
      cell: (p) => (
        <div className="flex items-center gap-2 w-24">
          <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
            <div 
              className="h-full bg-brand-purple rounded-full" 
              style={{ width: `${p.completionPercentage}%` }}
            />
          </div>
          <span className="text-xs font-bold text-ink">{p.completionPercentage}%</span>
        </div>
      ),
    },
    {
      header: "Status",
      cell: (p) => <Badge tone={statusToTone(p.status)}>{p.status}</Badge>,
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
              <FolderKanban size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Project Overview</h1>
          </div>
          <p className="text-sm text-muted ml-10">High-level portfolio view across the organization</p>
        </div>
        <Button icon={<Plus size={16} />}>
          Create Project
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="Active Projects" value={activeProjects} icon={<FolderKanban size={18} />} gradient="from-violet-500 to-purple-600" />
        <StatCard label="Completed Projects" value={completedProjects} icon={<CheckCircle2 size={18} />} gradient="from-emerald-400 to-teal-500" />
        <StatCard label="Total Portfolio Budget" value={formatINR(totalBudget)} icon={<AlertCircle size={18} />} gradient="from-amber-400 to-orange-500" />
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={mockProjects} columns={columns} keyExtractor={(p) => p.id} emptyMessage="No projects found." />
      </div>
    </div>
  );
}
