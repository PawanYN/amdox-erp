"use client";

import { useState, useEffect, useCallback } from "react";
import { Truck, ArrowRight, Loader2, Warehouse as WarehouseIcon } from "lucide-react";
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
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pos, whs] = await Promise.all([scmApi.getPurchaseOrders(), scmApi.getWarehouses()]);
      setPoList(Array.isArray(pos) ? pos : []);
      const warehouseList = Array.isArray(whs) ? (whs as Warehouse[]) : [];
      setWarehouses(warehouseList);
      setWarehouseId((prev) => prev || warehouseList[0]?.id || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load goods receipt data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const receivable = poList.filter((po) => RECEIVABLE_STATUSES.has(po.status));

  const receive = async (id: string) => {
    if (!warehouseId) {
      alert("Select a warehouse before receiving goods.");
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
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
        After goods arrive → record receipt →{" "}
        <span className="font-mono text-blue-700">currentStock</span> increments → FIFO cost layer
        updates → emits <span className="font-mono text-blue-700">goods.received</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
          {error}
        </div>
      )}

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Truck size={18} className="text-slate-500" />
            Goods Receipt
          </h1>
          <p className="page-subtitle mt-1">
            Receive stock against approved purchase orders into a warehouse
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WarehouseIcon size={14} className="text-slate-500 shrink-0" />
          <label className="text-[12px] text-slate-600 sr-only" htmlFor="gr-warehouse">
            Warehouse
          </label>
          <select
            id="gr-warehouse"
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            disabled={warehouses.length === 0}
            className="text-[12px] border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-800 min-w-[180px] focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
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
          <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
            <p className="text-[13px] text-slate-500">
              No approved purchase orders ready to receive.
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Approve a PO on the Purchase Orders tab, then return here to record receipt.
            </p>
          </div>
        ) : (
          receivable.map((po) => (
            <div
              key={po.id}
              className="bg-white rounded-lg border border-slate-200 shadow-card p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold text-slate-900">
                      {po.poNumber}
                    </span>
                    <Badge tone={STATUS_TONE[po.status] || "inactive"}>
                      {po.status.replace(/_/g, " ")}
                    </Badge>
                    {po.project?.name && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                        {po.project.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}
                    {po.lines?.length != null ? ` · ${po.lines.length} line(s)` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-semibold text-slate-900">
                    ₹{Number(po.totalAmount).toLocaleString()}
                  </span>
                  <button
                    onClick={() => receive(po.id)}
                    disabled={receivingId === po.id || !warehouseId}
                    className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50 transition-colors"
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
    </div>
  );
}
