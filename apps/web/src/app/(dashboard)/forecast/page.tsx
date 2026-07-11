"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, BarChart2, Loader2, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { forecastApi } from "@/lib/api/forecast-api";

// recharts (+ its d3/redux-toolkit internals) is ~370KB parsed — deferred
// out of this page's initial bundle the same way bi/widget-chart.tsx
// already defers echarts-for-react.
const MapeChart = dynamic(() => import("./mape-chart"), { ssr: false });

type ForecastStatus = {
  id: string;
  sku: string;
  name: string;
  category: string | null;
  predictionCount: number;
  mapeScore: number | null;
  trainedAt: string | null;
  modelType: string | null;
};

function MapeChip({ score }: { score: number | null }) {
  if (score === null) return <span className="text-[11px] text-slate-500">—</span>;
  const pct = score * 100;
  const color = pct < 10 ? "text-emerald-600" : pct < 12 ? "text-amber-600" : "text-red-500";
  return <span className={`text-[11px] font-medium font-mono ${color}`}>{pct.toFixed(1)}%</span>;
}

function TrainedAtCell({ trainedAt }: { trainedAt: string | null }) {
  if (!trainedAt) return <span className="text-[11px] text-slate-500">Not trained</span>;
  const d = new Date(trainedAt);
  const stale = Date.now() - d.getTime() > 7 * 24 * 60 * 60 * 1000;
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  return (
    <span
      className={`text-[11px] flex items-center gap-1 ${stale ? "text-amber-600" : "text-slate-600"}`}
    >
      {stale ? <Clock size={10} /> : <CheckCircle size={10} className="text-emerald-500" />}
      {label}
      {stale && <span className="text-[10px]">(stale)</span>}
    </span>
  );
}

export default function ForecastPage() {
  const [items, setItems] = useState<ForecastStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [training, setTraining] = useState<Record<string, boolean>>({});
  const [trainAll, setTrainAll] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await forecastApi.getAllForecastStatus();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load forecast status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trainOne = async (productId: string) => {
    setTraining((prev) => ({ ...prev, [productId]: true }));
    try {
      const result = await forecastApi.train(productId);
      setItems((prev) =>
        prev.map((item) =>
          item.id === productId
            ? {
                ...item,
                mapeScore: result.mape ?? item.mapeScore,
                trainedAt: result.model?.trainedAt ?? new Date().toISOString(),
                modelType: result.model?.type ?? item.modelType,
                predictionCount: (result.predictions ?? []).length,
              }
            : item,
        ),
      );
    } finally {
      setTraining((prev) => ({ ...prev, [productId]: false }));
    }
  };

  const trainAllItems = async () => {
    setTrainAll(true);
    for (const item of items) await trainOne(item.id);
    setTrainAll(false);
  };

  const trained = items.filter((i) => i.trainedAt !== null);
  const avgMape =
    trained.filter((i) => i.mapeScore !== null).length > 0
      ? trained.filter((i) => i.mapeScore !== null).reduce((s, i) => s + i.mapeScore!, 0) /
        trained.filter((i) => i.mapeScore !== null).length
      : null;

  const staleCount = trained.filter(
    (i) => i.trainedAt && Date.now() - new Date(i.trainedAt).getTime() > 7 * 24 * 60 * 60 * 1000,
  ).length;

  const mapeData = items
    .filter((i) => i.mapeScore !== null)
    .map((i) => ({ name: i.sku, mape: +(i.mapeScore! * 100).toFixed(2) }))
    .sort((a, b) => a.mape - b.mape);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500 gap-2">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[13px]">Loading forecast status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-600" />
            AI Demand Forecast
          </h1>
          <p className="page-subtitle">Prophet / statistical fallback · 90-day horizon · F-06</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw size={11} /> Refresh
          </button>
          <button
            onClick={trainAllItems}
            disabled={trainAll}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {trainAll ? <Loader2 size={11} className="animate-spin" /> : <BarChart2 size={11} />}
            {trainAll ? "Training all…" : "Train all SKUs"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-600">
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total SKUs", value: items.length, color: "text-slate-900" },
          {
            label: "Trained",
            value: `${trained.length} / ${items.length}`,
            color: "text-emerald-600",
          },
          {
            label: "Avg MAPE",
            value: avgMape !== null ? `${(avgMape * 100).toFixed(1)}%` : "—",
            color: avgMape !== null && avgMape * 100 < 12 ? "text-emerald-600" : "text-amber-600",
          },
          {
            label: "Stale (>7d)",
            value: staleCount,
            color: staleCount > 0 ? "text-amber-600" : "text-slate-500",
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="shadow-card rounded-xl px-4 py-3">
            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
              {label}
            </p>
            <p className={`text-[22px] font-bold mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* MAPE chart */}
      {mapeData.length > 0 && (
        <div className="shadow-card rounded-xl p-4">
          <p className="text-[11px] font-semibold text-slate-500 mb-3 flex items-center gap-1.5">
            <BarChart2 size={12} className="text-blue-600" />
            MAPE by SKU — lower is better · target &lt;12%
          </p>
          <MapeChart data={mapeData} />
        </div>
      )}

      {/* SKU table */}
      <div className="shadow-card rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">SKU / Product</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Model</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">MAPE</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Predictions</th>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">Last trained</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="text-[10px] text-slate-500 font-mono">
                      {item.sku} · {item.category ?? "General"}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.modelType ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                        {item.modelType}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <MapeChip score={item.mapeScore} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-slate-600">
                    {item.predictionCount > 0 ? (
                      item.predictionCount
                    ) : (
                      <span className="text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <TrainedAtCell trainedAt={item.trainedAt} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => trainOne(item.id)}
                      disabled={training[item.id] || trainAll}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {training[item.id] ? (
                        <Loader2 size={9} className="animate-spin" />
                      ) : (
                        <TrendingUp size={9} />
                      )}
                      {training[item.id] ? "Training…" : item.trainedAt ? "Re-train" : "Train"}
                    </button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500 text-[12px]">
                    No products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
