"use client";

import { useState, useEffect } from "react";
import { financeApi } from "@/lib/api/finance-api";

function StatusPill({ status }: { status: string }) {
  const statusColorMap: Record<string, {bg: string, text: string}> = {
    DRAFT: {bg: '#f3f4f6', text: '#6b7280'},
    SUBMITTED: {bg: '#eff6ff', text: '#1f5fa8'},
    APPROVED: {bg: '#ecfdf5', text: '#059669'},
    RECEIVED: {bg: '#ecfdf5', text: '#059669'},
    CANCELLED: {bg: '#fef2f2', text: '#b91c1c'},
    PENDING_MATCH: {bg: '#fef3c7', text: '#92400e'},
    MATCHED: {bg: '#ecfdf5', text: '#059669'},
    PAID: {bg: '#ecfdf5', text: '#059669'},
  };
  const style = statusColorMap[status] || {bg: '#f3f4f6', text: '#6b7280'};
  return (
    <span
      className="text-[11px] font-medium px-2 py-0.5 rounded-full capitalize"
      style={{background: style.bg, color: style.text}}
    >
      {status.replace("_", " ")}
    </span>
  );
}

type ApInvoice = {
  id: string;
  invoiceNumber?: string;
  vendorId: string;
  status: string;
  totalAmount: number | string;
};

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<ApInvoice[]>([]);
  const [noAccess, setNoAccess] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchInvoices = () =>
    financeApi
      .getInvoices()
      .then((data) => {
        setInvoices(data);
        setNoAccess(false);
      })
      .catch((err) => {
        // AP invoices live in the Finance module. An SCM-only user has no
        // `finance` module grant, so this endpoint returns 403 — surface that
        // clearly instead of silently rendering an empty list.
        const msg = String(err?.message ?? "");
        if (/forbidden|module|access denied|\b403\b/i.test(msg)) {
          setNoAccess(true);
        }
      })
      .finally(() => setLoaded(true));

  useEffect(() => {
    fetchInvoices();
  }, []);

  const approve = async (id: string) => {
    await financeApi.approveInvoice(id);
    fetchInvoices();
  };

  if (noAccess) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg px-4 py-5" style={{border: '1px solid #fcd34d', background: '#fef3c7', color: '#78350f'}}>
          <p className="text-sm font-semibold">AP invoices are managed by Finance</p>
          <p className="mt-1 text-[13px]" style={{color: '#92400e'}}>
            These invoices are auto-created when goods are received and posted to the ledger by the
            Finance team. Your SCM access can raise POs and receive goods, but viewing / approving
            AP invoices requires the <strong>Finance</strong> module.
          </p>
          <p className="mt-2 text-[13px]" style={{color: '#92400e'}}>
            Ask a Finance user (or an admin) to review them under{" "}
            <span className="font-mono">Finance → AP Invoices</span>, or request the Finance module
            be added to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md px-3 py-2 text-[11px]" style={{border: '1px solid #dfe3e8', background: '#f4f6f8', color: '#6b7280'}}>
        OCR extracts invoice → 3-way match: Invoice qty ↔ PO qty ↔ GR qty. Within tolerance →
        auto-approve. Else → manual review queue.
      </div>

      {loaded && invoices.length === 0 && (
        <div className="rounded-md bg-white px-3 py-6 text-center text-[13px]" style={{border: '1px solid #dfe3e8', color: '#6b7280'}}>
          No AP invoices yet. They are created automatically when goods are received against an
          approved purchase order.
        </div>
      )}

      {invoices.map((inv) => {
        const allMatch = inv.status === "APPROVED" || inv.status === "PAID";
        return (
          <div
            key={inv.id}
            className="rounded-lg p-4 bg-white space-y-4 shadow-card"
            style={{border: '1px solid #dfe3e8'}}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold font-mono" style={{color: '#2b2f36'}}>
                  {inv.invoiceNumber || inv.id}
                </p>
                <p className="text-[11px] mt-0.5" style={{color: '#6b7280'}}>{inv.vendorId}</p>
              </div>
              <StatusPill status={inv.status} />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium" style={{color: '#4b5563'}}>Total Amount</p>
              <p className="font-mono font-bold" style={{color: '#2b2f36'}}>
                ₹{Number(inv.totalAmount).toLocaleString()}
              </p>
            </div>

            {allMatch ? (
              <div className="rounded-md px-3 py-2 text-[11px]" style={{background: '#ecfdf5', border: '1px solid #6ee7b7', color: '#059669'}}>
                ✓ All 3 match — auto-approved. emits:{" "}
                <span className="font-mono">invoice.approved</span> → GL posts JournalEntry (debit
                Inventory / credit AP)
              </div>
            ) : (
              <div className="rounded-md px-3 py-2 space-y-2" style={{background: '#fef2f2', border: '1px solid #fecaca'}}>
                <p className="text-[11px]" style={{color: '#b91c1c'}}>
                  Pending match or mismatch detected. Sent to manual review queue.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(inv.id)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-md text-white transition-colors"
                    style={{background: '#059669'}}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#047857'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#059669'}
                  >
                    Override & approve
                  </button>
                  <button className="text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors"
                    style={{border: '1px solid #fca5a5', color: '#b91c1c'}}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
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
