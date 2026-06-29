"use client";

import { Users, UserCheck, Calendar } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { mockResources, mockProjects, ProjectResource } from "@/lib/mock/projects";

export default function ProjectResourcesPage() {
  const totalAllocations = mockResources.length;
  // Calculate average allocation percentage
  const avgAllocation = Math.round(
    mockResources.reduce((sum, r) => sum + r.allocationPercentage, 0) / (totalAllocations || 1)
  );
  
  const columns: ColumnDef<ProjectResource>[] = [
    {
      header: "Employee",
      cell: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            {r.employeeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <div>
            <span className="font-semibold text-ink block">{r.employeeName}</span>
            <span className="text-xs text-muted">{r.role}</span>
          </div>
        </div>
      ),
    },
    {
      header: "Project",
      cell: (r) => {
        const project = mockProjects.find((p) => p.id === r.projectId);
        return (
          <span className="text-xs font-medium text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1">
            {project?.name || r.projectId}
          </span>
        );
      },
    },
    {
      header: "Allocation",
      cell: (r) => {
        let color = "bg-emerald-500";
        if (r.allocationPercentage > 80) color = "bg-red-500";
        else if (r.allocationPercentage > 50) color = "bg-amber-500";
        
        return (
          <div className="flex items-center gap-2 w-32">
            <div className="flex-1 h-1.5 bg-line rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${color}`}
                style={{ width: `${r.allocationPercentage}%` }}
              />
            </div>
            <span className="text-xs font-bold text-ink w-8">{r.allocationPercentage}%</span>
          </div>
        );
      },
    },
    {
      header: "Period",
      cell: (r) => (
        <div className="text-sm text-muted">
          <span>{r.startDate} to {r.endDate}</span>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-500 text-white shadow-[0_4px_12px_rgba(6,182,212,0.3)]">
              <Users size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Resource Allocation</h1>
          </div>
          <p className="text-sm text-muted ml-10">Assign employees to tasks and track utilisation heatmaps</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="Total Allocations" value={totalAllocations} icon={<UserCheck size={18} />} gradient="from-cyan-400 to-blue-500" />
        <StatCard label="Average Utilisation" value={`${avgAllocation}%`} icon={<Calendar size={18} />} gradient="from-emerald-400 to-teal-500" />
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={mockResources} columns={columns} keyExtractor={(r) => r.id} emptyMessage="No resources allocated." />
      </div>
    </div>
  );
}
