const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

/** One currency format for every money cell: ₹ symbol + Indian digit grouping. */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return inr.format(Number.isFinite(n) ? n : 0);
}
