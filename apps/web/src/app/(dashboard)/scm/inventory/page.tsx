"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Check, TrendingUp, ChevronDown, ChevronRight, Loader2, BarChart2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { scmApi } from "@/lib/api/scm-api";
import { forecastApi } from "@/lib/api/forecast-api";

function StockBadge({ current, reorder }: { current: number; reorder: number }) {
  const pct = (current / (reorder || 1)) * 100;
  if (pct <= 20) return <span className="flex items-center gap-1 text-[11px] text-[#B4533B] font-medium"><AlertTriangle size={11} /> Critical</span>;
  if (pct <= 60) return <span className="flex items-center gap-1 text-[11px] text-[#D9A85C] font-medium">⚠ Low</span>;
  return <span className="text-[11px] text-[#2F6B4F] font-medium">✓ OK</span>;
}

type InventoryItem = {
  id: string;
  sku: string;
  name: string;
  category?: string;
  unitCost: number;
  stockLevels?: { quantity: number }[];
  currentStock: number;
  reorderPoint: number;
  unit: string;
};

type Prediction = { forecastDate: string; predictedQty: number };

const HORIZON_OPTIONS = [14, 30] as const;
type Horizon = (typeof HORIZON_OPTIONS)[number];

function ForecastPanel({ productId, productName }: { productId: string; productName: string }) {
  const [training, setTraining] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [mape, setMape] = useState<number | null>(null);
  const [modelType, setModelType] = useState<string | null>(null);
  const [trainedAt, setTrainedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizon, setHorizon] = useState<Horizon>(30);

  const load = useCallback(async () => {
    try {
      const data = await forecastApi.getPredictions(productId);
      if (data.length > 0) {
        setPredictions(data);
        const fm = data[0]?.forecastModel;
        setMape(fm?.mapeScore ?? null);
        setModelType(fm?.type ?? null);
        setTrainedAt(fm?.trainedAt ?? null);
        setLoaded(true);
      }
    } catch { /* no predictions yet */ }
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const train = async () => {
    setTraining(true);
    setError(null);
    try {
      const result = await forecastApi.train(productId);
      setMape(result.mape ?? null);
      setModelType(result.model?.type ?? null);
      setTrainedAt(result.model?.trainedAt ?? new Date().toISOString());
      setPredictions((result.predictions ?? []).map((p: any) => ({
        forecastDate: p.date,
        predictedQty: p.quantity,
      })));
      setLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Training failed");
    } finally {
      setTraining(false);
    }
  };

  const displayed = predictions.slice(0, horizon);
  const chartData = displayed.map((p) => ({
    date: new Date(p.forecastDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
    qty: p.predictedQty,
  }));

  return (
    <div className="mt-3 border-t border-[#F0EEE7] pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-[11px] font-semibold text-[#8A8678] flex items-center gap-1">
            <TrendingUp size={11} className="text-[#1E3A5F]" />
            AI Demand Forecast — <span className="font-mono text-[#1E3A5F]">{productName}</span>
          </p>
          {mape !== null && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#2F6B4F]/10 text-[#2F6B4F]">
              MAPE {(mape * 100).toFixed(1)}%
            </span>
          )}
          {modelType && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E3A5F]/10 text-[#1E3A5F]">
              {modelType}
            </span>
          )}
          {trainedAt && (
            <span className="text-[10px] text-[#8A8678]">
              trained {new Date(trainedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "2-digit" })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loaded && (
            <div className="flex rounded overflow-hidden border border-[#E4E2DC] text-[10px]">
              {HORIZON_OPTIONS.map((h) => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`px-2 py-0.5 ${horizon === h ? "bg-[#1E3A5F] text-white" : "bg-white text-[#8A8678] hover:bg-[#F0EEE7]"}`}
                >
                  {h}d
                </button>
              ))}
            </div>
          )}
          <button
            onClick={train}
            disabled={training}
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
          >
            {training ? <Loader2 size={10} className="animate-spin" /> : <BarChart2 size={10} />}
            {training ? "Training…" : loaded ? "Re-train" : "Train forecast"}
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-[#B4533B] mb-2">{error}</p>}

      {loaded && chartData.length > 0 ? (
        <div>
          <p className="text-[10px] text-[#8A8678] mb-1.5">
            {horizon}-day demand forecast (units/day)
          </p>
          <ResponsiveContainer width="100%" height={90}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE7" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: "#8A8678" }}
                interval={Math.floor(chartData.length / 5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 9, fill: "#8A8678" }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, border: "1px solid #E4E2DC", borderRadius: 6, padding: "4px 8px" }}
                formatter={(v) => [`${v} units`, "Forecast"]}
                cursor={{ fill: "#1E3A5F10" }}
              />
              <Bar dataKey="qty" fill="#1E3A5F" radius={[2, 2, 0, 0]} maxBarSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : !loaded ? (
        <p className="text-[11px] text-[#8A8678]">
          Click "Train forecast" to run the Prophet ML model on SCM stock movement history.
        </p>
      ) : null}
    </div>
  );
}

function InventoryRow({ item, onRaisePr, raised, raising }: {
  item: InventoryItem;
  onRaisePr: (item: InventoryItem) => void;
  raised: Record<string, string>;
  raising: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr className={`border-b border-[#F0EEE7] hover:bg-[#FAFAF9]`}>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded((v) => !v)} className="text-[#8A8678] hover:text-[#1E3A5F] flex-shrink-0">
              {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            <div>
              <p className="font-medium text-[#14171F]">{item.name}</p>
              <p className="text-[10px] text-[#8A8678] font-mono">{item.sku} · {item.category ?? "General"}</p>
            </div>
          </div>
        </td>
        <td className="px-3 py-2 text-right font-mono font-medium text-[#14171F]">{item.currentStock} {item.unit}</td>
        <td className="px-3 py-2 text-right font-mono text-[#8A8678]">{item.reorderPoint}</td>
        <td className="px-3 py-2 text-right font-mono text-[#4A4740]">₹{item.unitCost}</td>
        <td className="px-3 py-2 text-center"><StockBadge current={item.currentStock} reorder={item.reorderPoint} /></td>
      </tr>
      {expanded && (
        <tr className="border-b border-[#F0EEE7]">
          <td colSpan={5} className="px-4 pb-3">
            <ForecastPanel productId={item.id} productName={item.name} />
          </td>
        </tr>
      )}
    </>
  );
}

export default function InventoryPage() {
  const [raised, setRaised] = useState<Record<string, string>>({});
  const [raising, setRaising] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    const [products, rules] = await Promise.all([
      scmApi.getProducts(),
      scmApi.getReorderRules(),
    ]);

    const ruleByProduct = new Map(
      rules.map((rule: { productId: string; thresholdQty: number }) => [
        rule.productId,
        Number(rule.thresholdQty),
      ]),
    );

    const mapped = products.map((item: InventoryItem) => {
      const currentStock =
        item.stockLevels?.reduce((sum, level) => sum + Number(level.quantity), 0) || 0;
      return {
        ...item,
        currentStock,
        reorderPoint: ruleByProduct.get(item.id) ?? 10,
        unit: "pcs",
      };
    });

    setItems(mapped);
  }, []);

  useEffect(() => {
    loadInventory().catch((e) =>
      setError(e instanceof Error ? e.message : "Failed to load inventory"),
    );
  }, [loadInventory]);

  const belowReorder = items.filter((i) => i.currentStock < i.reorderPoint);

  const handleRaisePr = async (item: InventoryItem) => {
    setRaising(item.id);
    setError(null);
    try {
      const requisition = await scmApi.createRequisitionFromLowStock(item.id);
      setRaised((prev) => ({ ...prev, [item.sku]: requisition.id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to raise PR");
    } finally {
      setRaising(null);
    }
  };

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[#B4533B]/30 bg-[#B4533B]/5 px-4 py-3 text-[12px] text-[#B4533B]">
          {error}
        </div>
      )}

      {belowReorder.length > 0 && (
        <div className="rounded-lg border border-[#B4533B]/30 bg-[#B4533B]/5 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] font-medium text-[#B4533B] flex items-center gap-1.5">
              <AlertTriangle size={14} /> {belowReorder.length} items below reorder point
            </p>
            <p className="text-[11px] text-[#8A8678]">
              emits: <span className="font-mono text-[#1E3A5F]">inventory.low_stock</span> → PR on{" "}
              <span className="font-mono text-[#1E3A5F]">/scm/purchase-orders</span>
            </p>
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
                    <span className="text-[11px] text-[#2F6B4F] font-medium flex items-center gap-1">
                      <Check size={12} /> PR {raised[item.sku].slice(0, 8)}…
                    </span>
                  ) : (
                    <button
                      onClick={() => handleRaisePr(item)}
                      disabled={raising === item.id}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white whitespace-nowrap disabled:opacity-50"
                    >
                      {raising === item.id ? "Raising…" : "Raise PR"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[12px] text-[#8A8678] font-medium">All Inventory Items</p>
          <p className="text-[10px] text-[#8A8678]">
            ▸ Expand a row to train AI demand forecast using SCM stock movement history
          </p>
        </div>
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
              {items.map((item) => (
                <InventoryRow
                  key={item.sku}
                  item={item}
                  onRaisePr={handleRaisePr}
                  raised={raised}
                  raising={raising}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
