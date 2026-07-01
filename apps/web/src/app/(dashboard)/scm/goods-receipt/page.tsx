"use client";

export default function GoodsReceiptPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] px-3 py-2 text-[11px] text-[#8A8678]">
        After goods arrive → record receipt → <span className="font-mono text-[#1E3A5F]">currentStock</span> increments → FIFO cost layer updates → emits <span className="font-mono text-[#1E3A5F]">goods.received</span>
      </div>
      <div className="border border-dashed border-[#E4E2DC] rounded-lg p-4 text-center">
        <p className="text-[13px] text-[#8A8678]">Goods Receipts are auto-created when you "Mark received" on an Approved PO.</p>
      </div>
    </div>
  );
}
