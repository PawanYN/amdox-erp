"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect, useCallback } from "react";
import { Truck, ArrowRight, Loader2, Warehouse as WarehouseIcon, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { scmApi } from "@/lib/api/scm-api";

const RECEIVABLE_STATUSES = new Set(["APPROVED", "PARTIALLY_RECEIVED"]);

const STATUS_TONE: Record<string, "pending" | "approved" | "processed" | "rejected" | "inactive"> =
  {
    APPROVED: "approved",
    PARTIALLY_RECEIVED: "pending",
    RECEIVED: "processed",
  };

type Warehouse = { id: string; name: string; location?: string };

type GoodsReceipt = {
  id: string;
  purchaseOrderId: string;
  receivedAt: string;
  notes: string;
  purchaseOrder?: {
    poNumber?: string;
    totalAmount?: number | string;
    vendor?: { name?: string };
  };
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  vendor?: { name?: string };
  project?: { name?: string };
  totalAmount: number | string;
  createdAt: string;
  lines?: { id: string; quantity: number; product?: { name?: string } }[];
};

export default function GoodsReceiptPage() {
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceipt[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pos, whs, grs] = await Promise.all([
        scmApi.getPurchaseOrders(),
        scmApi.getWarehouses(),
        scmApi.getGoodsReceipts(),
      ]);
      setPoList(Array.isArray(pos) ? pos : []);
      setReceipts(Array.isArray(grs) ? (grs as GoodsReceipt[]) : []);
      const warehouseList = Array.isArray(whs) ? (whs as Warehouse[]) : [];
      setWarehouses(warehouseList);
      setWarehouseId((prev) => prev || warehouseList[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load goods receipt data");
    } finally {
      setLoading(false);
    }
  }, []);

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  useEffect(() => {
    load();
  }, [load]);

  const receivable = poList.filter((po) => RECEIVABLE_STATUSES.has(po.status));

  const receive = async (id: string) => {
    if (!warehouseId) {
      toast("Select a warehouse before receiving goods.", "error");
      return;
    }
    setReceivingId(id);
    setError(null);
    try {
      await scmApi.receiveGoods(id, {
        warehouseId,
        notes: "Received via Goods Receipt page",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to receive goods");
    } finally {
      setReceivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[13px]">Loading approved purchase orders…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md px-3 py-2 text-[11px]" style={{border: '1px solid #dfe3e8', background: '#f4f6f8', color: '#6b7280'}}>
        After goods arrive → record receipt →{" "}
        <span className="font-mono" style={{color: '#1f5fa8'}}>currentStock</span> increments → FIFO cost layer
        updates → emits <span className="font-mono" style={{color: '#1f5fa8'}}>goods.received</span>
      </div>

      {error && (
        <div className="rounded-lg px-4 py-3 text-[12px]" style={{border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c'}}>
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck size={18} style={{color: '#6b7280'}} />
            Goods Receipt
          </h1>
          <p className="page-subtitle mt-1">
            Receive stock against approved purchase orders into a warehouse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WarehouseIcon size={14} style={{color: '#6b7280'}} className="shrink-0" />
          <label className="text-[12px] text-slate-600 sr-only" htmlFor="gr-warehouse">
            Warehouse
          </label>
          <select
            id="gr-warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehouses.length === 0}
            className="text-[12px] rounded-md px-2.5 py-1.5 bg-white min-w-[180px] focus:outline-none"
            style={{border: '1px solid #dfe3e8', color: '#2b2f36'}}
            onFocus={(e) => e.currentTarget.style.borderColor = '#1f5fa8'}
            onBlur={(e) => e.currentTarget.style.borderColor = '#dfe3e8'}
          >
            {warehouses.length === 0 ? (
              <option value="">No warehouses</option>
            ) : (
              warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.location ? ` · ${w.location}` : ""}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        {receivable.length === 0 ? (
          <div className="rounded-lg shadow-card px-6 py-14 text-center" style={{background: '#ffffff', border: '1px solid #dfe3e8'}}>
            <p className="text-[13px]" style={{color: '#6b7280'}}>
              No approved purchase orders ready to receive.
            </p>
            <p className="text-[11px] mt-1" style={{color: '#9ca3af'}}>
              Approve a PO on the Purchase Orders tab, then return here to record receipt.
            </p>
          </div>
        ) : (
          receivable.map((po) => (
            <div
              key={po.id}
              className="rounded-lg shadow-card p-4 transition-colors"
              style={{background: '#ffffff', border: '1px solid #dfe3e8'}}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#b1b5be'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#dfe3e8'}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold" style={{color: '#2b2f36'}}>
                      {po.poNumber}
                    </span>
                    <Badge tone={STATUS_TONE[po.status] || "inactive"}>
                      {po.status.replace(/_/g, " ")}
                    </Badge>
                    {po.project?.name && (
                      <span className="text-[11px] rounded px-1.5 py-0.5" style={{color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d'}}>
                        {po.project.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1" style={{color: '#6b7280'}}>
                    {po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}
                    {po.lines?.length != null ? ` · ${po.lines.length} line(s)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-semibold" style={{color: '#2b2f36'}}>
                    ₹{Number(po.totalAmount).toLocaleString()}
                  </span>
                  <button
                    onClick={() => receive(po.id)}
                    disabled={receivingId === po.id || !warehouseId}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
                    style={{border: '1px solid #1f5fa8', color: '#1f5fa8'}}
                    onMouseEnter={(e) => !receivingId && (e.currentTarget.style.background = '#eff6ff')}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {receivingId === po.id ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Receiving…
                      </>
                    ) : (
                      <>
                        Receive Goods
                        <ArrowRight size={12} />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Receipt History — shows completed GRs with copy-able IDs */}
      {receipts.length > 0 && (
        <div className="mt-6">
          <h2 className="text-[12px] font-semibold uppercase tracking-wider mb-2" style={{color: '#6b7280'}}>
            Receipt History
          </h2>
          <div className="rounded-lg bg-white overflow-hidden" style={{border: '1px solid #dfe3e8'}}>
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{borderBottom: '1px solid #e5e7eb', background: '#f7f9fb'}}>
                    <th className="text-left px-4 py-2 font-medium" style={{color: '#6b7280'}}>GR ID</th>
                    <th className="text-left px-4 py-2 font-medium" style={{color: '#6b7280'}}>PO Number</th>
                    <th className="text-left px-4 py-2 font-medium" style={{color: '#6b7280'}}>Vendor</th>
                    <th className="text-left px-4 py-2 font-medium" style={{color: '#6b7280'}}>Received At</th>
                    <th className="text-right px-4 py-2 font-medium" style={{color: '#6b7280'}}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((gr) => (
                    <tr
                      key={gr.id}
                      className="last:border-0 transition-colors"
                      style={{borderBottom: '1px solid #e5e7eb'}}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="font-mono text-[11px] rounded px-1.5 py-0.5 max-w-[140px] truncate"
                            title={gr.id}
                            style={{color: '#4b5563', background: '#f3f4f6'}}
                          >
                            {gr.id.slice(0, 8)}…
                          </span>
                          <button
                            onClick={() => copyId(gr.id)}
                            title="Copy full GR ID"
                            className="transition-colors"
                            style={{color: '#9ca3af'}}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#1f5fa8'}
                            onMouseLeave={(e) => e.currentTarget.style.color = '#9ca3af'}
                          >
                            {copiedId === gr.id ? (
                              <Check size={13} style={{color: '#16a34a'}} />
                            ) : (
                              <Copy size={13} />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 font-mono" style={{color: '#2b2f36'}}>
                        {gr.purchaseOrder?.poNumber ?? gr.purchaseOrderId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2.5" style={{color: '#2b2f36'}}>
                        {gr.purchaseOrder?.vendor?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5" style={{color: '#6b7280'}}>
                        {new Date(gr.receivedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono" style={{color: '#2b2f36'}}>
                        {gr.purchaseOrder?.totalAmount != null
                          ? `₹${Number(gr.purchaseOrder.totalAmount).toLocaleString()}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
