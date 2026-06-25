import { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-card shadow-card overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
      {children}
    </div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-line bg-gradient-to-r from-canvas to-white">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({ children }: { children: ReactNode }) {
  return (
    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted/70">
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-line/60">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return (
    <tr className="tr-hover hover:bg-canvas/70 group">
      {children}
    </tr>
  );
}

export function TD({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-6 py-4 align-middle ${className}`}>{children}</td>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto h-12 w-12 rounded-2xl bg-canvas border border-line flex items-center justify-center mb-3">
        <span className="text-2xl">📭</span>
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}
