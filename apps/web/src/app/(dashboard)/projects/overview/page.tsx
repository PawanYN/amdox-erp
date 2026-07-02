"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, X, Loader2 } from "lucide-react";
import { pmApi } from "@/lib/api/pm-api";
import { scmApi } from "@/lib/api/scm-api";

function StatusPill({ overrun }: { overrun: boolean }) {
  const styles = overrun
    ? "bg-[#B4533B]/10 text-[#B4533B]"
    : "bg-[#2F6B4F]/10 text-[#2F6B4F]";
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${styles}`}>
      {overrun ? "Over budget" : "On track"}
    </span>
  );
}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-[#E4E2DC] shadow-lg">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E4E2DC]">
          <h2 className="text-sm font-semibold text-[#14171F]">Request materials</h2>
          <button onClick={onClose} className="text-[#8A8678] hover:text-[#14171F]">
            <X size={16} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-[12px] text-[#8A8678]">
            Sends <span className="font-mono text-[#1E3A5F]">project.material_requested</span> → SCM creates a purchase requisition for{" "}
            <strong>{projectName}</strong>.
          </p>
          {loading ? (
            <p className="text-sm text-muted flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading products…
            </p>
          ) : products.length === 0 ? (
            <p className="text-sm text-[#B4533B]">No products in catalog. Add products under SCM first.</p>
          ) : (
            <>
              <label className="block text-[12px] font-medium text-[#14171F]">
                Product
                <select
                  className="mt-1 w-full text-sm border border-[#D8D5CC] rounded-md px-3 py-2"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[12px] font-medium text-[#14171F]">
                Quantity
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full text-sm border border-[#D8D5CC] rounded-md px-3 py-2"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <label className="block text-[12px] font-medium text-[#14171F]">
                Reason (optional)
                <input
                  className="mt-1 w-full text-sm border border-[#D8D5CC] rounded-md px-3 py-2"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Phase 1 construction supplies"
                />
              </label>
            </>
          )}
          {error && <p className="text-[12px] text-[#B4533B]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#E4E2DC]">
          <button
            onClick={onClose}
            className="text-[12px] px-3 py-1.5 rounded-md border border-[#D8D5CC] text-[#4A4740]"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || loading || products.length === 0}
            className="text-[12px] px-3 py-1.5 rounded-md bg-[#1E3A5F] text-white disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit to SCM"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsOverviewPage() {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialProject, setMaterialProject] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadProjects = () => {
    pmApi
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  if (loading) return <p className="text-sm text-muted">Loading projects…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        No projects yet. Create one from Projects → New Project.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {toast && (
        <div className="text-[12px] px-3 py-2 rounded-md bg-[#2F6B4F]/10 text-[#2F6B4F] border border-[#2F6B4F]/20">
          {toast}
        </div>
      )}
      {projects.map((p) => (
        <div key={p.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
          <div className="flex items-center justify-between">
            <div>
              <Link href={`/projects/${p.id}`} className="hover:underline">
                <p className="text-sm font-medium text-[#14171F]">{p.name}</p>
              </Link>
              <p className="text-[12px] text-[#8A8678] mt-0.5">
                {p.taskCount} tasks · {p.milestoneCount} milestones
                {p.overdueMilestoneCount > 0 && (
                  <span className="text-[#B4533B]">
                    {" "}
                    · {p.overdueMilestoneCount} overdue
                  </span>
                )}
                {" · "}
                {p.status}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {p.status !== "COMPLETED" && p.status !== "CANCELLED" && (
                <button
                  onClick={() => setMaterialProject({ id: p.id, name: p.name })}
                  className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-[#D9A85C] text-[#B06D1A] hover:bg-[#D9A85C]/10"
                >
                  <Package size={12} /> Request materials
                </button>
              )}
              <StatusPill overrun={p.budgetOverrun} />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-[#F0EEE7] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1E3A5F] rounded-full"
                style={{ width: `${Math.min(p.budgetPct, 100)}%` }}
              />
            </div>
            <span className="text-[12px] font-mono text-[#6B675D] w-10 text-right">
              {p.budgetPct}%
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[12px] text-[#8A8678]">
            <span>
              Budget:{" "}
              <span className="font-mono text-[#4A4740]">
                ₹{p.budgetPlanned.toLocaleString()}
              </span>
            </span>
            <span>
              Spent:{" "}
              <span className="font-mono text-[#4A4740]">
                ₹{p.budgetActual.toLocaleString()}
              </span>
            </span>
          </div>
        </div>
      ))}

      {materialProject && (
        <MaterialRequestDialog
          projectId={materialProject.id}
          projectName={materialProject.name}
          onClose={() => setMaterialProject(null)}
          onSuccess={() => {
            setToast(`Material request sent for ${materialProject.name}. Check SCM → Purchase Orders for the requisition.`);
            setTimeout(() => setToast(null), 5000);
          }}
        />
      )}
    </div>
  );
}
