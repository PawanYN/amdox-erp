import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-lg bg-white shadow-card overflow-hidden ${className}`}
      style={{borderColor: '#dfe3e8', border: '1px solid #dfe3e8'}}
    >
      {children}
    </div>
  );
}
