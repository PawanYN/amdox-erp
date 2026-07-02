"use client";

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

type JournalLine = {
  accountId: string;
  accountLabel: string;
  debit: number;
  credit: number;
};

type JournalEntry = {
  id: string;
  entryDate: string;
  status: "posted" | "draft" | "reversed";
  description: string;
  currency: string;
  exchangeRate: number;
  lines: JournalLine[];
};

type GlAccount = { id: string; code: string; name: string };

const STATUS_STYLE: Record<string, string> = {
  posted: "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  draft: "bg-[#F0EEE7] text-[#8A8678]",
  reversed: "bg-[#B4533B]/10 text-[#B4533B]",
};

function mapEntry(e: any): JournalEntry {
  return {
    id: e.id,
    entryDate: e.createdAt?.slice(0, 10) ?? "",
    status: String(e.status).toLowerCase() as JournalEntry["status"],
    description: e.description ?? e.reference ?? "",
    currency: "INR",
    exchangeRate: 1,
    lines: (e.lines ?? []).map((l: any) => ({
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

  const loadEntries = useCallback(() => {
    return financeApi
      .getJournalEntries()
      .then((rows: any[]) => setEntries(rows.map(mapEntry)))
      .catch(console.error);
  }, []);

  useEffect(() => {
    Promise.all([
      loadEntries(),
      financeApi.getAccounts().then(setAccounts).catch(console.error),
    ]).finally(() => setLoading(false));
  }, [loadEntries]);

  const totalEntries = entries.length;
  const postedEntries = entries.filter((e) => e.status === "posted").length;
  const draftEntries = entries.filter((e) => e.status === "draft").length;

  const debitTotal = newEntry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const creditTotal = newEntry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const allAccountsSelected = newEntry.lines.every((l) => l.accountId);
  const isBalanced =
    debitTotal === creditTotal && debitTotal > 0 && allAccountsSelected;

  const updateLine = (
    index: number,
    field: "accountId" | "debit" | "credit",
    value: string | number,
  ) => {
    const lines = [...newEntry.lines];
    (lines[index] as any)[field] = value;
    setNewEntry({ ...newEntry, lines });
  };

  async function handleSave() {
    if (!isBalanced || !newEntry.description.trim()) return;
    setSaving(true);
    try {
      const period = await financeApi.getCurrentFiscalPeriod();
      const ref = `JE-${Date.now().toString(36).toUpperCase()}`;
      await financeApi.createJournalEntry({
        fiscalPeriodId: period.id,
        reference: ref,
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
    } catch (err: any) {
      alert(err.message || "Failed to create journal entry.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-[0_4px_12px_rgba(79,70,229,0.3)]">
              <Wallet size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Journal Entries (GL)</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Double-entry bookkeeping — SUM(debits) must equal SUM(credits). Locked periods reject new postings.
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowForm((v) => !v)}>
          New Journal Entry
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Entries" value={totalEntries} icon={<Database size={18} />} gradient="from-indigo-500 to-blue-600" delay="0.05s" />
        <StatCard label="Posted" value={postedEntries} icon={<CheckCircle size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Drafts" value={draftEntries} icon={<Clock size={18} />} gradient="from-amber-400 to-orange-500" delay="0.15s" />
      </div>

      {showForm && (
        <div className="mt-6 border border-[#E4E2DC] rounded-lg p-5 bg-white space-y-4 animate-fade-in-up">
          <p className="text-[14px] font-semibold text-ink">Create Journal Entry</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[12px] text-muted block mb-1">Description *</label>
              <input
                className="w-full px-3 py-2 text-[13px] border border-[#D8D5CC] rounded-md outline-none focus:border-[#1E3A5F]"
                placeholder="e.g. June rent accrual"
                value={newEntry.description}
                onChange={(e) => setNewEntry({ ...newEntry, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[12px] text-muted block mb-1">Currency</label>
              <select
                className="w-full px-3 py-2 text-[13px] border border-[#D8D5CC] rounded-md outline-none focus:border-[#1E3A5F]"
                value={newEntry.currency}
                onChange={(e) => setNewEntry({ ...newEntry, currency: e.target.value })}
              >
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>
          </div>

          <table className="w-full text-[12px] border border-[#E4E2DC] rounded-lg overflow-hidden">
            <thead>
              <tr className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
                <th className="text-left px-4 py-2 text-muted font-medium">Account</th>
                <th className="text-right px-4 py-2 text-muted font-medium">Debit (₹)</th>
                <th className="text-right px-4 py-2 text-muted font-medium">Credit (₹)</th>
              </tr>
            </thead>
            <tbody>
              {newEntry.lines.map((line, i) => (
                <tr key={i} className="border-b border-[#F0EEE7]">
                  <td className="px-3 py-2">
                    <select
                      className="w-full px-2 py-1.5 text-[12px] border border-[#D8D5CC] rounded outline-none"
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
                      className="w-full px-2 py-1.5 text-[12px] border border-[#D8D5CC] rounded text-right outline-none"
                      value={line.debit}
                      onChange={(e) => updateLine(i, "debit", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      className="w-full px-2 py-1.5 text-[12px] border border-[#D8D5CC] rounded text-right outline-none"
                      value={line.credit}
                      onChange={(e) => updateLine(i, "credit", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              <tr className="bg-[#FAFAF9] font-medium text-[12px]">
                <td className="px-4 py-2 text-muted">Total</td>
                <td className="px-4 py-2 text-right font-mono text-ink">{debitTotal.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono text-ink">{creditTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {debitTotal > 0 && !isBalanced && (
            <div className="flex items-center gap-2 text-[12px] text-[#B4533B] bg-[#B4533B]/10 rounded-md px-3 py-2">
              <AlertTriangle size={13} /> Debits ≠ Credits or accounts missing — entry cannot be posted until balanced.
            </div>
          )}
          {isBalanced && (
            <div className="flex items-center gap-2 text-[12px] text-[#2F6B4F] bg-[#2F6B4F]/10 rounded-md px-3 py-2">
              <Check size={13} /> Balanced ✓ — ready to post.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button
              disabled={!isBalanced || !newEntry.description.trim() || saving}
              onClick={handleSave}
              icon={saving ? <Loader2 size={16} className="animate-spin" /> : undefined}
            >
              {saving ? "Posting…" : "Post to GL"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        {loading ? (
          <p className="text-sm text-muted">Loading journal entries…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">No journal entries yet.</p>
        ) : (
          entries.map((je) => {
            const dr = je.lines.reduce((s, l) => s + l.debit, 0);
            const cr = je.lines.reduce((s, l) => s + l.credit, 0);
            return (
              <div key={je.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[13px] font-semibold text-ink font-mono">{je.id.slice(0, 8)}…</p>
                    <p className="text-[11px] text-muted">{je.entryDate} · {je.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-muted">
                      {je.currency}{je.exchangeRate !== 1 ? ` @ ${je.exchangeRate}` : ""}
                    </span>
                    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLE[je.status]}`}>
                      {je.status}
                    </span>
                  </div>
                </div>

                <table className="w-full text-[12px] border border-[#F0EEE7] rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-[#FAFAF9] border-b border-[#E4E2DC]">
                      <th className="text-left px-4 py-1.5 text-muted font-medium">Account</th>
                      <th className="text-right px-4 py-1.5 text-muted font-medium">Debit</th>
                      <th className="text-right px-4 py-1.5 text-muted font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {je.lines.map((line, i) => (
                      <tr key={i} className="border-b border-[#F0EEE7] last:border-0">
                        <td className="px-4 py-1.5 text-ink">{line.accountLabel}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-ink">{line.debit > 0 ? line.debit.toLocaleString() : "—"}</td>
                        <td className="px-4 py-1.5 text-right font-mono text-ink">{line.credit > 0 ? line.credit.toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#FAFAF9] font-medium">
                      <td className="px-4 py-1.5 text-muted">Total</td>
                      <td className="px-4 py-1.5 text-right font-mono">{dr.toLocaleString()}</td>
                      <td className="px-4 py-1.5 text-right font-mono">{cr.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
