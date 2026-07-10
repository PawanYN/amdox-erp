"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { hrApi } from "@/lib/api/hr-api";
import { MODULE_OPTIONS, defaultModulesForCode, type ErpModule } from "@/lib/erp-modules";

type Department = {
  id: string;
  name: string;
  code: string;
  headId?: string | null;
  allowedModules?: string[];
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [allowedModules, setAllowedModules] = useState<ErpModule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = () => hrApi.getDepartments().then(setDepartments).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setAllowedModules([]);
    setFormOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code);
    setAllowedModules((dept.allowedModules ?? []) as ErpModule[]);
    setFormOpen(true);
  }

  function toggleModule(mod: ErpModule) {
    setAllowedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod],
    );
  }

  function handleCodeChange(next: string) {
    setCode(next);
    if (!editing && allowedModules.length === 0) {
      setAllowedModules(defaultModulesForCode(next));
    }
  }

  async function handleSave() {
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim(),
        allowedModules,
      };
      if (editing) {
        await hrApi.updateDepartment(editing.id, payload);
      } else {
        await hrApi.createDepartment(payload);
      }
      await load();
      setFormOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save department.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(dept: Department) {
    if (!confirm(`Delete department "${dept.name}"?`)) return;
    try {
      await hrApi.deleteDepartment(dept.id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete department.");
    }
  }

  const columns: ColumnDef<Department>[] = [
    {
      header: "Code",
      cell: (d) => <span className="font-mono text-xs text-slate-600">{d.code}</span>,
    },
    { header: "Name", cell: (d) => <span className="font-semibold text-slate-900">{d.name}</span> },
    {
      header: "ERP Modules",
      cell: (d) => (
        <span className="text-[12px] text-slate-500">
          {(d.allowedModules ?? []).length > 0
            ? (d.allowedModules ?? []).join(", ")
            : defaultModulesForCode(d.code).join(", ") || "—"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (d) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(d)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDelete(d)}
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
            <Building2 size={18} className="text-slate-500" />
            Departments
          </h1>
          <p className="page-subtitle mt-1">
            Manage departments and which ERP modules their employees can access
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          New Department
        </Button>
      </div>

      <DataTable
        data={departments}
        columns={columns}
        keyExtractor={(d) => d.id}
        emptyMessage="No departments yet."
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Department" : "New Department"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Name *</label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Project Management"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Code *</label>
            <input
              className={inputClasses}
              value={code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="e.g. PM, HR, FIN, SCM"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Standard codes (PM, HR, FIN, SCM) auto-suggest module access.
            </p>
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-2">
              Allowed ERP modules
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MODULE_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  className="flex items-start gap-2 rounded-md border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={allowedModules.includes(opt.id)}
                    onChange={() => toggleModule(opt.id)}
                  />
                  <span>
                    <span className="text-[13px] font-medium text-slate-800 block">
                      {opt.label}
                    </span>
                    <span className="text-[11px] text-slate-500">{opt.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
