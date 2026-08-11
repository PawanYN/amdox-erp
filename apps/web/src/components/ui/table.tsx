import { CSSProperties, MouseEvent, ReactNode } from "react";

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-[13px]">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
      <tr>{children}</tr>
    </thead>
  );
}

export function TH({
  children,
  className = "",
  style,
  onMouseDown,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onMouseDown?: (e: MouseEvent<HTMLTableCellElement>) => void;
}) {
  return (
    <th
      className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap ${className}`}
      style={style}
      onMouseDown={onMouseDown}
    >
      {children}
    </th>
  );
}

export function TBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>;
}

export function TR({ children }: { children: ReactNode }) {
  return <tr className="hover:bg-slate-50/60 transition-colors duration-100">{children}</tr>;
}

export function TD({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <td className={`px-4 py-3 align-middle text-slate-700 ${className}`} style={style}>
      {children}
    </td>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="px-6 py-14 text-center">
      <div className="mx-auto h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-3">
        <span className="text-xl select-none">📭</span>
      </div>
      <p className="text-[13px] text-slate-500">{message}</p>
    </div>
  );
}
