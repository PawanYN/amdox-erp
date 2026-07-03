"use client";

import { useEffect, useState } from "react";
import { Plus, TrendingUp, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { financeApi } from "@/lib/api/finance-api";

type ArInvoice = {
  id: string;
  invoiceNumber: string;
  customer?: { name: string };
  totalAmount: string | number;
  status: string;
  dueDate: string;
};

type Customer = { id: string; name: string; email?: string };

const STATUS_STYLE: Record<string, string> = {
  DRAFT:     "bg-slate-100 text-slate-600",
  OPEN:      "bg-blue-50 text-blue-700",
  PAID:      "bg-emerald-50 text-emerald-700",
  OVERDUE:   "bg-red-50 text-red-600",
  CANCELLED: "bg-slate-100 text-slate-500",
};

export default function ArInvoicesPage() {
  const [invoices, setInvoices] = useState<ArInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [invoiceFormOpen, setInvoiceFormOpen] = useState(false);
  const [paymentFormOpen, setPaymentFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState("");

  const [paymentInvoiceId, setPaymentInvoiceId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [bankReference, setBankReference] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [inv, cust] = await Promise.all([
        financeApi.getArInvoices(),
        financeApi.getArCustomers(),
      ]);
      setInvoices(inv);
      setCustomers(cust);
      if (cust.length > 0 && !customerId) setCustomerId(cust[0].id);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleCreateInvoice() {
    const total = Number(amount);
    if (!invoiceNumber.trim() || !total || total <= 0) return;
    setSaving(true);
    try {
      let cid = customerId;
      if (!cid && newCustomerName.trim()) {
        const created = await financeApi.createArCustomer({ name: newCustomerName.trim() });
        cid = created.id;
      }
      if (!cid) {
        alert("Select or enter a customer.");
        return;
      }
      await financeApi.createArInvoice({
        type: "AR",
        invoiceNumber: invoiceNumber.trim(),
        customerId: cid,
        issueDate,
        dueDate: dueDate || issueDate,
        totalAmount: total,
        lines: [
          {
            description: description.trim() || "Services rendered",
            quantity: 1,
            unitPrice: total,
            lineTotal: total,
          },
        ],
      });
      setInvoiceFormOpen(false);
      setInvoiceNumber("");
      setDescription("");
      setAmount("");
      setNewCustomerName("");
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to create invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecordPayment() {
    const amt = Number(paymentAmount);
    if (!paymentInvoiceId || !amt || amt <= 0) return;
    setSaving(true);
    try {
      await financeApi.recordArPayment({
        invoiceId: paymentInvoiceId,
        amount: amt,
        bankReference: bankReference.trim() || undefined,
      });
      setPaymentFormOpen(false);
      setPaymentAmount("");
      setBankReference("");
      await load();
    } catch (err: any) {
      alert(err.message || "Failed to record payment.");
    } finally {
      setSaving(false);
    }
  }

  const openInvoices = invoices.filter((i) => i.status !== "PAID");

  const columns: ColumnDef<ArInvoice>[] = [
    { header: "Invoice #", cell: (i) => <span className="font-mono text-xs text-slate-700">{i.invoiceNumber}</span> },
    { header: "Customer", cell: (i) => <span className="font-medium text-slate-900">{i.customer?.name ?? "—"}</span> },
    {
      header: "Amount",
      cell: (i) => <span className="font-mono font-semibold text-slate-900">₹{Number(i.totalAmount).toLocaleString("en-IN")}</span>,
    },
    { header: "Due", cell: (i) => <span className="text-sm text-slate-500">{new Date(i.dueDate).toLocaleDateString()}</span> },
    {
      header: "Status",
      cell: (i) => (
        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[i.status] || "bg-slate-100 text-slate-600"}`}>
          {i.status}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingUp size={18} className="text-slate-400" />
            AR Receivable
          </h1>
          <p className="page-subtitle mt-1">Customer invoices and payment recording</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<CreditCard size={16} />} onClick={() => setPaymentFormOpen(true)}>
            Record Payment
          </Button>
          <Button icon={<Plus size={16} />} onClick={() => setInvoiceFormOpen(true)}>
            New AR Invoice
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </p>
      ) : (
        <DataTable
          data={invoices}
          columns={columns}
          keyExtractor={(i) => i.id}
          emptyMessage="No AR invoices yet."
        />
      )}

      <Modal open={invoiceFormOpen} onClose={() => setInvoiceFormOpen(false)} title="New AR Invoice">
        <div className="space-y-3">
          {customers.length > 0 ? (
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Customer</label>
              <select className={inputClasses} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">New customer name</label>
              <input className={inputClasses} value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Customer name" />
            </div>
          )}
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Invoice number *</label>
            <input className={inputClasses} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Description</label>
            <input className={inputClasses} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Issue date</label>
              <input type="date" className={inputClasses} value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Due date</label>
              <input type="date" className={inputClasses} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Total amount (₹) *</label>
            <input type="number" min={0} className={inputClasses} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setInvoiceFormOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateInvoice} disabled={saving}>
              {saving ? "Creating…" : "Create Invoice"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={paymentFormOpen} onClose={() => setPaymentFormOpen(false)} title="Record Payment">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Invoice *</label>
            <select className={inputClasses} value={paymentInvoiceId} onChange={(e) => setPaymentInvoiceId(e.target.value)}>
              <option value="">Select invoice…</option>
              {openInvoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {i.customer?.name} (₹{Number(i.totalAmount).toLocaleString()})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Amount (₹) *</label>
            <input type="number" min={0} className={inputClasses} value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Bank reference</label>
            <input className={inputClasses} value={bankReference} onChange={(e) => setBankReference(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setPaymentFormOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={saving}>
              {saving ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
