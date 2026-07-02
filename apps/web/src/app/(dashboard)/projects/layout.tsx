"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Plus } from "lucide-react";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  if (pathname === "/projects/new") {
    return <>{children}</>;
  }

  const tabs = [
    { name: "Projects", path: "/projects/overview" },
    { name: "Milestones", path: "/projects/milestones" },
    { name: "Gantt & Tasks", path: "/projects/tasks" },
    { name: "Resource Heatmap", path: "/projects/resources" },
    { name: "Budget Tracking", path: "/projects/budget" },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#FAFAF9]" style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
      `}</style>

      <div className="max-w-5xl mx-auto py-8">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <FolderKanban size={20} className="text-[#1E3A5F]" />
            <h1 className="text-lg font-semibold text-[#14171F]" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              Project Management
            </h1>
            <span className="text-[10px] font-mono text-white bg-[#8A8678] px-1.5 py-0.5 rounded">V2</span>
          </div>
          <Link href="/projects/new">
            <button className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white hover:bg-[#16304d] transition-colors">
              <Plus size={14} /> New Project
            </button>
          </Link>
        </div>
        <p className="text-[12px] text-[#8A8678] mb-6">
          Coordinates HR (people), SCM (materials) and Finance (budget) via domain events — never queries their data directly.
        </p>

        <div className="flex gap-1 border-b border-[#E4E2DC] mb-5">
          {tabs.map((t) => {
            const isActive = pathname === t.path;
            return (
              <Link
                key={t.name}
                href={t.path}
                className={`px-3 py-2 text-[13px] font-medium border-b-2 -mb-px transition-colors ${
                  isActive
                    ? "border-[#1E3A5F] text-[#1E3A5F]"
                    : "border-transparent text-[#8A8678] hover:text-[#4A4740]"
                }`}
              >
                {t.name}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </div>
  );
}
