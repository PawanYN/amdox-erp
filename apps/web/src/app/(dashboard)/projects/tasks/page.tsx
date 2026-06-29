"use client";

import { CheckSquare, ListTodo, Play, CheckCircle } from "lucide-react";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Badge, statusToTone } from "@/components/ui/badge";
import { mockTasks, mockProjects, ProjectTask } from "@/lib/mock/projects";

export default function ProjectTasksPage() {
  const todoCount = mockTasks.filter((t) => t.status === "To Do").length;
  const inProgressCount = mockTasks.filter((t) => t.status === "In Progress").length;
  const doneCount = mockTasks.filter((t) => t.status === "Done").length;

  const columns: ColumnDef<ProjectTask>[] = [
    {
      header: "Project",
      cell: (t) => {
        const project = mockProjects.find((p) => p.id === t.projectId);
        return (
          <span className="text-xs font-medium text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2.5 py-1">
            {project?.name || t.projectId}
          </span>
        );
      },
    },
    {
      header: "Task",
      cell: (t) => (
        <div>
          <span className="font-semibold text-ink block">{t.title}</span>
          <span className="text-xs text-muted font-mono">{t.id}</span>
        </div>
      ),
    },
    {
      header: "Assignee",
      cell: (t) => (
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
            {t.assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
          </div>
          <span className="text-sm text-ink">{t.assigneeName}</span>
        </div>
      ),
    },
    {
      header: "Start Date",
      className: "text-sm text-muted",
      cell: (t) => t.startDate,
    },
    {
      header: "End Date",
      className: "text-sm text-muted",
      cell: (t) => t.endDate,
    },
    {
      header: "Priority",
      cell: (t) => {
        const colors = {
          High: "bg-red-50 text-red-600 border-red-200",
          Medium: "bg-amber-50 text-amber-600 border-amber-200",
          Low: "bg-slate-50 text-slate-600 border-slate-200",
        };
        return (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${colors[t.priority]}`}>
            {t.priority}
          </span>
        );
      },
    },
    {
      header: "Status",
      cell: (t) => {
        const tones = {
          "To Do": "slate",
          "In Progress": "blue",
          "Review": "amber",
          "Done": "emerald",
        } as const;
        return <Badge tone={tones[t.status]}>{t.status}</Badge>;
      },
    },
  ];

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-pink-400 to-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,0.3)]">
              <CheckSquare size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Tasks &amp; Milestones</h1>
          </div>
          <p className="text-sm text-muted ml-10">WBS tracking and DAG dependencies validation</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
        <StatCard label="To Do" value={todoCount} icon={<ListTodo size={18} />} gradient="from-slate-400 to-slate-500" />
        <StatCard label="In Progress" value={inProgressCount} icon={<Play size={18} />} gradient="from-cyan-400 to-blue-500" />
        <StatCard label="Done" value={doneCount} icon={<CheckCircle size={18} />} gradient="from-emerald-400 to-teal-500" />
      </div>

      <div className="mt-6 animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
        <DataTable data={mockTasks} columns={columns} keyExtractor={(t) => t.id} emptyMessage="No tasks found." />
      </div>
    </div>
  );
}
