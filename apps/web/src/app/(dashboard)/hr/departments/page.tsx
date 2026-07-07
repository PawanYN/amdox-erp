"use client";

import { useEffect, useState } from "react";
import { Plus, Building2, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { hrApi } from "@/lib/api/hr-api";

type Department = {
  id: string;
  name: string;
  code: string;
  headId?: string | null;
};

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const load = () => hrApi.getDepartments().then(setDepartments).catch(console.error);

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setFormOpen(true);
  }

  function openEdit(dept: Department) {
    setEditing(dept);
    setName(dept.name);
    setCode(dept.code);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim() || !code.trim()) return;
    setLoading(true);
    try {
      if (editing) {
        await hrApi.updateDepartment(editing.id, { name: name.trim(), code: code.trim() });
      } else {
        await hrApi.createDepartment({ name: name.trim(), code: code.trim() });
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
          <p className="page-subtitle mt-1">Manage organizational departments</p>
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
              placeholder="e.g. Engineering"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Code *</label>
            <input
              className={inputClasses}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ENG-001"
            />
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
