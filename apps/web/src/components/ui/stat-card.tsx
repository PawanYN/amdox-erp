"use client";

import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient?: string;
  color?: string;
  delay?: string;
  delta?: string;
  deltaPositive?: boolean;
}

export function StatCard({
  label,
  value,
  icon,
  gradient = "from-blue-500 to-blue-600",
  color,
  delay = "0s",
  delta,
  deltaPositive,
}: StatCardProps) {
  return (
    <div
      className="animate-fade-in-up bg-white rounded-lg border border-slate-200 p-5 shadow-card hover:shadow-card-hover transition-shadow duration-200"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
            {label}
          </p>
          <p className="text-2xl font-semibold text-slate-900 tracking-tight">{value}</p>
          {delta && (
            <p
              className={`text-[11px] font-medium mt-1 ${
                deltaPositive ? "text-emerald-600" : "text-red-500"
              }`}
            >
              {deltaPositive ? "+" : ""}
              {delta}
            </p>
          )}
        </div>
        <div
          className={`h-10 w-10 shrink-0 flex items-center justify-center rounded-lg text-white ${
            color ? "" : `bg-gradient-to-br ${gradient}`
          }`}
          style={color ? { backgroundColor: color } : undefined}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
