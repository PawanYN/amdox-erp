"use client";
import { toast as notify } from "@/components/ui/toast";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Package,
  X,
  Loader2,
  FolderKanban,
  AlertTriangle,
  CheckCircle,
  Pencil,
  Trash2,
  Archive,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { pmApi } from "@/lib/api/pm-api";

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
    pmApi
      .getMaterialProducts()
      .then((rows) => {
        const mapped = rows.map(
          (p: { id: string; name: string; sku: string; unitCost?: number | string }) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            unitCost: Number(p.unitCost ?? 0),
          }),
        );
        setProducts(mapped);
        if (mapped[0]) setProductId(mapped[0].id);
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
      <div className="w-full max-w-md bg-white rounded-lg border shadow-modal animate-fade-in-up" style={{borderColor: '#dfe3e8'}}>
        <div className="flex items-center justify-between px-5 py-4" style={{borderBottom: '1px solid #dfe3e8'}}>
          <div>
            <h2 className="text-[15px] font-semibold" style={{color: '#2b2f36'}}>Request Materials</h2>
            <p className="text-[12px] mt-0.5" style={{color: '#6b7280'}}>
              For: <span className="font-medium" style={{color: '#2b2f36'}}>{projectName}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"
            style={{color: '#6b7280'}}
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-[12px] rounded-md px-3 py-2" style={{color: '#6b7280', backgroundColor: '#f4f6f8', border: '1px solid #dfe3e8'}}>
            Emits <code className="font-mono" style={{color: '#1f5fa8'}}>project.material_requested</code> → SCM
            creates a purchase requisition.
          </p>

          {loading ? (
            <p className="text-[13px] text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading products…
            </p>
          ) : products.length === 0 ? (
            <p className="text-[13px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
              No products in the catalog yet. Ask your SCM team to add products under SCM → Products
              (e.g. Office Table, Laptop Charger), then try again.
            </p>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium uppercase mb-1" style={{color: '#6b7280'}}>
                  Product
                </label>
                <select
                  className="input-base"
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase mb-1" style={{color: '#6b7280'}}>
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  className="input-base"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium uppercase mb-1" style={{color: '#6b7280'}}>
                  Reason (optional)
                </label>
                <input
                  className="input-base"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Phase 1 construction supplies"
                  style={{borderColor: '#dfe3e8', color: '#2b2f36'}}
                />
              </div>
            </div>
          )}
          {error && <p className="text-[12px]" style={{color: '#d9534f'}}>{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4" style={{borderTop: '1px solid #dfe3e8'}}>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[13px] font-medium rounded-md hover:opacity-80 transition-colors"
            style={{background: '#fff', border: '1px solid #dfe3e8', color: '#2b2f36'}}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || loading || products.length === 0}
            className="px-3 py-1.5 text-[13px] font-medium rounded-md disabled:opacity-50 transition-colors"
            style={{background: '#1f5fa8', borderColor: '#1f5fa8', color: '#fff'}}
          >
            {submitting ? "Submitting…" : "Submit to SCM"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Budget variance threshold: alert when actual > budget by 10% */
const BUDGET_VARIANCE_THRESHOLD = 110;

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
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [materialProject, setMaterialProject] = useState<{ id: string; name: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadProjects = () => {
    setLoading(true);
    pmApi
      .getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProjects();
  }, []);

  async function handleClose(project: ProjectSummary) {
    if (!confirm(`Close "${project.name}"? It will be marked COMPLETED but data is kept.`)) return;
    setActionId(project.id);
    try {
      await pmApi.closeProject(project.id);
      setToast(`Project "${project.name}" closed.`);
      loadProjects();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to close project.", "error");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(project: ProjectSummary) {
    if (
      !confirm(
        `Permanently delete "${project.name}"?\n\nThis removes all milestones, tasks, budgets, and resource allocations for this project. This cannot be undone.`,
      )
    )
      return;
    setActionId(project.id);
    try {
      await pmApi.deleteProject(project.id);
      setToast(`Project "${project.name}" deleted.`);
      loadProjects();
    } catch (e) {
      notify(e instanceof Error ? e.message : "Failed to delete project.", "error");
    } finally {
      setActionId(null);
    }
  }

  if (loading)
    return <p className="text-[13px] text-slate-500 py-8 text-center">Loading projects…</p>;
  if (error) return <p className="text-[13px] text-red-500 py-8 text-center">{error}</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{color: '#2b2f36'}}>
            <FolderKanban size={18} style={{color: '#6b7280'}} />
            Project Overview
          </h1>
          <p className="mt-1 text-sm" style={{color: '#6b7280'}}>
            {projects.length} project{projects.length !== 1 ? "s" : ""} — budget tracking and
            milestone status
          </p>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="flex items-center gap-2 text-[12px] rounded-lg px-4 py-2.5 animate-fade-in-up" style={{color: '#1f5fa8', backgroundColor: '#f0f8ff', border: '1px solid #dfe3e8'}}>
          <CheckCircle size={14} /> {toast}
        </div>
      )}

      {projects.length === 0 ? (
        <div className="bg-white rounded-lg px-6 py-14 text-center" style={{border: '1px solid #dfe3e8'}}>
          <p className="text-[13px]" style={{color: '#6b7280'}}>
            No projects yet. Create one from Projects → Tasks.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg p-4 transition-colors"
              style={{border: '1px solid #dfe3e8'}}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-[14px] font-semibold hover:opacity-80 transition-colors"
                    style={{color: '#2b2f36'}}
                  >
                    {p.name}
                  </Link>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-[12px]" style={{color: '#6b7280'}}>{p.taskCount} tasks</span>
                    <span className="text-[12px]" style={{color: '#6b7280'}}>·</span>
                    <span className="text-[12px]" style={{color: '#6b7280'}}>
                      {p.milestoneCount} milestones
                    </span>
                    {p.overdueMilestoneCount > 0 && (
                      <>
                        <span className="text-[12px]" style={{color: '#6b7280'}}>·</span>
                        <span className="text-[12px] font-medium flex items-center gap-1" style={{color: '#d9534f'}}>
                          <AlertTriangle size={11} /> {p.overdueMilestoneCount} overdue
                        </span>
                      </>
                    )}
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                        p.status === "COMPLETED"
                          ? "border"
                          : p.status === "CANCELLED"
                            ? "border"
                            : "border"
                      }`}
                      style={{
                        backgroundColor: p.status === "COMPLETED" ? '#f0f9ff' : p.status === "CANCELLED" ? '#f5f5f5' : '#f0f8ff',
                        color: p.status === "COMPLETED" ? '#0ea5e9' : p.status === "CANCELLED" ? '#6b7280' : '#1f5fa8',
                        borderColor: p.status === "COMPLETED" ? '#dfe3e8' : p.status === "CANCELLED" ? '#dfe3e8' : '#dfe3e8'
                      }}
                    >
                      {p.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <button
                    onClick={() => router.push(`/projects/${p.id}`)}
                    title="Edit project"
                    className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-md hover:opacity-80 transition-colors"
                    style={{background: '#fff', border: '1px solid #dfe3e8', color: '#2b2f36'}}
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  {p.status !== "COMPLETED" && p.status !== "CANCELLED" && (
                    <>
                      <button
                        onClick={() => handleClose(p)}
                        disabled={actionId === p.id}
                        title="Close project"
                        className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-md hover:opacity-80 transition-colors disabled:opacity-50"
                        style={{background: '#fff', border: '1px solid #dfe3e8', color: '#2b2f36'}}
                      >
                        <Archive size={12} /> Close
                      </button>
                      <button
                        onClick={() => setMaterialProject({ id: p.id, name: p.name })}
                        className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1.5 rounded-md hover:opacity-80 transition-colors"
                        style={{background: '#fff', border: '1px solid #dfe3e8', color: '#2b2f36'}}
                      >
                        <Package size={12} /> Materials
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={actionId === p.id}
                    title="Delete project"
                    className="inline-flex items-center gap-1 text-[12px] font-medium px-2.5 py-1.5 rounded-md hover:opacity-80 transition-colors disabled:opacity-50"
                    style={{background: '#fff', border: '1px solid #dfe3e8', color: '#d9534f'}}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border`}
                    style={{
                      backgroundColor: p.budgetPct >= BUDGET_VARIANCE_THRESHOLD ? '#fff5f5' : '#f0f9ff',
                      color: p.budgetPct >= BUDGET_VARIANCE_THRESHOLD ? '#d9534f' : '#0ea5e9',
                      borderColor: '#dfe3e8'
                    }}
                  >
                    {p.budgetPct >= BUDGET_VARIANCE_THRESHOLD ? "Over budget" : "On track"}
                  </span>
                </div>
              </div>

              {/* Budget progress */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1.5" style={{color: '#6b7280'}}>
                  <span>
                    Budget:{" "}
                    <span className="font-mono" style={{color: '#2b2f36'}}>
                      ₹{p.budgetPlanned.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Spent:{" "}
                    <span
                      className={`font-mono font-semibold`}
                      style={{color: p.budgetPct >= BUDGET_VARIANCE_THRESHOLD ? '#d9534f' : '#2b2f36'}}
                    >
                      ₹{p.budgetActual.toLocaleString()}
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{backgroundColor: '#f0f0f0'}}>
                  <div
                    className={`h-full rounded-full transition-all duration-300`}
                    style={{ width: `${Math.min(p.budgetPct, 100)}%`, backgroundColor: p.budgetPct >= BUDGET_VARIANCE_THRESHOLD ? '#d9534f' : '#1f5fa8' }}
                  />
                </div>
                <p className="text-[11px] text-right mt-1" style={{color: '#6b7280'}}>
                  {p.budgetPct}% utilized
                  {p.budgetPct >= BUDGET_VARIANCE_THRESHOLD && (
                    <span style={{color: '#d9534f', marginLeft: '4px', fontWeight: '600'}}>
                      ({p.budgetPct - 100}% over)
                    </span>
                  )}
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
