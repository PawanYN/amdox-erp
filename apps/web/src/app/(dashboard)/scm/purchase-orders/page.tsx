"use client";

import { useState, useEffect } from "react";
import { Plus, FolderKanban } from "lucide-react";
import { scmApi } from "@/lib/api/scm-api";

const statusColor: Record<string, string> = {
  DRAFT: "bg-[#F0EEE7] text-[#8A8678]",
  SUBMITTED: "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  APPROVED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  RECEIVED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  CANCELLED: "bg-[#B4533B]/10 text-[#B4533B]",
  PENDING_MATCH: "bg-[#D9A85C]/10 text-[#D9A85C]",
  MATCHED: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  PAID: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${statusColor[status] || "bg-[#F0EEE7] text-[#8A8678]"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

export default function POPage() {
  const [poList, setPoList] = useState<any[]>([]);
  const [requisitions, setRequisitions] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [creatingPo, setCreatingPo] = useState<string | null>(null);

  const fetchAll = () => {
    scmApi.getPurchaseOrders().then(setPoList);
    scmApi.getRequisitions().then(setRequisitions);
  };

  useEffect(() => {
    fetchAll();
    scmApi.getVendors().then(setVendors);
  }, []);

  const advance = async (_poNumber: string, id: string, currentStatus: string) => {
    if (currentStatus === "DRAFT" || currentStatus === "SUBMITTED") {
      await scmApi.approvePurchaseOrder(id);
    } else if (currentStatus === "APPROVED") {
      await scmApi.receiveGoods(id, { warehouseId: "default", notes: "Received via web UI" });
    }
    fetchAll();
  };

  const createPoFromRequisition = async (req: any) => {
    const firstLine = req.lines?.[0];
    const vendorId =
      firstLine?.product?.defaultVendorId || vendors.find((v) => v.isActive)?.id;
    if (!vendorId) {
      alert("No vendor available. Add a vendor or set default vendor on the product.");
      return;
    }

    setCreatingPo(req.id);
    try {
      await scmApi.createPurchaseOrder({
        vendorId,
        requisitionId: req.id,
        projectId: req.projectId ?? undefined,
        lines: req.lines.map((line: any) => ({
          productId: line.productId,
          quantity: Number(line.quantity),
          unitPrice: Number(line.estimatedUnitPrice ?? line.product?.unitCost ?? 0),
        })),
      });
      fetchAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to create PO");
    } finally {
      setCreatingPo(null);
    }
  };

  const actionLabel: Record<string, string> = {
    DRAFT: "Submit for approval",
    SUBMITTED: "Approve PO",
    APPROVED: "Mark received",
  };

  const pendingRequisitions = requisitions.filter(
    (r) => !r.purchaseOrders || r.purchaseOrders.length === 0,
  );

  return (
    <div className="space-y-6">
      {pendingRequisitions.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[13px] font-semibold text-[#14171F] flex items-center gap-1.5">
            <FolderKanban size={14} className="text-[#B06D1A]" />
            Project requisitions ({pendingRequisitions.length})
          </h2>
          {pendingRequisitions.map((req) => (
            <div key={req.id} className="border border-[#D9A85C]/40 rounded-lg p-4 bg-[#FFFBF5]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[#14171F]">
                    {req.project?.name ?? "Unlinked requisition"}
                  </p>
                  <p className="text-[11px] text-[#8A8678] mt-0.5">
                    {req.lines?.length ?? 0} line(s)
                    {req.reason ? ` · ${req.reason}` : ""}
                  </p>
                  <ul className="mt-2 text-[11px] text-[#4A4740] space-y-0.5">
                    {req.lines?.map((line: any) => (
                      <li key={line.id}>
                        {line.product?.name ?? line.productId} × {Number(line.quantity)}
                      </li>
                    ))}
                  </ul>
                </div>
                <button
                  onClick={() => createPoFromRequisition(req)}
                  disabled={creatingPo === req.id}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#B06D1A] text-white whitespace-nowrap disabled:opacity-50"
                >
                  {creatingPo === req.id ? "Creating…" : "Create PO"}
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-[12px] text-[#8A8678]">State machine: draft → submitted → approved → received</p>
          <button className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white">
            <Plus size={13} /> New PO
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-2">
          {vendors.map((v) => (
            <div key={v.id} className="border border-[#E4E2DC] rounded-lg p-3 bg-white">
              <p className="text-[13px] font-medium text-[#14171F]">{v.name}</p>
              <p className="text-[11px] text-[#8A8678] mt-0.5">Rating: {v.rating}★</p>
              <StatusPill status={v.isActive ? "ACTIVE" : "INACTIVE"} />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {poList.map((po) => (
            <div key={po.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[13px] font-medium text-[#14171F] font-mono">{po.poNumber}</p>
                  <p className="text-[11px] text-[#8A8678]">
                    {po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}
                    {po.project?.name && (
                      <span className="ml-2 text-[#B06D1A]">· Project: {po.project.name}</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={po.status} />
                  <p className="text-[13px] font-medium text-[#14171F]">₹{Number(po.totalAmount).toLocaleString()}</p>
                </div>
              </div>
              {actionLabel[po.status] && (
                <div className="flex justify-end mt-3">
                  <button
                    onClick={() => advance(po.poNumber, po.id, po.status)}
                    className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors"
                  >
                    {actionLabel[po.status]} →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
