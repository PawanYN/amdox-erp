"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, Receipt, AlertTriangle, CheckCircle2, Check, TrendingDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { financeApi } from "@/lib/api/finance-api";


/**
 * WHAT: AP Invoices page — shows all vendor invoices fetched from the backend.
 * WHY: Accounts Payable is the record of money owed to suppliers. This page
 * lets finance users see invoice status and manually approve invoices that
 * failed the automatic 3-way match (SCM → AP → GL flow).
 *
 * BACKEND FLOW:
 *   1. SCM triggers goods receipt → BullMQ event → AP Service auto-generates invoice.
 *   2. If 3-way match passes, invoice is auto-approved.
 *   3. If it fails, the "Manual Approve" button here triggers POST /finance/ap/invoices/:id/approve.
 *   4. Approval emits invoice.approved → GL posts Debit AP / Credit Cash.
 *
 * ENDPOINTS:
 *   GET  /finance/ap/invoices
 *   POST /finance/ap/invoices/:id/approve
 */

type BackendInvoice = {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  issueDate: string;
  dueDate: string;
  totalAmount: string | number;
  status: string;
  type: string;
};

const STATUS_TONE: Record<string, "approved" | "pending" | "rejected" | "processed" | "inactive"> = {
  PAID:          "processed",
  APPROVED:      "approved",
  PENDING_MATCH: "pending",
  OVERDUE:       "rejected",
};

function InvoiceUploadButton({
  onUploaded,
  disabled,
}: {
  onUploaded: () => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = ".pdf,.png,.jpg";

  const validateFile = (f: File) => {
    const okExt = ["application/pdf", "image/png", "image/jpeg"].includes(f.type);
    if (okExt) return true;

    const lower = f.name.toLowerCase();
    return lower.endsWith(".pdf") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg");
  };

  const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);

    const f = e.target.files?.[0];
    if (!f) return;
    if (!validateFile(f)) {
      setError("Please upload a PDF or image (PNG/JPG). ");
      setFile(null);
      return;
    }
    setFile(f);
    setOpen(true);
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setLoading(true);
      setError(null);
      await financeApi.uploadInvoice(file);
      setOpen(false);
      setFile(null);
      onUploaded();
    } catch (err: any) {
      setError(err?.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <input
        id="ap-invoice-upload"
        type="file"
        accept={accept}
        className="hidden"
        onChange={handlePick}
        disabled={disabled || loading}
      />

      <Button
        variant="outline"
        icon={<Upload size={14} />}
        onClick={() => document.getElementById("ap-invoice-upload")?.click()}
        disabled={disabled || loading}
      >
        Upload invoice
      </Button>

      <Modal
        open={open}
        title="Upload Invoice"
        description={file ? `Selected: ${file.name}` : undefined}
        onClose={() => {
          if (loading) return;
          setOpen(false);
          setFile(null);
          setError(null);
        }}
        ariaLabel="Upload invoice modal"
        width="max-w-md"
      >
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="text-sm text-muted">
            OCR is mocked by default. The original file will not be stored—only extracted invoice data.
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (loading) return;
                setOpen(false);
                setFile(null);
                setError(null);
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={loading || !file} icon={<Plus size={14} />}>
              {loading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading]   = useState(true);

  const fetchInvoices = async () => {



    try {
      setLoading(true);
      const data = await financeApi.getInvoices();
      setInvoices(data);
    } catch (err) {
      console.error("Failed to fetch invoices", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, []);

  const handleApprove = async (id: string) => {
    try {
      await financeApi.approveInvoice(id);
      fetchInvoices();
    } catch (err) {
      console.error("Approval failed", err);
    }
  };

  const totalAmount    = invoices.reduce((acc, i) => acc + Number(i.totalAmount), 0);
  const pendingCount   = invoices.filter(i => i.status === "PENDING_MATCH").length;
  const approvedAmount = invoices.filter(i => i.status === "APPROVED" || i.status === "PAID")
                                 .reduce((acc, i) => acc + Number(i.totalAmount), 0);

  const columns: ColumnDef<BackendInvoice>[] = [
    {
      header: "Invoice #",
      cell: invoice => (
        <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
          {invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor ID",
      cell: invoice => <span className="font-medium text-ink text-sm">{invoice.vendorId || "—"}</span>,
    },
    {
      header: "Date Issued",
      cell: invoice => (
        <span className="text-sm text-muted">{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</span>
      ),
    },
    {
      header: "Due Date",
      cell: invoice => {
        const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== "PAID";
        return (
          <span className={`text-sm ${isOverdue ? "text-rose-600 font-medium" : "text-muted"}`}>
            {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
          </span>
        );
      },
    },
    {
      header: "Amount",
      cell: invoice => (
        <span className="font-mono font-medium text-ink">
          ₹{Number(invoice.totalAmount).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Status",
      cell: invoice => (
        <Badge tone={STATUS_TONE[invoice.status] || "inactive"}>
          {invoice.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      header: "Action",
      cell: invoice => (
        invoice.status === "PENDING_MATCH" ? (
          <Button variant="outline" onClick={() => handleApprove(invoice.id)} icon={<Check size={14} />}>
            Manual Approve
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]">
              <TrendingDown size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">AP Invoices (Payable)</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Vendor invoices auto-generated via SCM 3-way match. Approve manually if match fails.
          </p>
        </div>

        {/* ── Upload Invoice ── */}
        <InvoiceUploadButton onUploaded={fetchInvoices} disabled={loading} />
      </div>




      {/* ── KPI Cards ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total AP"          value={`₹${totalAmount.toLocaleString()}`}    icon={<Receipt size={18} />}       gradient="from-violet-500 to-fuchsia-600" delay="0.05s" />
        <StatCard label="Approved / Paid"   value={`₹${approvedAmount.toLocaleString()}`} icon={<CheckCircle2 size={18} />}  gradient="from-emerald-400 to-teal-500"   delay="0.10s" />
        <StatCard label="Pending Approval"  value={pendingCount}                           icon={<AlertTriangle size={18} />} gradient="from-amber-400 to-orange-500"   delay="0.15s" />
      </div>

      {/* ── Table ── */}
      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable
          data={invoices}
          columns={columns}
          keyExtractor={invoice => invoice.id}
          emptyMessage={loading ? "Loading invoices…" : "No AP invoices found."}
        />
      </div>
    </div>
  );
}
