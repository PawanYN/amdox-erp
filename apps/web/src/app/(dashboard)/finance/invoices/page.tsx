"use client";

import { useState, useEffect } from "react";
import {
  TrendingDown,
  Plus,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  Check,
  Upload,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { financeApi } from "@/lib/api/finance-api";

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

const STATUS_TONE: Record<string, "approved" | "pending" | "rejected" | "processed" | "inactive"> =
  {
    PAID: "processed",
    APPROVED: "approved",
    PENDING_MATCH: "pending",
    OVERDUE: "rejected",
  };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setInvoices(await financeApi.getInvoices());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await financeApi.approveInvoice(id);
      fetchInvoices();
    } catch (err) {
      console.error("Approval failed", err);
    }
  };

  const openUpload = () => {
    setFile(null);
    setGoodsReceiptId("");
    setUploadError(null);
    setUploadOpen(true);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      await financeApi.uploadInvoice(file, goodsReceiptId.trim() || undefined);
      await fetchInvoices();
      setUploadOpen(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const totalAmount = invoices.reduce((a, i) => a + Number(i.totalAmount), 0);
  const pendingCount = invoices.filter((i) => i.status === "PENDING_MATCH").length;
  const approvedAmount = invoices
    .filter((i) => ["APPROVED", "PAID"].includes(i.status))
    .reduce((a, i) => a + Number(i.totalAmount), 0);

  const columns: ColumnDef<BackendInvoice>[] = [
    {
      header: "Invoice #",
      cell: (inv) => (
        <span className="font-mono text-[12px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
          {inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor",
      cell: (inv) => <span className="text-[13px] text-slate-700">{inv.vendorId || "—"}</span>,
    },
    {
      header: "Issued",
      cell: (inv) => (
        <span className="text-[13px] text-slate-500">
          {new Date(inv.issueDate).toLocaleDateString("en-IN")}
        </span>
      ),
    },
    {
      header: "Due Date",
      cell: (inv) => {
        const overdue = new Date(inv.dueDate) < new Date() && inv.status !== "PAID";
        return (
          <span
            className={`text-[13px] ${overdue ? "text-red-600 font-medium" : "text-slate-500"}`}
          >
            {new Date(inv.dueDate).toLocaleDateString("en-IN")}
          </span>
        );
      },
    },
    {
      header: "Amount",
      cell: (inv) => (
        <span className="font-mono font-semibold text-slate-900">
          ₹{Number(inv.totalAmount).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (inv) => (
        <Badge tone={STATUS_TONE[inv.status] || "inactive"}>{inv.status.replace("_", " ")}</Badge>
      ),
    },
    {
      header: "Action",
      cell: (inv) =>
        inv.status === "PENDING_MATCH" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleApprove(inv.id)}
            icon={<Check size={13} />}
          >
            Approve
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingDown size={18} className="text-slate-500" />
            AP Invoices
          </h1>
          <p className="page-subtitle mt-1">
            Vendor invoices auto-generated via SCM 3-way match. Approve manually if match fails.
          </p>
        </div>
        <Button icon={<Upload size={14} />} onClick={openUpload}>
          Upload Invoice
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total AP"
          value={`₹${totalAmount.toLocaleString()}`}
          icon={<Receipt size={16} />}
          gradient="from-violet-500 to-violet-600"
          delay="0s"
        />
        <StatCard
          label="Approved / Paid"
          value={`₹${approvedAmount.toLocaleString()}`}
          icon={<CheckCircle2 size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
        <StatCard
          label="Pending Approval"
          value={pendingCount}
          icon={<AlertTriangle size={16} />}
          gradient="from-amber-400 to-amber-500"
          delay="0.1s"
        />
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        keyExtractor={(inv) => inv.id}
        emptyMessage={loading ? "Loading invoices…" : "No AP invoices found."}
      />

      <Modal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Upload Invoice for OCR"
        description="Extracts vendor, amount and line items automatically, then attempts a 3-way match."
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Invoice Document *
            </label>
            <label className="flex items-center gap-2 border border-dashed border-slate-300 rounded-md px-3 py-4 text-[13px] text-slate-500 cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
              <FileText size={16} className="text-slate-500 shrink-0" />
              <span className="truncate">{file ? file.name : "Choose PDF or image…"}</span>
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Goods Receipt ID (optional)
            </label>
            <input
              className={inputClasses}
              value={goodsReceiptId}
              onChange={(e) => setGoodsReceiptId(e.target.value)}
              placeholder="Attempt 3-way match against a specific goods receipt"
            />
          </div>
          {uploadError && <p className="text-[12px] text-red-600">{uploadError}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file}
              icon={<Upload size={13} />}
            >
              {uploading ? "Uploading…" : "Upload"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
