"use client";

import { useState, useEffect } from "react";
import { Plus, ShoppingCart, ClipboardList, ArrowRight, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { scmApi } from "@/lib/api/scm-api";

const STATUS_TONE: Record<string, "pending" | "approved" | "processed" | "rejected" | "inactive"> = {
  DRAFT:         "inactive",
  SUBMITTED:     "pending",
  APPROVED:      "approved",
  RECEIVED:      "processed",
  CANCELLED:     "rejected",
  PENDING_MATCH: "pending",
  MATCHED:       "approved",
  PAID:          "processed",
};

export default function POPage() {
  const [poList, setPoList]             = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [vendors, setVendors]           = useState<any[]>([]);
  const [creatingPo, setCreatingPo]     = useState<string | null>(null);
  const [warehouseId, setWarehouseId]   = useState<string | null>(null);

  const fetchAll = () => {
    scmApi.getPurchaseOrders().then(setPoList);
    scmApi.getRequisitions().then(setRequisitions);
  };

  useEffect(() => {
    fetchAll();
    scmApi.getVendors().then(setVendors);
    scmApi.getWarehouses().then((w) => setWarehouseId(w[0]?.id ?? null));
  }, []);

  const advance = async (id: string, status: string) => {
    if (status === "DRAFT" || status === "SUBMITTED") {
      await scmApi.approvePurchaseOrder(id);
    } else if (status === "APPROVED") {
      if (!warehouseId) { alert("No warehouse configured. Seed the database first."); return; }
      await scmApi.receiveGoods(id, { warehouseId, notes: "Received via web UI" });
    }
    fetchAll();
  };

  const createPoFromRequisition = async (req: any) => {
    const vendorId = req.lines?.[0]?.product?.defaultVendorId || vendors.find((v) => v.isActive)?.id;
    if (!vendorId) { alert("No vendor available. Add a vendor or set default vendor on the product."); return; }
    setCreatingPo(req.id);
    try {
      await scmApi.createPurchaseOrder({
        vendorId, requisitionId: req.id,
        projectId: req.projectId ?? undefined,
        lines: req.lines.map((l: any) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.estimatedUnitPrice ?? l.product?.unitCost ?? 0),
        })),
      });
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create PO");
    } finally { setCreatingPo(null); }
  };

  const actionLabel: Record<string, string> = {
    DRAFT: "Submit for Approval",
    SUBMITTED: "Approve PO",
    APPROVED: "Mark Received",
  };

  const pendingRequisitions = requisitions.filter((r) => !r.purchaseOrders || r.purchaseOrders.length === 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart size={18} className="text-slate-400" />
            Purchase Orders
          </h1>
          <p className="page-subtitle mt-1">
            Workflow: Draft → Submitted → Approved → Received
          </p>
        </div>
        <button className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3.5 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors">
          <Plus size={14} /> New PO
        </button>
      </div>

      {/* Open Requisitions */}
      {pendingRequisitions.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={15} className="text-amber-600" />
            <p className="text-[13px] font-semibold text-amber-800">
              Open Requisitions ({pendingRequisitions.length})
            </p>
          </div>
          <div className="space-y-2">
            {pendingRequisitions.map((req) => (
              <div key={req.id} className="bg-white rounded-md border border-amber-100 p-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-slate-900">
                    {req.project?.name ?? req.reason ?? "Inventory requisition"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {req.lines?.length ?? 0} line(s){req.reason ? ` · ${req.reason}` : ""}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {req.lines?.map((line: any) => (
                      <li key={line.id} className="text-[11px] text-slate-600">
                        <ChevronRight size={10} className="inline text-slate-400 mr-0.5" />
                        {line.product?.name ?? line.productId} × {Number(line.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => createPoFromRequisition(req)}
                  disabled={creatingPo === req.id}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  {creatingPo === req.id ? "Creating…" : "Create PO"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Orders list */}
      <div className="space-y-2">
        {poList.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
            <p className="text-[13px] text-slate-400">No purchase orders yet.</p>
          </div>
        ) : (
          poList.map((po) => (
            <div key={po.id} className="bg-white rounded-lg border border-slate-200 shadow-card p-4 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] font-semibold text-slate-900">{po.poNumber}</span>
                    <Badge tone={STATUS_TONE[po.status] || "inactive"}>{po.status.replace("_", " ")}</Badge>
                    {po.project?.name && (
                      <span className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                        {po.project.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-semibold text-slate-900">₹{Number(po.totalAmount).toLocaleString()}</span>
                  {actionLabel[po.status] && (
                    <button
                      onClick={() => advance(po.id, po.status)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
                    >
                      {actionLabel[po.status]}
                      <ArrowRight size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
