"use client";

export default function GoodsReceiptPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        After goods arrive → record receipt →{" "}
        <span className="font-mono text-blue-700">currentStock</span> increments → FIFO cost layer updates → emits{" "}
        <span className="font-mono text-blue-700">goods.received</span>
      </div>
      <div className="border border-dashed border-slate-200 rounded-lg p-6 text-center">
        <p className="text-[13px] text-slate-500">
          Goods Receipts are auto-created when you "Mark received" on an Approved PO.
        </p>
      </div>
    </div>
  );
}
