"use client";

type DrillDownResult = {
  columns: string[];
  rows: Record<string, unknown>[];
};

export function DrillDownPanel({
  title,
  data,
  onClose,
}: {
  title: string;
  data: DrillDownResult | null;
  onClose: () => void;
}) {
  if (!data) return null;

  return (
    <div className="mt-4 border border-[#E4E2DC] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-[#F7F6F3] border-b border-[#E4E2DC]">
        <h3 className="text-sm font-semibold">Drill-down: {title}</h3>
        <button type="button" onClick={onClose} className="text-xs text-muted hover:text-ink">
          Close
        </button>
      </div>
      <div className="overflow-x-auto max-h-64">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E2DC] bg-white">
              {data.columns.map((col) => (
                <th key={col} className="text-left px-3 py-2 font-medium text-muted">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={data.columns.length} className="px-3 py-4 text-muted text-center">
                  No records for this segment.
                </td>
              </tr>
            ) : (
              data.rows.map((row, i) => (
                <tr key={i} className="border-b border-[#E4E2DC]/60 hover:bg-[#FAFAF8]">
                  {data.columns.map((_, colIdx) => {
                    const val = Object.values(row)[colIdx];
                    return (
                      <td key={colIdx} className="px-3 py-2">
                        {typeof val === "number"
                          ? val.toLocaleString()
                          : String(val ?? "—")}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
