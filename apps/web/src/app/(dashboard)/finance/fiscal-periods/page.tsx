"use client";
import { useRoles } from "@/lib/use-roles";
import { toast } from "@/components/ui/toast";

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
  const { canWrite } = useRoles();
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
      toast(err instanceof Error ? err.message : "Failed to open period.", "error");
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
      toast(err instanceof Error ? err.message : "Failed to close period.", "error");
    }
  }

  const columns: ColumnDef<FiscalPeriod>[] = [
    {
      header: "Period",
      cell: (p) => <span style={{fontWeight: 600, color: '#2b2f36'}}>{p.name}</span>,
    },
    {
      header: "Start",
      cell: (p) => (
        <span style={{fontSize: '14px', color: '#6b7280'}}>{new Date(p.startDate).toLocaleDateString()}</span>
      ),
    },
    {
      header: "End",
      cell: (p) => (
        <span style={{fontSize: '14px', color: '#6b7280'}}>{new Date(p.endDate).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Status",
      cell: (p) => (
        <span
          style={{fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '12px', display: 'inline-block', background: p.isLocked ? '#fef2f2' : '#ecfdf5', color: p.isLocked ? '#dc2626' : '#059669'}}
        >
          {p.isLocked ? "Locked" : "Open"}
        </span>
      ),
    },
    {
      header: "Action",
      cell: (p) =>
        canWrite && !p.isLocked ? (
          <button
            onClick={() => handleClose(p.id, p.name)}
            style={{display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecaca', color: '#dc2626', background: 'transparent', cursor: 'pointer', transition: 'background-color 0.2s'}}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#fef2f2'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <Lock size={12} /> Close
          </button>
        ) : (
          <span style={{color: '#d1d5db', fontSize: '12px'}}>—</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Calendar size={18} style={{color: '#6b7280'}} />
            Fiscal Periods
          </h1>
          <p className="page-subtitle mt-1">Open and close accounting periods</p>
        </div>
        {canWrite && (
          <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
            Open Period
          </Button>
        )}
      </div>

      {loading ? (
        <p style={{fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} /> Loading…
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
            <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
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
              <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
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
              <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
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
