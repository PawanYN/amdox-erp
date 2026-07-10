"use client";

import { useEffect, useState } from "react";
import { Plus, ShoppingCart, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { financeApi } from "@/lib/api/finance-api";

type SalesOrderLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number | string;
};

type SalesOrder = {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string | number;
  customer?: { name: string };
  lines?: SalesOrderLine[];
  invoices?: { id: string; invoiceNumber: string }[];
};

type Customer = { id: string; name: string };

type LineDraft = { description: string; quantity: string; unitPrice: string };

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "bg-blue-50 text-blue-700",
  INVOICED: "bg-violet-50 text-violet-700",
  FULFILLED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-500",
};

const emptyLine = (): LineDraft => ({ description: "", quantity: "1", unitPrice: "" });

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [invoicingId, setInvoicingId] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orderList, cust] = await Promise.all([
        financeApi.listSalesOrders(),
        financeApi.getArCustomers(),
      ]);
      setOrders(orderList);
      setCustomers(cust);
      if (cust.length > 0 && !customerId) setCustomerId(cust[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sales orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  function updateLine(index: number, field: keyof LineDraft, value: string) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  }

  async function handleCreate() {
    if (!customerId) {
      alert("Select a customer.");
      return;
    }
    const parsed = lines
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity),
        unitPrice: Number(l.unitPrice),
      }))
      .filter((l) => l.description && l.quantity > 0 && l.unitPrice > 0);
    if (parsed.length === 0) {
      alert("Add at least one valid line item.");
      return;
    }

    setSaving(true);
    try {
      await financeApi.createSalesOrder({ customerId, lines: parsed });
      setFormOpen(false);
      setLines([emptyLine()]);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create sales order.");
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateInvoice(id: string) {
    setInvoicingId(id);
    try {
      await financeApi.createInvoiceFromOrder(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to generate invoice.");
    } finally {
      setInvoicingId(null);
    }
  }

  const columns: ColumnDef<SalesOrder>[] = [
    {
      header: "Order #",
      cell: (o) => (
        <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-0.5">
          {o.orderNumber}
        </span>
      ),
    },
    {
      header: "Customer",
      cell: (o) => <span className="font-medium text-slate-900">{o.customer?.name ?? "—"}</span>,
    },
    {
      header: "Amount",
      cell: (o) => (
        <span className="font-mono font-semibold text-slate-900">
          ₹{Number(o.totalAmount).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (o) => (
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLE[o.status] || "bg-slate-100 text-slate-600"}`}
        >
          {o.status}
        </span>
      ),
    },
    {
      header: "Invoices",
      cell: (o) => (
        <span className="text-[13px] text-slate-500">
          {o.invoices?.length ? o.invoices.map((i) => i.invoiceNumber).join(", ") : "—"}
        </span>
      ),
    },
    {
      header: "Action",
      cell: (o) =>
        o.status === "CONFIRMED" ? (
          <Button
            size="sm"
            variant="outline"
            icon={<FileText size={13} />}
            disabled={invoicingId === o.id}
            onClick={() => handleGenerateInvoice(o.id)}
          >
            {invoicingId === o.id ? "Generating…" : "Generate AR Invoice"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart size={18} className="text-slate-500" />
            Sales Orders
          </h1>
          <p className="page-subtitle mt-1">
            Order-to-cash — create orders and generate AR invoices
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          New Sales Order
        </Button>
      </div>

      {error && <p className="text-[13px] text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading sales orders…
        </p>
      ) : (
        <DataTable
          data={orders}
          columns={columns}
          keyExtractor={(o) => o.id}
          emptyMessage="No sales orders yet."
        />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Sales Order">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Customer *
            </label>
            <select
              className={inputClasses}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              {customers.length === 0 && (
                <option value="">No customers — create one in AR first</option>
              )}
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || customers.length === 0}>
              {saving ? "Creating…" : "Create Order"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
