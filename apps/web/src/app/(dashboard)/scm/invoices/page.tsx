"use client";

import { useState, useEffect } from "react";
import { financeApi } from "@/lib/api/finance-api";

const statusColor: Record<string, string> = {
  DRAFT: "bg-[#F0EEE7] text-[#8A8678]",
  SUBMITTED: "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  APPROVED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  RECEIVED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  CANCELLED: "bg-[#B4533B]/10 text-[#B4533B]",
  PENDING_MATCH: "bg-[#D9A85C]/10 text-[#D9A85C]",
  MATCHED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  PAID: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[status] || "bg-[#F0EEE7] text-[#8A8678]"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);

  const fetchInvoices = () => financeApi.getInvoices().then(setInvoices);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const approve = async (id: string) => {
    await financeApi.approveInvoice(id);
    fetchInvoices();
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-[#E4E2DC] bg-[#FAFAF9] px-3 py-2 text-[11px] text-[#8A8678]">
        OCR extracts invoice → 3-way match: Invoice qty ↔ PO qty ↔ GR qty. Within tolerance → auto-approve. Else → manual_review queue.
      </div>
      {invoices.map((inv) => {
        const allMatch = inv.status === "APPROVED" || inv.status === "PAID";
        return (
          <div key={inv.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-medium text-[#14171F] font-mono">{inv.invoiceNumber || inv.id}</p>
                <p className="text-[11px] text-[#8A8678]">{inv.vendorId}</p>
              </div>
              <StatusPill status={inv.status} />
            </div>

            <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium text-[#14171F]">Total Amount</p>
                <p className="font-mono font-bold">₹{Number(inv.totalAmount).toLocaleString()}</p>
            </div>

            {allMatch ? (
              <div className="rounded-md bg-[#2F6B4F]/10 border border-[#2F6B4F]/30 px-3 py-2 text-[11px] text-[#2F6B4F]">
                ✓ All 3 match — auto-approved. emits: <span className="font-mono">invoice.approved</span> → GL posts JournalEntry (debit Inventory / credit AP)
              </div>
            ) : (
              <div className="rounded-md bg-[#B4533B]/10 border border-[#B4533B]/30 px-3 py-2">
                <p className="text-[11px] text-[#B4533B] mb-2">
                  Pending Match or Mismatch detected. Sent to manual_review queue.
                </p>
                <div className="flex gap-2">
                  <button onClick={() => approve(inv.id)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#2F6B4F] text-white">
                    Override & approve
                  </button>
                  <button className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#B4533B] text-[#B4533B]">
                    Reject invoice
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
