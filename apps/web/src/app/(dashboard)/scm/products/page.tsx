"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { Package, Plus, Boxes, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { scmApi } from "@/lib/api/scm-api";

type Vendor = { id: string; name: string };

type BackendProduct = {
  id: string;
  sku: string;
  name: string;
  unitCost?: number | string;
  defaultVendorId?: string;
  defaultVendor?: Vendor;
  isActive: boolean;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<BackendProduct[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BackendProduct | null>(null);
  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [defaultVendorId, setDefaultVendorId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([scmApi.getProducts(), scmApi.getVendors()])
      .then(([p, v]) => {
        setProducts(p);
        setVendors(v);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setSku("");
    setName("");
    setUnitCost("");
    setDefaultVendorId("");
    setFormOpen(true);
  }

  function openEdit(product: BackendProduct) {
    setEditing(product);
    setSku(product.sku);
    setName(product.name);
    setUnitCost(product.unitCost != null ? String(product.unitCost) : "");
    setDefaultVendorId(product.defaultVendorId || "");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!sku.trim() || !name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        sku: sku.trim(),
        name: name.trim(),
        unitCost: unitCost ? Number(unitCost) : undefined,
        defaultVendorId: defaultVendorId || undefined,
      };
      if (editing) {
        await scmApi.updateProduct(editing.id, payload);
      } else {
        await scmApi.createProduct(payload);
      }
      await load();
      setFormOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save product.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: BackendProduct) {
    if (!confirm(`Delete product "${product.name}"?`)) return;
    try {
      await scmApi.deleteProduct(product.id);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete product.", "error");
    }
  }

  const columns: ColumnDef<BackendProduct>[] = [
    {
      header: "Product",
      cell: (p) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Package size={14} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-900">{p.name}</p>
            <p className="text-[11px] text-slate-500 font-mono">{p.sku}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Default Vendor",
      cell: (p) => (
        <span className="text-[13px] text-slate-500">{p.defaultVendor?.name || "—"}</span>
      ),
    },
    {
      header: "Unit Cost",
      cell: (p) => (
        <span className="font-mono text-[13px] text-slate-700">
          ₹{Number(p.unitCost || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <Badge tone={p.isActive ? "active" : "inactive"}>
          {p.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      cell: (p) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(p)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDelete(p)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Package size={18} className="text-slate-500" />
            Product Catalog
          </h1>
          <p className="page-subtitle mt-1">Manage SKUs, pricing and default vendors</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={openCreate}>
          New Product
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2">
        <StatCard
          label="Total Products"
          value={products.length}
          icon={<Boxes size={16} />}
          gradient="from-blue-500 to-blue-600"
          delay="0s"
        />
        <StatCard
          label="Active"
          value={products.filter((p) => p.isActive).length}
          icon={<Package size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
      </div>

      <DataTable
        data={products}
        columns={columns}
        keyExtractor={(p) => p.id}
        emptyMessage={loading ? "Loading products…" : "No products found."}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Product" : "New Product"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">SKU *</label>
            <input
              className={inputClasses}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="e.g. SKU-1001"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Name *</label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Steel Bracket"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Unit Cost</label>
            <input
              className={inputClasses}
              type="number"
              step="0.01"
              value={unitCost}
              onChange={(e) => setUnitCost(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Default Vendor
            </label>
            <select
              className={inputClasses}
              value={defaultVendorId}
              onChange={(e) => setDefaultVendorId(e.target.value)}
            >
              <option value="">None</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
