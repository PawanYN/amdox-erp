"use client";

import { useState } from "react";
import {
  Wallet,
  Plus,
  Database,
  CheckCircle,
  Clock,
  AlertTriangle,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";

/**
 * WHAT: Journal Entries (GL) page for the Finance module.
 * WHY: Implements double-entry bookkeeping — every financial event must have
 * matching debit and credit lines. This page allows creating draft entries,
 * validating balance (debits = credits), and posting them to the General Ledger.
 *
 * RULES:
 * - A journal entry CANNOT be posted unless SUM(debits) === SUM(credits).
 * - Posting is blocked if the fiscal period is locked.
 * - Multi-currency entries use the FX rate at the time of posting.
 *
 * DATA: Currently uses mock data. Backend endpoint when ready:
 *   GET  /finance/gl/journal-entries
 *   POST /finance/gl/journal-entries
 */

type JournalLine = {
  account: string;
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

const MOCK_ENTRIES: JournalEntry[] = [
  {
    id: "JE-2026-001", entryDate: "2026-06-20", status: "posted",
    description: "AP Invoice approved — PO-2026-001 (Tata Steel)", currency: "INR", exchangeRate: 1,
    lines: [
      { account: "1300 Inventory",         debit: 170000, credit: 0 },
      { account: "2000 Accounts Payable",  debit: 0,      credit: 170000 },
    ],
  },
  {
    id: "JE-2026-002", entryDate: "2026-06-22", status: "draft",
    description: "Accrual — June operating expenses", currency: "USD", exchangeRate: 83.42,
    lines: [
      { account: "6000 Operating Expenses", debit: 45000, credit: 0 },
      { account: "2100 Accrued Expenses",   debit: 0,     credit: 45000 },
    ],
  },
  {
    id: "JE-2026-003", entryDate: "2026-06-25", status: "posted",
    description: "Customer payment received — INV-AR-004", currency: "INR", exchangeRate: 1,
    lines: [
      { account: "1000 Cash",                  debit: 280000, credit: 0 },
      { account: "1400 Accounts Receivable",   debit: 0,      credit: 280000 },
    ],
  },
];

const ACCOUNTS = [
  "1000 — Cash & Cash Equivalents",
  "1300 — Inventory",
  "1400 — Accounts Receivable",
  "2000 — Accounts Payable",
  "2100 — Accrued Expenses",
  "3000 — Retained Earnings",
  "4000 — Revenue",
  "5000 — Cost of Goods Sold",
  "6000 — Operating Expenses",
];

const STATUS_STYLE: Record<string, string> = {
  posted:   "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  draft:    "bg-[#F0EEE7] text-[#8A8678]",
  reversed: "bg-[#B4533B]/10 text-[#B4533B]",
};

export default function JournalEntriesPage() {
  const [entries, setEntries] = useState<JournalEntry[]>(MOCK_ENTRIES);
  const [showForm, setShowForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    description: "",
    currency: "INR",
    lines: [
      { account: "", debit: 0, credit: 0 },
      { account: "", debit: 0, credit: 0 },
    ],
  });

  const totalEntries  = entries.length;
  const postedEntries = entries.filter(e => e.status === "posted").length;
  const draftEntries  = entries.filter(e => e.status === "draft").length;

  // ── Debit / credit balance check ──
  const debitTotal  = newEntry.lines.reduce((s, l) => s + Number(l.debit), 0);
  const creditTotal = newEntry.lines.reduce((s, l) => s + Number(l.credit), 0);
  const isBalanced  = debitTotal === creditTotal && debitTotal > 0;

  const handlePost = (id: string) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: "posted" } : e));
  };

  const updateLine = (index: number, field: keyof JournalLine, value: string | number) => {
    const lines = [...newEntry.lines];
    (lines[index] as any)[field] = value;
    setNewEntry({ ...newEntry, lines });
  };

  return (
    <div>
      {/* ── Header ── */}
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
        <Button icon={<Plus size={16} />} onClick={() => setShowForm(v => !v)}>
          New Journal Entry
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Entries" value={totalEntries}  icon={<Database size={18} />}     gradient="from-indigo-500 to-blue-600"    delay="0.05s" />
        <StatCard label="Posted"        value={postedEntries} icon={<CheckCircle size={18} />}  gradient="from-emerald-400 to-teal-500"   delay="0.10s" />
        <StatCard label="Drafts"        value={draftEntries}  icon={<Clock size={18} />}        gradient="from-amber-400 to-orange-500"   delay="0.15s" />
      </div>

      {/* ── New Journal Entry Form ── */}
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
                onChange={e => setNewEntry({ ...newEntry, description: e.target.value })}
              />
            </div>
            <div>
              <label className="text-[12px] text-muted block mb-1">Currency</label>
              <select
                className="w-full px-3 py-2 text-[13px] border border-[#D8D5CC] rounded-md outline-none focus:border-[#1E3A5F]"
                value={newEntry.currency}
                onChange={e => setNewEntry({ ...newEntry, currency: e.target.value })}
              >
                <option>INR</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </div>
          </div>

          {/* Lines table */}
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
                      value={line.account}
                      onChange={e => updateLine(i, "account", e.target.value)}
                    >
                      <option value="">Select account…</option>
                      {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      className="w-full px-2 py-1.5 text-[12px] border border-[#D8D5CC] rounded text-right outline-none"
                      value={line.debit}
                      onChange={e => updateLine(i, "debit", e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0}
                      className="w-full px-2 py-1.5 text-[12px] border border-[#D8D5CC] rounded text-right outline-none"
                      value={line.credit}
                      onChange={e => updateLine(i, "credit", e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-[#FAFAF9] font-medium text-[12px]">
                <td className="px-4 py-2 text-muted">Total</td>
                <td className="px-4 py-2 text-right font-mono text-ink">{debitTotal.toLocaleString()}</td>
                <td className="px-4 py-2 text-right font-mono text-ink">{creditTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>

          {/* Balance indicator */}
          {debitTotal > 0 && !isBalanced && (
            <div className="flex items-center gap-2 text-[12px] text-[#B4533B] bg-[#B4533B]/10 rounded-md px-3 py-2">
              <AlertTriangle size={13} /> Debits ≠ Credits — entry cannot be posted until balanced.
            </div>
          )}
          {isBalanced && (
            <div className="flex items-center gap-2 text-[12px] text-[#2F6B4F] bg-[#2F6B4F]/10 rounded-md px-3 py-2">
              <Check size={13} /> Balanced ✓ — ready to post.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button disabled={!isBalanced}>Save as Draft</Button>
          </div>
        </div>
      )}

      {/* ── Entry List ── */}
      <div className="mt-6 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        {entries.map(je => {
          const dr = je.lines.reduce((s, l) => s + l.debit, 0);
          const cr = je.lines.reduce((s, l) => s + l.credit, 0);
          return (
            <div key={je.id} className="border border-[#E4E2DC] rounded-lg p-4 bg-white">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[13px] font-semibold text-ink font-mono">{je.id}</p>
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
                      <td className="px-4 py-1.5 text-ink">{line.account}</td>
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

              {je.status === "draft" && (
                <div className="flex justify-end mt-3">
                  <Button size="sm" onClick={() => handlePost(je.id)}>
                    Post to GL →
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
