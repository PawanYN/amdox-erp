"use client";

import { useState, useEffect } from "react";
import { financeApi } from "@/lib/api/finance-api";

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-600",
  SUBMITTED: "bg-blue-50 text-blue-700",
  APPROVED: "bg-emerald-50 text-emerald-700",
  RECEIVED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-600",
  PENDING_MATCH: "bg-amber-50 text-amber-700",
  MATCHED: "bg-emerald-50 text-emerald-700",
  PAID: "bg-emerald-50 text-emerald-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[status] || "bg-slate-100 text-slate-600"}`}
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
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-5 text-amber-800">
          <p className="text-sm font-semibold">AP invoices are managed by Finance</p>
          <p className="mt-1 text-[13px] text-amber-700">
            These invoices are auto-created when goods are received and posted to the ledger by the
            Finance team. Your SCM access can raise POs and receive goods, but viewing / approving
            AP invoices requires the <strong>Finance</strong> module.
          </p>
          <p className="mt-2 text-[13px] text-amber-700">
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
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        OCR extracts invoice → 3-way match: Invoice qty ↔ PO qty ↔ GR qty. Within tolerance →
        auto-approve. Else → manual review queue.
      </div>

      {loaded && invoices.length === 0 && (
        <div className="rounded-md border border-slate-200 bg-white px-3 py-6 text-center text-[13px] text-slate-500">
          No AP invoices yet. They are created automatically when goods are received against an
          approved purchase order.
        </div>
      )}

      {invoices.map((inv) => {
        const allMatch = inv.status === "APPROVED" || inv.status === "PAID";
        return (
          <div
            key={inv.id}
            className="border border-slate-200 rounded-lg p-4 bg-white space-y-4 shadow-card"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-semibold text-slate-900 font-mono">
                  {inv.invoiceNumber || inv.id}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">{inv.vendorId}</p>
              </div>
              <StatusPill status={inv.status} />
            </div>

            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-slate-700">Total Amount</p>
              <p className="font-mono font-bold text-slate-900">
                ₹{Number(inv.totalAmount).toLocaleString()}
              </p>
            </div>

            {allMatch ? (
              <div className="rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-[11px] text-emerald-700">
                ✓ All 3 match — auto-approved. emits:{" "}
                <span className="font-mono">invoice.approved</span> → GL posts JournalEntry (debit
                Inventory / credit AP)
              </div>
            ) : (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 space-y-2">
                <p className="text-[11px] text-red-600">
                  Pending match or mismatch detected. Sent to manual review queue.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => approve(inv.id)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                  >
                    Override & approve
                  </button>
                  <button className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-red-300 text-red-600 hover:bg-red-50 transition-colors">
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
