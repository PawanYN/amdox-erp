type BadgeTone =
  | "active"
  | "inactive"
  | "pending"
  | "approved"
  | "rejected"
  | "processed";

const TONE_CLASSES: Record<BadgeTone, string> = {
  active:    "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
  inactive:  "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
  pending:   "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
  approved:  "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
  rejected:  "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
  processed: "text-[11px] font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1.5",
};

const TONE_STYLES: Record<BadgeTone, {background: string; color: string; borderColor: string}> = {
  active:    { background: "#e6f4ea", color: "#1e7a3e", borderColor: "#1e7a3e" },
  inactive:  { background: "#f7f9fb", color: "#6b7280", borderColor: "#dfe3e8" },
  pending:   { background: "#fff6e0", color: "#8a6300", borderColor: "#8a6300" },
  approved:  { background: "#e6f4ea", color: "#1e7a3e", borderColor: "#1e7a3e" },
  rejected:  { background: "#fdecea", color: "#d0392b", borderColor: "#d0392b" },
  processed: { background: "#e8f1fb", color: "#1f5fa8", borderColor: "#1f5fa8" },
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
  const style = TONE_STYLES[tone];
  return (
    <span
      className={TONE_CLASSES[tone]}
      style={{
        background: style.background,
        color: style.color,
        border: `1px solid ${style.borderColor}`,
      }}
    >
      <span style={{height: '6px', width: '6px', borderRadius: '50%', background: style.color, flexShrink: 0}} />
      {children}
    </span>
  );
}
