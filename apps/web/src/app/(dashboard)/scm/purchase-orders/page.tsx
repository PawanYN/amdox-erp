"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, ClipboardList, ArrowRight, ChevronRight, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Modal, inputClasses } from "@/components/ui/modal";
import { scmApi } from "@/lib/api/scm-api";
import { useRoles } from "@/lib/use-roles";
import { toast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/format";

const STATUS_TONE: Record<string, "pending" | "approved" | "processed" | "rejected" | "inactive"> =
  {
    DRAFT: "inactive",
    SUBMITTED: "pending",
    APPROVED: "approved",
    RECEIVED: "processed",
    CANCELLED: "rejected",
    PENDING_MATCH: "pending",
    MATCHED: "approved",
    PAID: "processed",
  };

type RequisitionLine = {
  id: string;
  productId: string;
  quantity: number;
  estimatedUnitPrice?: number;
  product?: { name?: string; defaultVendorId?: string; unitCost?: number };
};

type Requisition = {
  id: string;
  projectId?: string;
  reason?: string;
  project?: { name?: string };
  purchaseOrders?: unknown[];
  lines?: RequisitionLine[];
};

type Vendor = { id: string; name?: string; isActive: boolean };

type Warehouse = { id: string; name: string; location?: string | null };

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  vendorId: string;
  vendor?: { name?: string };
  project?: { name?: string };
  totalAmount: number | string;
  createdAt: string;
};

