"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { scmApi } from "@/lib/api/scm-api";

function StockBadge({ current, reorder }: { current: number; reorder: number }) {
  const pct = (current / (reorder || 1)) * 100;
  if (pct <= 20) return <span className="flex items-center gap-1 text-[11px] text-[#B4533B] font-medium"><AlertTriangle size={11} /> Critical</span>;
  if (pct <= 60) return <span className="flex items-center gap-1 text-[11px] text-[#D9A85C] font-medium">⚠ Low</span>;
  return <span className="text-[11px] text-[#2F6B4F] font-medium">✓ OK</span>;
}

export default function InventoryPage() {
  const [raised, setRaised] = useState<Record<string, boolean>>({});
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    scmApi.getProducts().then(setItems);
  }, []);

  const getStock = (item: any) => item.stockLevels?.reduce((sum: number, level: any) => sum + Number(level.quantity), 0) || 0;

  const mappedItems = items.map(item => ({
    ...item,
    currentStock: getStock(item),
    reorderPoint: 10,
    unit: "pcs",
  }));

  const belowReorder = mappedItems.filter((i) => i.currentStock < i.reorderPoint);

  return (
    <div className="space-y-5">
      {belowReorder.length > 0 && (
        <div className="rounded-lg border border-[#B4533B]/30 bg-[#B4533B]/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-[#B4533B] flex items-center gap-1.5">
              <AlertTriangle size={14} /> {belowReorder.length} items below reorder point
            </p>
            <p className="text-[11px] text-[#8A8678]">emits: <span className="font-mono text-[#1E3A5F]">inventory.low_stock</span> → auto-draft PR</p>
          </div>
          <div className="space-y-2">
            {belowReorder.map((item) => (
              <div key={item.sku} className="flex items-center justify-between bg-white rounded-md border border-[#E4E2DC] px-3 py-2">
                <div>
                  <p className="text-[13px] font-medium text-[#14171F]">{item.name}</p>
                  <p className="text-[11px] text-[#8A8678]">{item.sku}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-[12px] font-mono text-[#B4533B] font-medium">{item.currentStock} {item.unit}</p>
                    <p className="text-[10px] text-[#8A8678]">reorder at {item.reorderPoint}</p>
                  </div>
                  <div className="w-20 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
                    <div className="h-full bg-[#B4533B] rounded-full" style={{ width: `${Math.min(100, (item.currentStock / item.reorderPoint) * 100)}%` }} />
                  </div>
                  {raised[item.sku] ? (
                    <span className="text-[11px] text-[#2F6B4F] font-medium flex items-center gap-1"><Check size={12} /> PR raised</span>
                  ) : (
                    <button onClick={() => setRaised({ ...raised, [item.sku]: true })}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white whitespace-nowrap">
                      Raise PR
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <p className="text-[12px] text-[#8A8678] font-medium mb-2">All Inventory Items</p>
        <div className="border border-[#E4E2DC] rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
                <th className="text-left px-3 py-2 text-[#8A8678] font-medium">SKU / Item</th>
                <th className="text-right px-3 py-2 text-[#8A8678] font-medium">Stock</th>
                <th className="text-right px-3 py-2 text-[#8A8678] font-medium">Reorder at</th>
                <th className="text-right px-3 py-2 text-[#8A8678] font-medium">Unit cost</th>
                <th className="text-center px-3 py-2 text-[#8A8678] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {mappedItems.map((item, i) => (
                <tr key={item.sku} className={`border-b border-[#F0EEE7] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"}`}>
                  <td className="px-3 py-2">
                    <p className="font-medium text-[#14171F]">{item.name}</p>
                    <p className="text-[10px] text-[#8A8678] font-mono">{item.sku} · {item.category}</p>
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium text-[#14171F]">{item.currentStock} {item.unit}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#8A8678]">{item.reorderPoint}</td>
                  <td className="px-3 py-2 text-right font-mono text-[#4A4740]">₹{item.unitCost}</td>
                  <td className="px-3 py-2 text-center"><StockBadge current={item.currentStock} reorder={item.reorderPoint} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}