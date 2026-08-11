"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect, useCallback } from "react";
import {
  Wallet,
  Plus,
  Database,
  CheckCircle,
  Clock,
  AlertTriangle,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";

type JournalLine = { accountId: string; accountLabel: string; debit: number; credit: number };
type JournalEntry = {
  id: string;
  entryDate: string;
  status: "posted" | "draft" | "reversed";
  description: string;
  currency: string;
  lines: JournalLine[];
};
type GlAccount = { id: string; code: string; name: string };

type RawJournalLine = {
  accountId: string;
  account?: { name?: string };
  debit: number;
  credit: number;
};

type RawJournalEntry = {
  id: string;
  createdAt?: string;
  status: string;
  description?: string;
  reference?: string;
  lines?: RawJournalLine[];
};

const STATUS_STYLE: Record<string, string> = {
  posted: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  draft: "bg-slate-100 text-slate-500 border border-slate-200",
  reversed: "bg-red-50 text-red-600 border border-red-200",
};

function mapEntry(e: RawJournalEntry): JournalEntry {
  return {
    id: e.id,
    entryDate: e.createdAt?.slice(0, 10) ?? "",
    status: String(e.status).toLowerCase() as JournalEntry["status"],
    description: e.description ?? e.reference ?? "",
    currency: "INR",
    lines: (e.lines ?? []).map((l) => ({
      accountId: l.accountId,
      accountLabel: l.account?.name ?? l.accountId,
      debit: Number(l.debit),
      credit: Number(l.credit),
    })),
  };
}

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    description: "",
    currency: "INR",
    lines: [
      { accountId: "", debit: 0, credit: 0 },
      { accountId: "", debit: 0, credit: 0 },
    ],
  });

  const loadEntries = useCallback(
    () =>
      financeApi
        .getJournalEntries()
        .then((r: RawJournalEntry[]) => setEntries(r.map(mapEntry)))
        .catch(console.error),
    [],
  );

  useEffect(() => {
    Promise.all([
      loadEntries(),
      financeApi.getAccounts().then(setAccounts).catch(console.error),
    ]).finally(() => setLoading(false));
  }, [loadEntries]);

  const debitTotal = newEntry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const creditTotal = newEntry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced =
    debitTotal === creditTotal && debitTotal > 0 && newEntry.lines.every((l) => l.accountId);

  const updateLine = (
    i: number,
    field: "accountId" | "debit" | "credit",
    value: string | number,
  ) => {
    const lines = [...newEntry.lines];
    lines[i] = { ...lines[i], [field]: value };
    setNewEntry({ ...newEntry, lines });
  };

  async function handleSave() {
    if (!isBalanced || !newEntry.description.trim()) return;
    setSaving(true);
    try {
      const period = await financeApi.getCurrentFiscalPeriod();
      await financeApi.createJournalEntry({
        fiscalPeriodId: period.id,
        reference: `JE-${Date.now().toString(36).toUpperCase()}`,
        description: newEntry.description.trim(),
        lines: newEntry.lines.map((l) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
        })),
      });
      await loadEntries();
      setShowForm(false);
      setNewEntry({
        description: "",
        currency: "INR",
        lines: [
          { accountId: "", debit: 0, credit: 0 },
          { accountId: "", debit: 0, credit: 0 },
        ],
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create journal entry.", "error");
    } finally {
      setSaving(false);
    }
  }

  const posted = entries.filter((e) => e.status === "posted").length;
  const drafts = entries.filter((e) => e.status === "draft").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Wallet size={18} style={{color: '#6b7280'}} />
            Journal Entries
          </h1>
          <p className="page-subtitle mt-1">
            Double-entry bookkeeping — debits must equal credits. Locked periods reject new
            postings.
          </p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "New Entry"}
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Entries"
          value={entries.length}
          icon={<Database size={16} />}
          gradient="from-blue-500 to-blue-600"
          delay="0s"
        />
        <StatCard
          label="Posted"
          value={posted}
          icon={<CheckCircle size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
        <StatCard
          label="Drafts"
          value={drafts}
          icon={<Clock size={16} />}
          gradient="from-amber-400 to-amber-500"
          delay="0.1s"
        />
      </div>

      {/* New entry form */}
      {showForm && (
        <div className="bg-white rounded-lg border border-slate-200 shadow-card p-5 space-y-4 animate-fade-in-up">
          <p style={{fontSize: '14px', fontWeight: 600, color: '#2b2f36'}}>Create Journal Entry</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label style={{display: 'block', fontSize: '11px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px'}}>
                Description *
              </label>
              <input
                className="input-base"
                placeholder="e.g. June rent accrual"
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              />
            </div>
            <div>
              <label style={{display: 'block', fontSize: '11px', fontWeight: 500, color: '#6b7280', textTransform: 'uppercase', marginBottom: '4px'}}>
                Currency
              </label>
              <select
                className="input-base cursor-pointer"
                value={newEntry.currency}
                onChange={(e) => setNewEntry({ ...newEntry, currency: e.target.value })}
              >
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>
          </div>

          <div className="rounded-md border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr style={{background: '#f9fafb', borderBottom: '1px solid #dfe3e8'}}>
                    <th style={{textAlign: 'left', padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                      Account
                    </th>
                    <th style={{textAlign: 'right', padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                      Debit (₹)
                    </th>
                    <th style={{textAlign: 'right', padding: '8px 16px', fontSize: '11px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em'}}>
                      Credit (₹)
                    </th>
                  </tr>
                </thead>
                <tbody style={{borderTop: '1px solid #dfe3e8'}}>
                  {newEntry.lines.map((line, i) => (
                    <tr key={i} style={{borderBottom: '1px solid #f3f4f6'}}>
                      <td className="px-3 py-2">
                        <select
                          className="input-base text-[12px] py-1.5"
                          value={line.accountId}
                          onChange={(e) => updateLine(i, "accountId", e.target.value)}
                        >
                          <option value="">Select account…</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.code} — {a.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          className="input-base text-[12px] py-1.5 text-right"
                          value={line.debit}
                          onChange={(e) => updateLine(i, "debit", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min={0}
                          className="input-base text-[12px] py-1.5 text-right"
                          value={line.credit}
                          onChange={(e) => updateLine(i, "credit", e.target.value)}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr style={{background: '#f9fafb', fontWeight: 600, fontSize: '12px'}}>
                    <td style={{padding: '8px 16px', color: '#6b7280'}}>Total</td>
                    <td style={{padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                      {debitTotal.toLocaleString()}
                    </td>
                    <td style={{padding: '8px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                      {creditTotal.toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {debitTotal > 0 && !isBalanced && (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px'}}>
              <AlertTriangle size={13} /> Debits ≠ Credits or missing accounts — cannot post until
              balanced.
            </div>
          )}
          {isBalanced && (
            <div style={{display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#059669', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '6px', padding: '8px 12px'}}>
              <Check size={13} /> Balanced — ready to post.
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              disabled={!isBalanced || !newEntry.description.trim() || saving}
              onClick={handleSave}
              icon={saving ? <Loader2 size={14} className="animate-spin" /> : undefined}
            >
              {saving ? "Posting…" : "Post to GL"}
            </Button>
          </div>
        </div>
      )}

      {/* Entries list */}
      <div className="space-y-3">
        {loading ? (
          <p style={{fontSize: '13px', color: '#6b7280'}}>Loading journal entries…</p>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 shadow-card px-6 py-14 text-center">
            <p style={{fontSize: '13px', color: '#6b7280'}}>
              No journal entries yet. Create the first one above.
            </p>
          </div>
        ) : (
          entries.map((je) => {
            const dr = je.lines.reduce((s, l) => s + l.debit, 0);
            const cr = je.lines.reduce((s, l) => s + l.credit, 0);
            return (
              <div
                key={je.id}
                className="bg-white rounded-lg border border-slate-200 shadow-card p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p style={{fontSize: '13px', fontWeight: 600, color: '#2b2f36', fontFamily: 'monospace'}}>
                      {je.id.slice(0, 8).toUpperCase()}
                    </p>
                    <p style={{fontSize: '11px', color: '#6b7280', marginTop: '4px'}}>
                      {je.entryDate} · {je.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span style={{fontSize: '11px', fontFamily: 'monospace', color: '#6b7280'}}>{je.currency}</span>
                    <span
                      style={{fontSize: '10px', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', textTransform: 'capitalize', display: 'inline-block', ...{
                        posted: {background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0'},
                        draft: {background: '#f3f4f6', color: '#6b7280', border: '1px solid #e5e7eb'},
                        reversed: {background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca'},
                      }[je.status]}}
                    >
                      {je.status}
                    </span>
                  </div>
                </div>
                <div className="rounded-md border border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead>
                        <tr style={{background: '#f9fafb', borderBottom: '1px solid #f3f4f6'}}>
                          <th style={{textAlign: 'left', padding: '6px 16px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase'}}>
                            Account
                          </th>
                          <th style={{textAlign: 'right', padding: '6px 16px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase'}}>
                            Debit
                          </th>
                          <th style={{textAlign: 'right', padding: '6px 16px', fontSize: '10px', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase'}}>
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody style={{borderTop: '1px solid #f3f4f6'}}>
                        {je.lines.map((line, i) => (
                          <tr key={i} style={{borderBottom: '1px solid #f9fafb'}}>
                            <td style={{padding: '6px 16px', color: '#2b2f36'}}>{line.accountLabel}</td>
                            <td style={{padding: '6px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                              {line.debit > 0 ? line.debit.toLocaleString() : "—"}
                            </td>
                            <td style={{padding: '6px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                              {line.credit > 0 ? line.credit.toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                        <tr style={{background: '#f9fafb', fontWeight: 600}}>
                          <td style={{padding: '6px 16px', color: '#6b7280', fontSize: '11px'}}>Total</td>
                          <td style={{padding: '6px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                            {dr.toLocaleString()}
                          </td>
                          <td style={{padding: '6px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
                            {cr.toLocaleString()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
