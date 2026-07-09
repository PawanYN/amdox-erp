"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/projects/new") return <>{children}</>;

  const tabs = [
    { name: "Overview", path: "/projects/overview" },
    { name: "Milestones", path: "/projects/milestones" },
    { name: "Tasks & Gantt", path: "/projects/tasks" },
    { name: "Resources", path: "/projects/resources" },
    { name: "Budget", path: "/projects/budget" },
  ];

  return (
    <div className="space-y-0">
      {/* Module header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <FolderKanban size={17} className="text-slate-500" />
          <h1 className="text-[15px] font-semibold text-slate-900">Project Management</h1>
        </div>
        <Link href="/projects/new">
          <button className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
            <Plus size={13} /> New Project
          </button>
        </Link>
      </div>
      <p className="text-[12px] text-slate-500 mb-5">
        Coordinates HR (people), SCM (materials) and Finance (budget) via domain events.
      </p>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200 mb-5">
        {tabs.map((t) => {
          const isActive = pathname === t.path;
          return (
            <Link
              key={t.name}
              href={t.path}
              className={`px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              {t.name}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
