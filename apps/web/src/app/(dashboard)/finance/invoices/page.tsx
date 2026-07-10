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
  CreditCard,
  Play,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { financeApi } from "@/lib/api/finance-api";
import { scmApi } from "@/lib/api/scm-api";
import { apiClient } from "@/lib/api/client";

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

type Vendor = { id: string; name: string };

type LineDraft = { description: string; quantity: string; unitPrice: string };

const STATUS_TONE: Record<string, "approved" | "pending" | "rejected" | "processed" | "inactive"> =
  {
    PAID: "processed",
    APPROVED: "approved",
    PARTIALLY_PAID: "approved",
    PENDING_MATCH: "pending",
    OVERDUE: "rejected",
  };

const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "" });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTenantAdmin, setIsTenantAdmin] = useState(false);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [vendorId, setVendorId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [bankReference, setBankReference] = useState("");

  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchDescription, setBatchDescription] = useState("");
  const [batchBankRef, setBatchBankRef] = useState("");
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      setInvoices(await financeApi.getInvoices());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
    scmApi
      .getVendors()
      .then(setVendors)
      .catch(() => {});
    apiClient("/auth/me")
      .then((me: { roles: string[] }) => {
        setIsTenantAdmin(me.roles.includes("TenantAdmin") || me.roles.includes("SuperAdmin"));
      })
      .catch(() => setIsTenantAdmin(false));
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

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  function computeTotal() {
    return lines.reduce((sum, l) => {
      const qty = Number(l.quantity);
      const price = Number(l.unitPrice);
      return sum + (qty > 0 && price > 0 ? qty * price : 0);
    }, 0);
  }

  async function handleCreateInvoice() {
    const total = computeTotal();
    if (!vendorId || !invoiceNumber.trim() || total <= 0) return;

    const parsedLines = lines
      .map((l) => {
        const quantity = Number(l.quantity);
        const unitPrice = Number(l.unitPrice);
        const lineTotal = quantity * unitPrice;
        return {
          description: l.description.trim() || "Line item",
          quantity,
          unitPrice,
          lineTotal,
        };
      })
      .filter((l) => l.quantity > 0 && l.unitPrice > 0);

    if (parsedLines.length === 0) return;

    setSaving(true);
    try {
      await financeApi.createApInvoice({
        type: "AP",
        invoiceNumber: invoiceNumber.trim(),
        vendorId,
        issueDate,
        dueDate: dueDate || issueDate,
        totalAmount: total,
        lines: parsedLines,
      });
      setCreateOpen(false);
      setInvoiceNumber("");
      setLines([emptyLine()]);
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment() {
    const amt = Number(paymentAmount);
    if (!paymentInvoiceId || !amt || amt <= 0) return;
    setSaving(true);
    try {
      await financeApi.recordApPayment({
        invoiceId: paymentInvoiceId,
        amount: amt,
        bankReference: bankReference.trim() || undefined,
      });
      setPaymentOpen(false);
      setPaymentAmount("");
      setBankReference("");
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePaymentRun() {
    if (selectedBatchIds.length === 0) return;
    setSaving(true);
    setBatchResult(null);
    try {
      const result = await financeApi.runApPaymentBatch({
        invoiceIds: selectedBatchIds,
        bankReference: batchBankRef.trim() || undefined,
        description: batchDescription.trim() || undefined,
      });
      const paid = result.paidCount ?? 0;
      const failed = result.failedCount ?? 0;
      setBatchResult(
        `Processed ${result.processed ?? selectedBatchIds.length}: ${paid} paid, ${failed} failed.`,
      );
      setSelectedBatchIds([]);
      await fetchInvoices();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment run failed.");
    } finally {
      setSaving(false);
    }
  }

  function toggleBatchSelection(id: string) {
    setSelectedBatchIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const vendorName = (id: string) => vendors.find((v) => v.id === id)?.name ?? id;

  const payableInvoices = invoices.filter((i) => ["APPROVED", "PARTIALLY_PAID"].includes(i.status));

  const totalAmount = invoices.reduce((a, i) => a + Number(i.totalAmount), 0);
  const pendingCount = invoices.filter((i) => i.status === "PENDING_MATCH").length;
  const approvedAmount = invoices
    .filter((i) => ["APPROVED", "PAID", "PARTIALLY_PAID"].includes(i.status))
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
      cell: (inv) => (
        <span className="text-[13px] text-slate-700">{vendorName(inv.vendorId) || "—"}</span>
      ),
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
            Vendor invoices — upload, create manually, approve, and pay.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            icon={<CreditCard size={14} />}
            onClick={() => setPaymentOpen(true)}
          >
            Record Payment
          </Button>
          {isTenantAdmin && (
            <Button
              variant="outline"
              icon={<Play size={14} />}
              onClick={() => {
                setBatchResult(null);
                setBatchOpen(true);
              }}
            >
              Payment Run
            </Button>
          )}
          <Button variant="outline" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            Create Invoice
          </Button>
          <Button icon={<Upload size={14} />} onClick={openUpload}>
            Upload Invoice
          </Button>
        </div>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

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

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading invoices…
        </p>
      ) : (
        <DataTable
          data={invoices}
          columns={columns}
          keyExtractor={(inv) => inv.id}
          emptyMessage="No AP invoices found."
        />
      )}

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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create AP Invoice">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Vendor *</label>
            <select
              className={inputClasses}
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
            >
              <option value="">Select vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Invoice number *
            </label>
            <input
              className={inputClasses}
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                Issue date
              </label>
              <input
                type="date"
                className={inputClasses}
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                Due date
              </label>
              <input
                type="date"
                className={inputClasses}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[12px] font-medium text-slate-600 block">Line items *</label>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5">
                  <input
                    className={inputClasses}
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => updateLine(idx, "description", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    min={0}
                    className={inputClasses}
                    placeholder="Qty"
                    value={line.quantity}
                    onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min={0}
                    className={inputClasses}
                    placeholder="Unit price"
                    value={line.unitPrice}
                    onChange={(e) => updateLine(idx, "unitPrice", e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <Button variant="outline" size="sm" onClick={() => removeLine(idx)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addLine}>
              Add line
            </Button>
            <p className="text-[12px] text-slate-500">
              Total: ₹{computeTotal().toLocaleString("en-IN")}
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateInvoice} disabled={saving}>
              {saving ? "Creating…" : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentOpen} onClose={() => setPaymentOpen(false)} title="Record AP Payment">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Invoice *</label>
            <select
              className={inputClasses}
              value={paymentInvoiceId}
              onChange={(e) => setPaymentInvoiceId(e.target.value)}
            >
              <option value="">Select approved invoice…</option>
              {payableInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {vendorName(i.vendorId)} (₹
                  {Number(i.totalAmount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Amount (₹) *
            </label>
            <input
              type="number"
              min={0}
              className={inputClasses}
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Bank reference
            </label>
            <input
              className={inputClasses}
              value={bankReference}
              onChange={(e) => setBankReference(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordPayment} disabled={saving}>
              {saving ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="AP Payment Run"
        description="Batch-pay selected approved invoices in full (TenantAdmin only)."
      >
        <div className="space-y-3">
          <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-md divide-y divide-slate-100">
            {payableInvoices.length === 0 ? (
              <p className="text-[13px] text-slate-500 p-3">No approved invoices to pay.</p>
            ) : (
              payableInvoices.map((i) => (
                <label
                  key={i.id}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(i.id)}
                    onChange={() => toggleBatchSelection(i.id)}
                  />
                  <span className="font-mono text-xs">{i.invoiceNumber}</span>
                  <span className="text-slate-500">{vendorName(i.vendorId)}</span>
                  <span className="ml-auto font-mono font-medium">
                    ₹{Number(i.totalAmount).toLocaleString()}
                  </span>
                </label>
              ))
            )}
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Description
            </label>
            <input
              className={inputClasses}
              value={batchDescription}
              onChange={(e) => setBatchDescription(e.target.value)}
              placeholder="Optional payment run memo"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Bank reference
            </label>
            <input
              className={inputClasses}
              value={batchBankRef}
              onChange={(e) => setBatchBankRef(e.target.value)}
            />
          </div>
          {batchResult && <p className="text-[12px] text-emerald-700">{batchResult}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setBatchOpen(false)}>
              Close
            </Button>
            <Button
              onClick={handlePaymentRun}
              disabled={saving || selectedBatchIds.length === 0}
              icon={<Play size={13} />}
            >
              {saving ? "Running…" : `Run (${selectedBatchIds.length})`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
