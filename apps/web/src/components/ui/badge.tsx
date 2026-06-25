type BadgeTone =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "processed";

const TONE_CLASSES: Record<BadgeTone, string> = {
  active:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
  inactive:
    "bg-slate-50 text-slate-500 border border-slate-200",
  pending:
    "bg-amber-50 text-amber-700 border border-amber-200 shadow-[0_0_8px_rgba(245,158,11,0.15)]",
  approved:
    "bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-[0_0_8px_rgba(16,185,129,0.15)]",
  rejected:
    "bg-red-50 text-red-600 border border-red-200 shadow-[0_0_8px_rgba(239,68,68,0.15)]",
  processed:
    "bg-violet-50 text-violet-700 border border-violet-200 shadow-[0_0_8px_rgba(108,71,255,0.15)]",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  active: "bg-emerald-500",
  inactive: "bg-slate-400",
  pending: "bg-amber-500",
  approved: "bg-emerald-500",
  rejected: "bg-red-500",
  processed: "bg-violet-600",
};

export function statusToTone(status: string): BadgeTone {
  const key = status.toLowerCase();
  if (key in TONE_CLASSES) return key as BadgeTone;
  return "inactive";
}

export function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: BadgeTone;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
