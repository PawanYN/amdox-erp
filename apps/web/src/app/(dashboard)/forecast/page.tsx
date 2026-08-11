"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { TrendingUp, BarChart2, Loader2, CheckCircle, Clock, RefreshCw } from "lucide-react";
import { forecastApi } from "@/lib/api/forecast-api";
import type { MapeChartTheme } from "@/components/bi/mape-chart";

// recharts (+ its d3/redux-toolkit internals) is ~370KB parsed — deferred
// out of this page's initial bundle the same way bi/widget-chart.tsx
// already defers echarts-for-react.
const MapeChart = dynamic(() => import("@/components/bi/mape-chart"), { ssr: false });

const MAPE_CHART_THEME: MapeChartTheme = {
  height: 110,
  gridStroke: "#f1f5f9",
  tickFontSize: 10,
  tickFill: "#94a3b8",
  tooltipFontSize: 12,
  tooltipBorder: "#e2e8f0",
  tooltipRadius: 8,
  cursorFill: "#eff6ff",
  barFill: "#2563eb",
  barRadius: [3, 3, 0, 0],
  barMaxSize: 28,
};

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
  if (score === null) return <span className="text-[11px]" style={{color: '#6b7280'}}>—</span>;
  const pct = score * 100;
  const color = pct < 10 ? '#059669' : pct < 12 ? '#f59e0b' : '#dc2626';
  return <span className={`text-[11px] font-medium font-mono`} style={{color}}>{pct.toFixed(1)}%</span>;
}

function TrainedAtCell({ trainedAt }: { trainedAt: string | null }) {
  if (!trainedAt) return <span className="text-[11px]" style={{color: '#6b7280'}}>Not trained</span>;
  const d = new Date(trainedAt);
  const stale = Date.now() - d.getTime() > 7 * 24 * 60 * 60 * 1000;
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  return (
    <span
      className={`text-[11px] flex items-center gap-1`}
      style={{color: stale ? '#f59e0b' : '#6b7280'}}
    >
      {stale ? <Clock size={10} /> : <CheckCircle size={10} style={{color: '#059669'}} />}
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
      <div className="flex items-center justify-center h-48 gap-2" style={{color: '#6b7280'}}>
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
            <TrendingUp size={18} style={{color: '#1f5fa8'}} />
            AI Demand Forecast
          </h1>
          <p className="page-subtitle">Prophet / statistical fallback · 90-day horizon · F-06</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-md border transition-colors"
            style={{borderColor: '#dfe3e8', color: '#6b7280', background: '#fff'}}
          >
            <RefreshCw size={11} /> Refresh
          </button>
          <button
            onClick={trainAllItems}
            disabled={trainAll}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-50"
            style={{background: '#1f5fa8'}}
          >
            {trainAll ? <Loader2 size={11} className="animate-spin" /> : <BarChart2 size={11} />}
            {trainAll ? "Training all…" : "Train all SKUs"}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-[12px]" style={{background: '#fef2f2', borderColor: '#fca5a5', color: '#dc2626'}}>
          {error}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total SKUs", value: items.length, color: '#2b2f36' },
          {
            label: "Trained",
            value: `${trained.length} / ${items.length}`,
            color: '#059669',
          },
          {
            label: "Avg MAPE",
            value: avgMape !== null ? `${(avgMape * 100).toFixed(1)}%` : "—",
            color: avgMape !== null && avgMape * 100 < 12 ? '#059669' : '#f59e0b',
          },
          {
            label: "Stale (>7d)",
            value: staleCount,
            color: staleCount > 0 ? '#f59e0b' : '#6b7280',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="shadow-card rounded-xl px-4 py-3" style={{background: '#fff', border: '1px solid #dfe3e8'}}>
            <p className="text-[10px] font-medium uppercase tracking-wide" style={{color: '#6b7280'}}>
              {label}
            </p>
            <p className={`text-[22px] font-bold mt-0.5`} style={{color}}>{value}</p>
          </div>
        ))}
      </div>

      {/* MAPE chart */}
      {mapeData.length > 0 && (
        <div className="shadow-card rounded-xl p-4" style={{background: '#fff', border: '1px solid #dfe3e8'}}>
          <p className="text-[11px] font-semibold mb-3 flex items-center gap-1.5" style={{color: '#6b7280'}}>
            <BarChart2 size={12} style={{color: '#1f5fa8'}} />
            MAPE by SKU — lower is better · target &lt;12%
          </p>
          <MapeChart data={mapeData} theme={MAPE_CHART_THEME} />
        </div>
      )}

      {/* SKU table */}
      <div className="shadow-card rounded-xl overflow-hidden" style={{border: '1px solid #dfe3e8'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{background: '#f4f6f8', borderBottom: '1px solid #dfe3e8'}}>
                <th className="text-left px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>SKU / Product</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>Model</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>MAPE</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>Predictions</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>Last trained</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{color: '#6b7280'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b hover:bg-slate-50" style={{borderColor: '#dfe3e8'}}>
                  <td className="px-4 py-2.5">
                    <p className="font-medium" style={{color: '#2b2f36'}}>{item.name}</p>
                    <p className="text-[10px] font-mono" style={{color: '#6b7280'}}>
                      {item.sku} · {item.category ?? "General"}
                    </p>
                  </td>
                  <td className="px-4 py-2.5">
                    {item.modelType ? (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{background: '#cce5ff', color: '#1f5fa8'}}>
                        {item.modelType}
                      </span>
                    ) : (
                      <span className="text-[11px]" style={{color: '#6b7280'}}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <MapeChip score={item.mapeScore} />
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono" style={{color: '#2b2f36'}}>
                    {item.predictionCount > 0 ? (
                      item.predictionCount
                    ) : (
                      <span style={{color: '#6b7280'}}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <TrainedAtCell trainedAt={item.trainedAt} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      onClick={() => trainOne(item.id)}
                      disabled={training[item.id] || trainAll}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md text-white transition-colors disabled:opacity-50"
                      style={{background: '#1f5fa8'}}
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
                  <td colSpan={6} className="px-4 py-10 text-center text-[12px]" style={{color: '#6b7280'}}>
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
