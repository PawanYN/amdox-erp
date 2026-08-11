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
  Ban,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { financeApi } from "@/lib/api/finance-api";
import { scmApi } from "@/lib/api/scm-api";
import { useRoles } from "@/lib/use-roles";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";

type BackendInvoice = {
  id: string;
  invoiceNumber: string;
  vendorId: string;
  purchaseOrderId?: string | null;
  issueDate: string;
  dueDate: string;
  totalAmount: string | number;
  status: string;
  type: string;
};

type Vendor = { id: string; name: string };

type GoodsReceiptOption = {
  id: string;
  receivedAt: string;
  purchaseOrder?: { poNumber?: string; vendor?: { name?: string } } | null;
};

type PurchaseOrderRef = { id: string; poNumber: string };

type LineDraft = { description: string; quantity: string; unitPrice: string };

const STATUS_TONE: Record<string, "approved" | "pending" | "rejected" | "processed" | "inactive"> =
  {
    PAID: "processed",
    APPROVED: "approved",
    PARTIALLY_PAID: "approved",
    PENDING_MATCH: "pending",
    OVERDUE: "rejected",
    CANCELLED: "inactive",
  };

const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "" });

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<BackendInvoice[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptOption[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrderRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { canWrite, isAdmin: isTenantAdmin } = useRoles();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [goodsReceiptId, setGoodsReceiptId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [cancelTarget, setCancelTarget] = useState<BackendInvoice | null>(null);
  const [cancelReason, setCancelReason] = useState("");

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
    scmApi
      .getGoodsReceipts()
      .then(setReceipts)
      .catch(() => {});
    scmApi
      .getPurchaseOrders()
      .then((pos: PurchaseOrderRef[]) => setPurchaseOrders(pos))
      .catch(() => {});
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await financeApi.approveInvoice(id);
      toast("Invoice approved — GL entry posted.");
      fetchInvoices();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Approval failed.", "error");
    }
  };

  const handleCancelInvoice = async () => {
    if (!cancelTarget) return;
    setSaving(true);
    try {
      await financeApi.cancelInvoice(cancelTarget.id, cancelReason.trim() || undefined);
      toast(`Invoice ${cancelTarget.invoiceNumber} cancelled.`);
      setCancelTarget(null);
      setCancelReason("");
      await fetchInvoices();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to cancel invoice.", "error");
    } finally {
      setSaving(false);
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
      toast(err instanceof Error ? err.message : "Failed to create invoice.", "error");
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
      toast(err instanceof Error ? err.message : "Failed to record payment.", "error");
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
      toast(err instanceof Error ? err.message : "Payment run failed.", "error");
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
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "12px",
            fontWeight: 600,
            color: "#1f5fa8",
            background: "#f0f6fd",
            border: "1px solid #dfe3e8",
            borderRadius: "4px",
            padding: "2px 8px",
            display: "inline-block",
          }}
        >
          {inv.invoiceNumber || inv.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Vendor",
      cell: (inv) => (
        <span style={{ fontSize: "13px", color: "#2b2f36" }}>
          {vendorName(inv.vendorId) || "—"}
        </span>
      ),
    },
    {
      header: "PO",
      cell: (inv) => {
        const po = purchaseOrders.find((p) => p.id === inv.purchaseOrderId);
        return po ? (
          <span style={{ fontFamily: "monospace", fontSize: "12px", color: "#2b2f36" }}>
            {po.poNumber}
          </span>
        ) : (
          <span style={{ fontSize: "12px", color: "#9ca3af" }}>—</span>
        );
      },
    },
    {
      header: "Issued",
      cell: (inv) => (
        <span style={{ fontSize: "13px", color: "#6b7280" }}>
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
            style={{
              fontSize: "13px",
              color: overdue ? "#dc2626" : "#6b7280",
              fontWeight: overdue ? 500 : 400,
            }}
          >
            {new Date(inv.dueDate).toLocaleDateString("en-IN")}
          </span>
        );
      },
    },
    {
      header: "Amount",
      cell: (inv) => (
        <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#2b2f36" }}>
          {formatCurrency(inv.totalAmount)}
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
        canWrite && inv.status === "PENDING_MATCH" ? (
          <div className="flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleApprove(inv.id)}
              icon={<Check size={13} />}
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCancelReason("");
                setCancelTarget(inv);
              }}
              icon={<Ban size={13} />}
            >
              Cancel
            </Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingDown size={18} style={{ color: "#6b7280" }} />
            AP Invoices
          </h1>
          <p className="page-subtitle mt-1">
            Vendor invoices — upload, create manually, approve, and pay.
          </p>
        </div>
        {canWrite && (
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
        )}
      </div>

      {error && <p style={{ fontSize: "13px", color: "#dc2626" }}>{error}</p>}

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
        <p
          style={{
            fontSize: "14px",
            color: "#6b7280",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading invoices…
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Invoice Document *
            </label>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "2px dashed #dfe3e8",
                borderRadius: "6px",
                padding: "12px",
                fontSize: "13px",
                color: "#6b7280",
                cursor: "pointer",
                transition: "all 0.3s",
                outline: "none",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#1f5fa8";
                e.currentTarget.style.background = "rgba(31, 95, 168, 0.04)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#dfe3e8";
                e.currentTarget.style.background = "transparent";
              }}
            >
              <FileText size={16} style={{ color: "#6b7280", flexShrink: 0 }} />
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Match against goods receipt (optional)
            </label>
            <select
              className={inputClasses}
              value={goodsReceiptId}
              onChange={(e) => setGoodsReceiptId(e.target.value)}
            >
              <option value="">No match — review manually later</option>
              {receipts.map((gr) => (
                <option key={gr.id} value={gr.id}>
                  {gr.purchaseOrder?.poNumber ?? "PO —"} ·{" "}
                  {gr.purchaseOrder?.vendor?.name ?? "Unknown vendor"} · received{" "}
                  {new Date(gr.receivedAt).toLocaleDateString("en-IN")}
                </option>
              ))}
            </select>
            <p style={{ marginTop: "6px", fontSize: "11px", color: "#6b7280" }}>
              Picking the delivery this bill belongs to lets the system verify and approve it
              automatically (3-way match).
            </p>
          </div>
          {uploadError && <p style={{ fontSize: "12px", color: "#dc2626" }}>{uploadError}</p>}
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Vendor *
            </label>
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
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
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#2b2f36",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
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
              <label
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: "#2b2f36",
                  display: "block",
                  marginBottom: "6px",
                }}
              >
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
            <label
              style={{ fontSize: "12px", fontWeight: 500, color: "#2b2f36", display: "block" }}
            >
              Line items *
            </label>
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
            <p style={{ fontSize: "12px", color: "#6b7280" }}>
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Invoice *
            </label>
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
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
          <div
            style={{
              maxHeight: "192px",
              overflowY: "auto",
              border: "1px solid #dfe3e8",
              borderRadius: "6px",
            }}
          >
            {payableInvoices.length === 0 ? (
              <p style={{ fontSize: "13px", color: "#6b7280", padding: "12px" }}>
                No approved invoices to pay.
              </p>
            ) : (
              payableInvoices.map((i) => (
                <label
                  key={i.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    fontSize: "13px",
                    cursor: "pointer",
                    transition: "background-color 0.2s",
                    borderBottom: "1px solid #f3f4f6",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#f9fafb")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  <input
                    type="checkbox"
                    checked={selectedBatchIds.includes(i.id)}
                    onChange={() => toggleBatchSelection(i.id)}
                  />
                  <span style={{ fontFamily: "monospace", fontSize: "12px" }}>
                    {i.invoiceNumber}
                  </span>
                  <span style={{ color: "#6b7280" }}>{vendorName(i.vendorId)}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "monospace", fontWeight: 500 }}>
                    ₹{Number(i.totalAmount).toLocaleString()}
                  </span>
                </label>
              ))
            )}
          </div>
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
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
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Bank reference
            </label>
            <input
              className={inputClasses}
              value={batchBankRef}
              onChange={(e) => setBatchBankRef(e.target.value)}
            />
          </div>
          {batchResult && <p style={{ fontSize: "12px", color: "#059669" }}>{batchResult}</p>}
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

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={`Cancel invoice ${cancelTarget?.invoiceNumber ?? ""}`}
        description="The invoice stays in the list as CANCELLED. Only bills not yet in the ledger can be cancelled."
      >
        <div className="space-y-3">
          <div>
            <label
              style={{
                fontSize: "12px",
                fontWeight: 500,
                color: "#2b2f36",
                display: "block",
                marginBottom: "6px",
              }}
            >
              Reason (optional)
            </label>
            <input
              className={inputClasses}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. duplicate entry, wrong amount"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setCancelTarget(null)}>
              Keep invoice
            </Button>
            <Button onClick={handleCancelInvoice} disabled={saving} icon={<Ban size={13} />}>
              {saving ? "Cancelling…" : "Cancel invoice"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
