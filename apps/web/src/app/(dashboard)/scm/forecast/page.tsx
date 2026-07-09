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
  if (score === null) return <span className="text-[11px] text-[#8A8678]">—</span>;
  const pct = score * 100;
  const color = pct < 10 ? "#2F6B4F" : pct < 12 ? "#D9A85C" : "#B4533B";
  return (
    <span className="text-[11px] font-medium font-mono" style={{ color }}>
      {pct.toFixed(1)}%
    </span>
  );
}

function ModelBadge({ type }: { type: string | null }) {
  if (!type) return <span className="text-[11px] text-[#8A8678]">—</span>;
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#1E3A5F]/10 text-[#1E3A5F]">
      {type}
    </span>
  );
}

function TrainedAtCell({ trainedAt }: { trainedAt: string | null }) {
  if (!trainedAt) return <span className="text-[11px] text-[#8A8678]">Not trained</span>;
  const d = new Date(trainedAt);
  const now = new Date();
  const daysDiff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
  const stale = daysDiff > 7;
  return (
    <span
      className={`text-[11px] flex items-center gap-1 ${stale ? "text-[#D9A85C]" : "text-[#4A4740]"}`}
    >
      {stale ? <Clock size={10} /> : <CheckCircle size={10} className="text-[#2F6B4F]" />}
      {label}
      {stale && <span className="text-[10px] text-[#D9A85C]">(stale)</span>}
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
      <div className="flex items-center justify-center h-48 text-[#8A8678] gap-2">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-[13px]">Loading forecast status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-[#B4533B]/30 bg-[#B4533B]/5 px-4 py-3 text-[12px] text-[#B4533B]">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[#14171F] flex items-center gap-2">
            <TrendingUp size={14} className="text-[#1E3A5F]" />
            AI Demand Forecast — All SKUs
          </p>
          <p className="text-[11px] text-[#8A8678] mt-0.5">
            Prophet / statistical fallback · 90-day horizon · F-06
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[#E4E2DC] text-[#4A4740] hover:bg-[#F0EEE7]"
          >
            <RefreshCw size={10} />
            Refresh
          </button>
          <button
            onClick={trainAllItems}
            disabled={trainAll}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
          >
            {trainAll ? <Loader2 size={10} className="animate-spin" /> : <BarChart2 size={10} />}
            {trainAll ? "Training all…" : "Train all SKUs"}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#E4E2DC] bg-white px-4 py-3">
          <p className="text-[10px] text-[#8A8678] font-medium uppercase tracking-wide">
            Total SKUs
          </p>
          <p className="text-[22px] font-bold text-[#14171F] mt-0.5">{items.length}</p>
        </div>
        <div className="rounded-lg border border-[#E4E2DC] bg-white px-4 py-3">
          <p className="text-[10px] text-[#8A8678] font-medium uppercase tracking-wide">Trained</p>
          <p className="text-[22px] font-bold text-[#2F6B4F] mt-0.5">
            {trained.length}
            <span className="text-[13px] font-normal text-[#8A8678] ml-1">/ {items.length}</span>
          </p>
        </div>
        <div className="rounded-lg border border-[#E4E2DC] bg-white px-4 py-3">
          <p className="text-[10px] text-[#8A8678] font-medium uppercase tracking-wide">Avg MAPE</p>
          <p
            className="text-[22px] font-bold mt-0.5"
            style={{ color: avgMape !== null && avgMape * 100 < 12 ? "#2F6B4F" : "#D9A85C" }}
          >
            {avgMape !== null ? `${(avgMape * 100).toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[#E4E2DC] bg-white px-4 py-3">
          <p className="text-[10px] text-[#8A8678] font-medium uppercase tracking-wide">
            Stale (&gt;7d)
          </p>
          <p className="text-[22px] font-bold text-[#D9A85C] mt-0.5">
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
        <div className="rounded-lg border border-[#E4E2DC] bg-white p-4">
          <p className="text-[11px] font-semibold text-[#8A8678] mb-3 flex items-center gap-1">
            <BarChart2 size={11} className="text-[#1E3A5F]" />
            MAPE by SKU (lower is better · target &lt;12%)
          </p>
          <MapeChart data={mapeData} />
        </div>
      )}

      {/* SKU table */}
      <div className="rounded-lg border border-[#E4E2DC] overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
              <th className="text-left px-3 py-2 text-[#8A8678] font-medium">SKU / Product</th>
              <th className="text-left px-3 py-2 text-[#8A8678] font-medium">Model</th>
              <th className="text-right px-3 py-2 text-[#8A8678] font-medium">MAPE</th>
              <th className="text-right px-3 py-2 text-[#8A8678] font-medium">Predictions</th>
              <th className="text-left px-3 py-2 text-[#8A8678] font-medium">Last trained</th>
              <th className="text-right px-3 py-2 text-[#8A8678] font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-[#F0EEE7] hover:bg-[#FAFAF9]">
                <td className="px-3 py-2">
                  <p className="font-medium text-[#14171F]">{item.name}</p>
                  <p className="text-[10px] text-[#8A8678] font-mono">
                    {item.sku} · {item.category ?? "General"}
                  </p>
                </td>
                <td className="px-3 py-2">
                  <ModelBadge type={item.modelType} />
                </td>
                <td className="px-3 py-2 text-right">
                  <MapeChip score={item.mapeScore} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-[#4A4740]">
                  {item.predictionCount > 0 ? (
                    item.predictionCount
                  ) : (
                    <span className="text-[#8A8678]">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <TrainedAtCell trainedAt={item.trainedAt} />
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => trainOne(item.id)}
                    disabled={training[item.id] || trainAll}
                    className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
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
  );
}
