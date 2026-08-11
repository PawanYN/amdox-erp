"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  TrendingUp,
  BarChart2,
  Loader2,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from "lucide-react";
import { forecastApi } from "@/lib/api/forecast-api";
import type { MapeChartTheme } from "@/components/bi/mape-chart";

// recharts (+ its d3/redux-toolkit internals) is ~370KB parsed — deferred
// out of this page's initial bundle the same way bi/widget-chart.tsx
// already defers echarts-for-react.
const MapeChart = dynamic(() => import("@/components/bi/mape-chart"), { ssr: false });

const MAPE_CHART_THEME: MapeChartTheme = {
  height: 100,
  gridStroke: "#F0EEE7",
  tickFontSize: 9,
  tickFill: "#8A8678",
  tooltipFontSize: 11,
  tooltipBorder: "#E4E2DC",
  tooltipRadius: 6,
  cursorFill: "#1E3A5F10",
  barFill: "#1E3A5F",
  barRadius: [2, 2, 0, 0],
  barMaxSize: 24,
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
  const color = pct < 10 ? "#059669" : pct < 12 ? "#d97706" : "#b91c1c";
  return (
    <span className="text-[11px] font-medium font-mono" style={{ color }}>
      {pct.toFixed(1)}%
    </span>
  );
}

function ModelBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-[11px]" style={{color: '#6b7280'}}>—</span>;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{background: '#eff6ff', color: '#1f5fa8'}}>
      {type}
    </span>
  );
}

