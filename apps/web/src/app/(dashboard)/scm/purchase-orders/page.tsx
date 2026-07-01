"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
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
  const [vendors, setVendors] = useState<any[]>([]);

  const fetchPOs = () => scmApi.getPurchaseOrders().then(setPoList);
  
  useEffect(() => {
    fetchPOs();
    scmApi.getVendors().then(setVendors);
  }, []);

  const advance = async (poNumber: string, id: string, currentStatus: string) => {
    if (currentStatus === "DRAFT" || currentStatus === "SUBMITTED") {
      await scmApi.approvePurchaseOrder(id);
    } else if (currentStatus === "APPROVED") {
      await scmApi.receiveGoods(id, { warehouseId: "default", notes: "Received via web UI" });
    }
    fetchPOs();
  };

  const actionLabel: Record<string, string> = { DRAFT: "Submit for approval", SUBMITTED: "Approve PO", APPROVED: "Mark received" };

  return (
    <div className="space-y-4">
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
                <p className="text-[11px] text-[#8A8678]">{po.vendor?.name || po.vendorId} · {new Date(po.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={po.status} />
                <p className="text-[13px] font-medium text-[#14171F]">₹{Number(po.totalAmount).toLocaleString()}</p>
              </div>
            </div>
            {actionLabel[po.status] && (
              <div className="flex justify-end mt-3">
                <button onClick={() => advance(po.poNumber, po.id, po.status)}
                  className="text-[12px] font-medium px-3 py-1.5 rounded-md border border-[#1E3A5F] text-[#1E3A5F] hover:bg-[#1E3A5F] hover:text-white transition-colors">
                  {actionLabel[po.status]} →
                </button>
              </div>
            )}
            {po.status === "APPROVED" && (
              <p className="text-[10px] text-[#2F6B4F] mt-1 text-right font-mono">emits: po.created → vendor portal API</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}