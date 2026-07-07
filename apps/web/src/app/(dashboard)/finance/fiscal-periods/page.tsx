"use client";

import { useEffect, useState } from "react";
import { Calendar, Lock, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { financeApi } from "@/lib/api/finance-api";

type FiscalPeriod = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isLocked: boolean;
};

export default function FiscalPeriodsPage() {
  const [periods, setPeriods] = useState<FiscalPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () =>
    financeApi
      .getFiscalPeriods()
      .then(setPeriods)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function handleOpenPeriod() {
    if (!name.trim() || !startDate || !endDate) return;
    setSaving(true);
    try {
      await financeApi.openFiscalPeriod({ name: name.trim(), startDate, endDate });
      setFormOpen(false);
      setName("");
      setStartDate("");
      setEndDate("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to open period.");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose(id: string, periodName: string) {
    if (!confirm(`Close fiscal period "${periodName}"? No new entries can be posted.`)) return;
    try {
      await financeApi.closeFiscalPeriod(id);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to close period.");
    }
  }

  const columns: ColumnDef<FiscalPeriod>[] = [
    {
      header: "Period",
      cell: (p) => <span className="font-semibold text-slate-900">{p.name}</span>,
    },
    {
      header: "Start",
      cell: (p) => (
        <span className="text-sm text-slate-500">{new Date(p.startDate).toLocaleDateString()}</span>
      ),
    },
    {
      header: "End",
      cell: (p) => (
        <span className="text-sm text-slate-500">{new Date(p.endDate).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
            p.isLocked ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          {p.isLocked ? "Locked" : "Open"}
        </span>
      ),
    },
    {
      header: "Action",
      cell: (p) =>
        !p.isLocked ? (
          <button
            onClick={() => handleClose(p.id, p.name)}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-2.5 py-1 rounded-md border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
          >
            <Lock size={12} /> Close
          </button>
        ) : (
          <span className="text-slate-300 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar size={18} className="text-slate-500" />
            Fiscal Periods
          </h1>
          <p className="page-subtitle mt-1">Open and close accounting periods</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          Open Period
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </p>
      ) : (
        <DataTable
          data={periods}
          columns={columns}
          keyExtractor={(p) => p.id}
          emptyMessage="No fiscal periods yet."
        />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Open Fiscal Period">
        <div className="space-y-3">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
              Name * (e.g. 2026-07)
            </label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                Start date *
              </label>
              <input
                type="date"
                className={inputClasses}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block mb-1.5">
                End date *
              </label>
              <input
                type="date"
                className={inputClasses}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenPeriod} disabled={saving}>
              {saving ? "Opening…" : "Open Period"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
