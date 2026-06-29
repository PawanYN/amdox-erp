"use client";

import React from "react";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  gradient: string;
  delay?: string;
}

export function StatCard({
  label,
  value,
  icon,
  gradient,
  delay = "0s",
}: StatCardProps) {
  return (
    <div
      className="animate-fade-in-up rounded-2xl border border-line bg-card p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-0.5 group"
      style={{ animationDelay: delay }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted/70">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-ink">{value}</p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white shadow-[0_4px_12px_rgba(0,0,0,0.15)] group-hover:scale-110 transition-transform duration-300`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
