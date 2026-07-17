import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white shadow-card overflow-hidden ${className}`}
    >
      {children}
    </div>
  );
}
