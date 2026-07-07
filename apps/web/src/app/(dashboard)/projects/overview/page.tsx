"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, X, Loader2, FolderKanban, AlertTriangle, CheckCircle } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { scmApi } from "@/lib/api/scm-api";

type ProductOption = { id: string; name: string; sku: string; unitCost: number };

function MaterialRequestDialog({
  projectId,
  projectName,
  onClose,
  onSuccess,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    scmApi
      .getProducts()
      .then((rows) => {
        setProducts(rows);
        if (rows[0]) setProductId(rows[0].id);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!productId || !quantity) return;
    setSubmitting(true);
    setError(null);
    try {
      const product = products.find((p) => p.id === productId);
      await pmApi.requestMaterial(projectId, {
        reason: reason || `Materials for ${projectName}`,
        lines: [
          {
            productId,
            quantity: Number(quantity),
            estimatedUnitPrice: product ? Number(product.unitCost) : undefined,
          },
        ],
      });
      onSuccess();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px] px-4">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-modal animate-fade-in-up">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Request Materials</h2>
            <p className="text-[12px] text-slate-500 mt-0.5">
              For: <span className="font-medium text-slate-600">{projectName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12px] text-slate-500 bg-slate-50 rounded-md px-3 py-2 border border-slate-100">
            Emits <code className="font-mono text-blue-600">project.material_requested</code> → SCM
            creates a purchase requisition.
          </p>

          {loading ? (
            <p className="text-[13px] text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading products…
            </p>
          ) : products.length === 0 ? (
            <p className="text-[13px] text-red-500">
              No products in catalog. Add products under SCM first.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  Product
                </label>
                <select
                  className="input-base"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  className="input-base"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-500 uppercase mb-1">
                  Reason (optional)
                </label>
                <input
                  className="input-base"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Phase 1 construction supplies"
                />
              </div>
            </div>
          )}
          {error && <p className="text-[12px] text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || loading || products.length === 0}
            className="px-3 py-1.5 text-[13px] font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit to SCM"}
          </button>
        </div>
      </div>
    </div>
  );
}

type ProjectSummary = {
  id: string;
  name: string;
  status: string;
  taskCount: number;
  milestoneCount: number;
  overdueMilestoneCount: number;
  budgetPlanned: number;
  budgetActual: number;
  budgetOverrun: boolean;
  budgetPct: number;
};

export default function ProjectsOverviewPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialProject, setMaterialProject] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    pmApi
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return <p className="text-[13px] text-slate-500 py-8 text-center">Loading projects…</p>;
  if (error) return <p className="text-[13px] text-red-500 py-8 text-center">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FolderKanban size={18} className="text-slate-500" />
            Project Overview
          </h1>
          <p className="page-subtitle mt-1">
            {projects.length} project{projects.length !== 1 ? "s" : ""} — budget tracking and
            milestone status
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 text-[12px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2.5 animate-fade-in-up">
          <CheckCircle size={14} /> {toast}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
          <p className="text-[13px] text-slate-500">
            No projects yet. Create one from Projects → Tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg border border-slate-200 shadow-card p-4 hover:border-slate-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-[14px] font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[12px] text-slate-500">{p.taskCount} tasks</span>
                    <span className="text-[12px] text-slate-500">·</span>
                    <span className="text-[12px] text-slate-500">
                      {p.milestoneCount} milestones
                    </span>
                    {p.overdueMilestoneCount > 0 && (
                      <>
                        <span className="text-[12px] text-slate-500">·</span>
                        <span className="text-[12px] text-red-500 font-medium flex items-center gap-1">
                          <AlertTriangle size={11} /> {p.overdueMilestoneCount} overdue
                        </span>
                      </>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : p.status === "CANCELLED"
                            ? "bg-slate-100 text-slate-500 border border-slate-200"
                            : "bg-blue-50 text-blue-700 border border-blue-100"
                      }`}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {p.status !== "COMPLETED" && p.status !== "CANCELLED" && (
                    <button
                      onClick={() => setMaterialProject({ id: p.id, name: p.name })}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-md border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors"
                    >
                      <Package size={12} /> Request materials
                    </button>
                  )}
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      p.budgetOverrun
                        ? "bg-red-50 text-red-600 border border-red-200"
                        : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    }`}
                  >
                    {p.budgetOverrun ? "Over budget" : "On track"}
                  </span>
                </div>
              </div>

              {/* Budget progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                  <span>
                    Budget:{" "}
                    <span className="font-mono text-slate-600">
                      ₹{p.budgetPlanned.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Spent:{" "}
                    <span
                      className={`font-mono font-semibold ${p.budgetOverrun ? "text-red-600" : "text-slate-600"}`}
                    >
                      ₹{p.budgetActual.toLocaleString()}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${p.budgetOverrun ? "bg-red-500" : "bg-blue-500"}`}
                    style={{ width: `${Math.min(p.budgetPct, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 text-right mt-1">
                  {p.budgetPct}% utilized
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {materialProject && (
        <MaterialRequestDialog
          projectId={materialProject.id}
          projectName={materialProject.name}
          onClose={() => setMaterialProject(null)}
          onSuccess={() => {
            setToast(
              `Material request sent for ${materialProject.name}. Check SCM → Purchase Orders.`,
            );
            setTimeout(() => setToast(null), 5000);
          }}
        />
      )}
    </div>
  );
}