export default function POPage() {
  const [poList, setPoList] = useState<PurchaseOrder[]>([]);
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [creatingPo, setCreatingPo] = useState<string | null>(null);
  const { canWrite } = useRoles();

  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState("");
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiving, setReceiving] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<PurchaseOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const fetchAll = () => {
    scmApi.getPurchaseOrders().then(setPoList);
    scmApi.getRequisitions().then(setRequisitions);
  };

  useEffect(() => {
    fetchAll();
    scmApi.getVendors().then(setVendors);
    scmApi.getWarehouses().then((w: Warehouse[]) => {
      setWarehouses(w);
      setReceiveWarehouseId(w[0]?.id ?? "");
    });
  }, []);

  const advance = async (po: PurchaseOrder) => {
    if (po.status === "DRAFT" || po.status === "SUBMITTED") {
      try {
        await scmApi.approvePurchaseOrder(po.id);
        toast(`PO ${po.poNumber} approved — vendor has been notified.`);
        fetchAll();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to approve PO.", "error");
      }
    } else if (po.status === "APPROVED") {
      if (warehouses.length === 0) {
        toast(
          "No warehouse exists yet — create one under Supply Chain → Inventory first.",
          "error",
        );
        return;
      }
      setReceiveNotes("");
      setReceiveTarget(po);
    }
  };

  const handleReceive = async () => {
    if (!receiveTarget || !receiveWarehouseId) return;
    setReceiving(true);
    try {
      await scmApi.receiveGoods(receiveTarget.id, {
        warehouseId: receiveWarehouseId,
        notes: receiveNotes.trim() || undefined,
      });
      const warehouseName =
        warehouses.find((w) => w.id === receiveWarehouseId)?.name ?? "warehouse";
      toast(`Goods received into ${warehouseName} — stock updated, invoice sent to Finance.`);
      setReceiveTarget(null);
      fetchAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to receive goods.", "error");
    } finally {
      setReceiving(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await scmApi.cancelPurchaseOrder(cancelTarget.id, cancelReason.trim() || undefined);
      toast(`PO ${cancelTarget.poNumber} cancelled.`);
      setCancelTarget(null);
      setCancelReason("");
      fetchAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to cancel PO.", "error");
    } finally {
      setCancelling(false);
    }
  };

  const createPoFromRequisition = async (req: Requisition) => {
    const vendorId =
      req.lines?.[0]?.product?.defaultVendorId || vendors.find((v) => v.isActive)?.id;
    if (!vendorId) {
      toast(
        "No vendor available — add one under Supply Chain → Vendors, or set a default vendor on the product.",
        "error",
      );
      return;
    }
    setCreatingPo(req.id);
    try {
      await scmApi.createPurchaseOrder({
        vendorId,
        requisitionId: req.id,
        projectId: req.projectId ?? undefined,
        lines: (req.lines ?? []).map((l) => ({
          productId: l.productId,
          quantity: Number(l.quantity),
          unitPrice: Number(l.estimatedUnitPrice ?? l.product?.unitCost ?? 0),
        })),
      });
      toast("Purchase order created from requisition.");
      fetchAll();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create PO.", "error");
    } finally {
      setCreatingPo(null);
    }
  };

  const actionLabel: Record<string, string> = {
    DRAFT: "Submit for Approval",
    SUBMITTED: "Approve PO",
    APPROVED: "Mark Received",
  };

  const cancellable = (status: string) =>
    status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED";

  const pendingRequisitions = requisitions.filter(
    (r) => !r.purchaseOrders || r.purchaseOrders.length === 0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ShoppingCart size={18} style={{color: '#6b7280'}} />
            Purchase Orders
          </h1>
          <p className="page-subtitle mt-1">Workflow: Draft → Submitted → Approved → Received</p>
        </div>
      </div>

      {/* Open Requisitions */}
      {pendingRequisitions.length > 0 && (
        <div className="rounded-lg p-4 space-y-3" style={{background: '#fef3c7', border: '1px solid #fcd34d'}}>
          <div className="flex items-center gap-2 mb-2">
            <ClipboardList size={15} style={{color: '#92400e'}} />
            <p className="text-[13px] font-semibold" style={{color: '#78350f'}}>
              Open Requisitions ({pendingRequisitions.length})
            </p>
          </div>
          <div className="space-y-2">
            {pendingRequisitions.map((req) => (
              <div
                key={req.id}
                className="rounded-md p-3 flex items-start justify-between gap-3" style={{background: '#ffffff', border: '1px solid #fcd34d'}}
              >
                <div>
                  <p className="text-[13px] font-semibold" style={{color: '#2b2f36'}}>
                    {req.project?.name ?? req.reason ?? "Inventory requisition"}
                  </p>
                  <p className="text-[11px] mt-0.5" style={{color: '#6b7280'}}>
                    {req.lines?.length ?? 0} line(s){req.reason ? ` · ${req.reason}` : ""}
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {req.lines?.map((line) => (
                      <li key={line.id} className="text-[11px]" style={{color: '#4b5563'}}>
                        <ChevronRight size={10} className="inline mr-0.5" style={{color: '#6b7280'}} />
                        {line.product?.name ?? line.productId} × {Number(line.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
                {canWrite && (
                  <button
                    onClick={() => createPoFromRequisition(req)}
                    disabled={creatingPo === req.id}
                    className="text-[12px] font-semibold px-3 py-1.5 rounded-md text-white transition-colors shrink-0 disabled:opacity-50"
                    style={{background: '#b45309'}}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#92400e'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#b45309'}
                  >
                    {creatingPo === req.id ? "Creating…" : "Create PO"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Purchase Orders list */}
      <div className="space-y-2">
        {poList.length === 0 ? (
          <div className="rounded-lg shadow-card px-6 py-14 text-center" style={{background: '#ffffff', border: '1px solid #dfe3e8'}}>
            <p className="text-[13px]" style={{color: '#6b7280'}}>No purchase orders yet.</p>
          </div>
        ) : (
          poList.map((po) => (
            <div
              key={po.id}
              className="rounded-lg shadow-card p-4 transition-colors"
              style={{background: '#ffffff', border: '1px solid #dfe3e8'}}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = '#b1b5be'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = '#dfe3e8'}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-[13px] font-semibold" style={{color: '#2b2f36'}}>
                      {po.poNumber}
                    </span>
                    <Badge tone={STATUS_TONE[po.status] || "inactive"}>
                      {po.status.replace("_", " ")}
                    </Badge>
                    {po.project?.name && (
                      <span className="text-[11px] rounded px-1.5 py-0.5" style={{color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d'}}>
                        {po.project.name}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] mt-1" style={{color: '#6b7280'}}>
                    {po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono font-semibold" style={{color: '#2b2f36'}}>
                    {formatCurrency(po.totalAmount)}
                  </span>
                  {canWrite && actionLabel[po.status] && (
                    <button
                      onClick={() => advance(po)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{border: '1px solid #1f5fa8', color: '#1f5fa8'}}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#eff6ff'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {actionLabel[po.status]}
                      <ArrowRight size={12} />
                    </button>
                  )}
                  {canWrite && cancellable(po.status) && (
                    <button
                      onClick={() => {
                        setCancelReason("");
                        setCancelTarget(po);
                      }}
                      title="Cancel this purchase order"
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors"
                      style={{border: '1px solid #dc2626', color: '#dc2626'}}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Ban size={12} /> Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Modal
        open={receiveTarget !== null}
        onClose={() => setReceiveTarget(null)}
        title={`Receive goods for ${receiveTarget?.poNumber ?? ""}`}
        description="Stock levels, FIFO cost layers, and the Finance invoice are all created from this receipt."
      >
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{color: '#6b7280'}}>
              Which warehouse did the goods arrive at? *
            </label>
            <select
              className={inputClasses}
              value={receiveWarehouseId}
              onChange={(e) => setReceiveWarehouseId(e.target.value)}
            >
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.location ? ` — ${w.location}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{color: '#6b7280'}}>
              Notes (optional)
            </label>
            <input
              className={inputClasses}
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="e.g. delivery challan number, condition of goods"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setReceiveTarget(null)}
              className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{border: '1px solid #dfe3e8', color: '#6b7280'}}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f4f6f8'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Cancel
            </button>
            <button
              onClick={handleReceive}
              disabled={receiving || !receiveWarehouseId}
              className="text-[13px] font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50"
              style={{background: '#1f5fa8'}}
              onMouseEnter={(e) => !receiving && !receiveWarehouseId && (e.currentTarget.style.background = '#1a4a80')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#1f5fa8'}
            >
              {receiving ? "Receiving…" : "Receive goods"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={cancelTarget !== null}
        onClose={() => setCancelTarget(null)}
        title={`Cancel ${cancelTarget?.poNumber ?? ""}`}
        description="The PO stays in the list as CANCELLED. Orders that already received goods cannot be cancelled."
      >
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium block mb-1.5" style={{color: '#6b7280'}}>
              Reason (optional)
            </label>
            <input
              className={inputClasses}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. duplicate order, wrong vendor"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setCancelTarget(null)}
              className="text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors"
              style={{border: '1px solid #dfe3e8', color: '#6b7280'}}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f4f6f8'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              Keep PO
            </button>
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50"
              style={{background: '#dc2626'}}
              onMouseEnter={(e) => !cancelling && (e.currentTarget.style.background = '#b91c1c')}
              onMouseLeave={(e) => e.currentTarget.style.background = '#dc2626'}
            >
              <Ban size={13} /> {cancelling ? "Cancelling…" : "Cancel PO"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
