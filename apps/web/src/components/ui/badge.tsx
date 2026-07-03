type BadgeTone =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "processed";

const TONE_CLASSES: Record<BadgeTone, string> = {
  active:    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  inactive:  "bg-slate-100  text-slate-500   border border-slate-200",
  pending:   "bg-amber-50   text-amber-700   border border-amber-200",
  approved:  "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected:  "bg-red-50     text-red-600     border border-red-200",
  processed: "bg-blue-50    text-blue-700    border border-blue-200",
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  active:    "bg-emerald-500",
  inactive:  "bg-slate-400",
  pending:   "bg-amber-500",
  approved:  "bg-emerald-500",
  rejected:  "bg-red-500",
  processed: "bg-blue-500",
};

export function statusToTone(status: string): BadgeTone {
  const key = status.toLowerCase();
  if (key in TONE_CLASSES) return key as BadgeTone;
  if (key === "active" || key === "approved" || key === "paid") return "approved";
  if (key === "inactive" || key === "cancelled") return "inactive";
  if (key === "pending" || key === "pending_match" || key === "draft") return "pending";
  if (key === "rejected" || key === "overdue") return "rejected";
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${TONE_CLASSES[tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT_CLASSES[tone]}`} />
      {children}
    </span>
  );
}