function TrainedAtCell({ trainedAt }: { trainedAt: string | null }) {
  if (!trainedAt) return <span className="text-[11px]" style={{color: '#6b7280'}}>Not trained</span>;
  const d = new Date(trainedAt);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  const stale = daysDiff > 7;
  return (
    <span
      className="text-[11px] flex items-center gap-1"
      style={{color: stale ? "#d97706" : "#4b5563"}}
    >
      {stale ? <Clock size={10} /> : <CheckCircle size={10} style={{color: '#059669'}} />}
      {label}
      {stale && <span className="text-[10px]" style={{color: '#d97706'}}>(stale)</span>}
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
    for (const item of items) {
      await trainOne(item.id);
    }
    setTrainAll(false);
  };

  const trained = items.filter((i) => i.trainedAt !== null);
  const avgMape =
    trained.length > 0 && trained.some((i) => i.mapeScore !== null)
      ? trained.filter((i) => i.mapeScore !== null).reduce((s, i) => s + i.mapeScore!, 0) /
        trained.filter((i) => i.mapeScore !== null).length
      : null;

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
      {error && (
        <div className="rounded-lg px-4 py-3 text-[12px]" style={{border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c'}}>
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold flex items-center gap-2" style={{color: '#2b2f36'}}>
            <TrendingUp size={14} style={{color: '#1f5fa8'}} />
            AI Demand Forecast — All SKUs
          </p>
          <p className="text-[11px] mt-0.5" style={{color: '#6b7280'}}>
            Prophet / statistical fallback · 90-day horizon · F-06
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition-colors"
            style={{border: '1px solid #dfe3e8', color: '#4b5563'}}
            onMouseEnter={(e) => e.currentTarget.style.background = '#f4f6f8'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <RefreshCw size={10} />
            Refresh
          </button>
          <button
            onClick={trainAllItems}
            disabled={trainAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md text-white disabled:opacity-50"
            style={{background: '#1f5fa8'}}
            onMouseEnter={(e) => !trainAll && (e.currentTarget.style.background = '#1a4a80')}
            onMouseLeave={(e) => e.currentTarget.style.background = '#1f5fa8'}
          >
            {trainAll ? <Loader2 size={10} className="animate-spin" /> : <BarChart2 size={10} />}
            {trainAll ? "Training all…" : "Train all SKUs"}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg bg-white px-4 py-3" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{color: '#6b7280'}}>
            Total SKUs
          </p>
          <p className="text-[22px] font-bold mt-0.5" style={{color: '#2b2f36'}}>{items.length}</p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{color: '#6b7280'}}>Trained</p>
          <p className="text-[22px] font-bold mt-0.5" style={{color: '#059669'}}>
            {trained.length}
            <span className="text-[13px] font-normal ml-1" style={{color: '#6b7280'}}>/ {items.length}</span>
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{color: '#6b7280'}}>Avg MAPE</p>
          <p
            className="text-[22px] font-bold mt-0.5"
            style={{ color: avgMape !== null && avgMape * 100 < 12 ? "#059669" : "#d97706" }}
          >
            {avgMape !== null ? `${(avgMape * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-white px-4 py-3" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[10px] font-medium uppercase tracking-wide" style={{color: '#6b7280'}}>
            Stale (&gt;7d)
          </p>
          <p className="text-[22px] font-bold mt-0.5" style={{color: '#d97706'}}>
            {
              trained.filter((i) => {
                if (!i.trainedAt) return false;
                return Date.now() - new Date(i.trainedAt).getTime() > 7 * 24 * 60 * 60 * 1000;
              }).length
            }
          </p>
        </div>
      </div>

      {/* MAPE bar chart */}
      {mapeData.length > 0 && (
        <div className="rounded-lg bg-white p-4" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[11px] font-semibold mb-3 flex items-center gap-1" style={{color: '#6b7280'}}>
            <BarChart2 size={11} style={{color: '#1f5fa8'}} />
            MAPE by SKU (lower is better · target &lt;12%)
          </p>
          <MapeChart data={mapeData} theme={MAPE_CHART_THEME} />
        </div>
      )}

      {/* SKU table */}
      <div className="rounded-lg overflow-hidden" style={{border: '1px solid #dfe3e8'}}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{background: '#f7f9fb', borderBottom: '1px solid #dfe3e8'}}>
                <th className="text-left px-3 py-2 font-medium" style={{color: '#6b7280'}}>SKU / Product</th>
                <th className="text-left px-3 py-2 font-medium" style={{color: '#6b7280'}}>Model</th>
                <th className="text-right px-3 py-2 font-medium" style={{color: '#6b7280'}}>MAPE</th>
                <th className="text-right px-3 py-2 font-medium" style={{color: '#6b7280'}}>Predictions</th>
                <th className="text-left px-3 py-2 font-medium" style={{color: '#6b7280'}}>Last trained</th>
                <th className="text-right px-3 py-2 font-medium" style={{color: '#6b7280'}}>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="transition-colors" style={{borderBottom: '1px solid #e5e7eb'}} onMouseEnter={(e) => e.currentTarget.style.background = '#fafbfc'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td className="px-3 py-2">
                    <p className="font-medium" style={{color: '#2b2f36'}}>{item.name}</p>
                    <p className="text-[10px] font-mono" style={{color: '#6b7280'}}>
                      {item.sku} · {item.category ?? "General"}
                    </p>
                  </td>
                  <td className="px-3 py-2">
                    <ModelBadge type={item.modelType} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <MapeChip score={item.mapeScore} />
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{color: '#4b5563'}}>
                    {item.predictionCount > 0 ? (
                      item.predictionCount
                    ) : (
                      <span style={{color: '#6b7280'}}>—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <TrainedAtCell trainedAt={item.trainedAt} />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => trainOne(item.id)}
                      disabled={training[item.id] || trainAll}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md text-white disabled:opacity-50"
                      style={{background: '#1f5fa8'}}
                      onMouseEnter={(e) => !training[item.id] && !trainAll && (e.currentTarget.style.background = '#1a4a80')}
                      onMouseLeave={(e) => e.currentTarget.style.background = '#1f5fa8'}
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
                  <td colSpan={6} className="px-3 py-8 text-center text-[#8A8678] text-[12px]">
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
