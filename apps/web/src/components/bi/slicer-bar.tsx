"use client";

import { PBI } from "./power-bi-theme";

export type SlicerState = {
  department: string;
  period: string;
  status: string;
};

type SlicerBarProps = {
  slicers: SlicerState;
  onChange: (next: SlicerState) => void;
  departmentOptions?: string[];
};

export function SlicerBar({
  slicers,
  onChange,
  departmentOptions = [],
}: SlicerBarProps) {
  const deptChoices = [
    { value: "all", label: "All departments" },
    ...departmentOptions.map((name) => ({
      value: name.toLowerCase().replace(/\s+/g, "_"),
      label: name,
    })),
  ];

  if (deptChoices.length === 1) {
    deptChoices.push(
      { value: "finance", label: "Finance" },
      { value: "hr", label: "Human Resources" },
      { value: "operations", label: "Operations" },
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-3 px-4 py-2 shrink-0"
      style={{ background: PBI.slicerBg, borderBottom: `1px solid ${PBI.paneBorder}` }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PBI.textMuted }}>
        Filters
      </span>
      <Slicer
        label="Period"
        value={slicers.period}
        options={[
          { value: "all", label: "All periods" },
          { value: "current", label: "Current (0–30d)" },
          { value: "overdue", label: "Overdue" },
        ]}
        onChange={(period) => onChange({ ...slicers, period })}
      />
      <Slicer
        label="Status"
        value={slicers.status}
        options={[
          { value: "all", label: "All statuses" },
          { value: "open", label: "Open" },
          { value: "closed", label: "Closed / paid" },
        ]}
        onChange={(status) => onChange({ ...slicers, status })}
      />
      <Slicer
        label="Department"
        value={slicers.department}
        options={deptChoices}
        onChange={(department) => onChange({ ...slicers, department })}
      />
    </div>
  );
}

function Slicer({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[12px]" style={{ color: PBI.text }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-[12px] px-2 py-1 rounded border min-w-[120px] outline-none focus:border-[#118DFF] bg-white"
        style={{ borderColor: PBI.paneBorder, color: PBI.text }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Client-side filter fallback when API filters are not applied */
export function applySlicers<T extends { name: string; value: number; key?: string }>(
  series: T[],
  slicers: SlicerState,
  context: "ar" | "inventory" | "generic",
): T[] {
  let filtered = [...series];
  if (context === "ar" && slicers.period !== "all") {
    if (slicers.period === "current") {
      filtered = filtered.filter((s) => s.key === "Current" || s.name === "Current");
    } else if (slicers.period === "overdue") {
      filtered = filtered.filter(
        (s) => s.key === "90+" || s.key === "61-90" || s.name === "90+" || s.name === "61–90",
      );
    }
  }
  if (slicers.status === "open" && context === "generic") {
    filtered = filtered.filter((s) => s.value > 0);
  }
  return filtered;
}

export function slicersToFilterParams(slicers: SlicerState) {
  return {
    period: slicers.period,
    department: slicers.department,
    status: slicers.status,
  };
}
