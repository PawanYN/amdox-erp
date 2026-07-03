"use client";

import { useState, useEffect } from "react";

import {
  BookOpen,
  Landmark,
  PieChart,
  Wallet,
  Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal, FormField, inputClasses } from "@/components/ui/modal";


import { StatCard } from "@/components/ui/stat-card";
import { financeApi } from "@/lib/api/finance-api";



/**

 * WHAT: Chart of Accounts page for the Finance module.
 * WHY: Displays all GL account codes grouped by type (Asset, Liability, Equity,
 * Revenue, Expense). These codes are the foundation that every journal entry
 * and invoice references for double-entry bookkeeping.
 *
 * DATA: Currently uses mock data. When the GL accounts API is ready, replace
 * ACCOUNTS with a useEffect call to the backend endpoint GET /finance/gl/accounts.
 */

const TYPE_COLOR: Record<string, string> = {
  asset:     "bg-[#1E3A5F]/10 text-[#1E3A5F]",
  liability: "bg-[#B4533B]/10 text-[#B4533B]",
  equity:    "bg-[#7B61D4]/10 text-[#7B61D4]",
  revenue:   "bg-[#2F6B4F]/10 text-[#2F6B4F]",
  expense:   "bg-[#D9A85C]/10 text-[#D9A85C]",
};

type Account = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subType: string;
  balance: number;
};

const ACCOUNTS: Account[] = [];
const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(ACCOUNTS);
  const [loading, setLoading] = useState(true);


  const [createOpen, setCreateOpen] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "expense" as "asset" | "liability" | "equity" | "revenue" | "expense",
    isActive: true,
    parentAccountId: "" as string,
  });


  useEffect(() => {
    financeApi
      .getAccounts()
      .then((rows: any[]) =>
        setAccounts(
          rows.map((a) => ({
            code: a.code,
            name: a.name,
            type: String(a.type).toLowerCase() as Account["type"],
            subType: a.type,
            balance: 0,
          })),
        ),
      )
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAssets      = accounts.filter(a => a.type === "asset").reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts.filter(a => a.type === "liability").reduce((s, a) => s + a.balance, 0);
  const totalEquity      = accounts.filter(a => a.type === "equity").reduce((s, a) => s + a.balance, 0);

  return (
    <div>
      {loading && (
        <p className="text-sm text-muted mb-4">Loading chart of accounts…</p>
      )}
      {/* ── Header ── */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]">
              <BookOpen size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Chart of Accounts</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Standard GL account codes — seeded at tenant setup. Code <span className="font-mono">2000</span> = AP, <span className="font-mono">1300</span> = Inventory, <span className="font-mono">1400</span> = AR.
          </p>
        </div>
        <Button variant="outline" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
          New Account
        </Button>

      </div>

      {/* ── New Account Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New GL Account"
        description="Create a new General Ledger account in your Chart of Accounts."
      >

        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();

            setSubmitError(null);
            const code = form.code.trim();
            const name = form.name.trim();
            if (!code) {
              setSubmitError('Code is required.');
              return;
            }
            if (!name) {
              setSubmitError('Name is required.');
              return;
            }

            setSubmitLoading(true);
            try {
              await financeApi.createAccount({
                code,
                name,
                type: form.type,
                isActive: form.isActive,
                parentAccountId: form.parentAccountId.trim()
                  ? form.parentAccountId.trim()
                  : undefined,
              });

              setCreateOpen(false);

              const rows: any[] = await financeApi.getAccounts();
              setAccounts(
                rows.map((a) => ({
                  code: String(a.code),
                  name: String(a.name),
                  type: String(a.type).toLowerCase() as Account["type"],
                  subType: String(a.type),
                  // If backend returns balance/amount, use it; otherwise keep 0.
                  balance: typeof a.balance === "number" ? a.balance : typeof a.amount === "number" ? a.amount : 0,
                })),
              );


              // reset after success
              setForm({
                code: '',
                name: '',
                type: 'expense',
                isActive: true,
                parentAccountId: '',
              });
            } catch (err) {
              // Prefer backend validation message if available
              setSubmitError(
                typeof err === "object" && err !== null && "message" in err && typeof (err as any).message === "string"
                  ? (err as any).message
                  : "Failed to create account."
              );

            } finally {
              setSubmitLoading(false);
            }
          }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Code" >
              <input
                className={inputClasses}
                placeholder="e.g. 5100"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={submitLoading}
              />
            </FormField>
            <FormField label="Name" >
              <input
                className={inputClasses}
                placeholder="e.g. Office Supplies Expense"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                disabled={submitLoading}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Type" >
              <select
                className={inputClasses}
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as any })}
                disabled={submitLoading}
              >
                <option value="asset">asset</option>
                <option value="liability">liability</option>
                <option value="equity">equity</option>
                <option value="revenue">revenue</option>
                <option value="expense">expense</option>
              </select>
            </FormField>
            <FormField label="Parent Account ID (optional)" >
              <input
                className={inputClasses}
                placeholder="Leave blank for top-level account"
                value={form.parentAccountId}
                onChange={(e) => setForm({ ...form, parentAccountId: e.target.value })}
                disabled={submitLoading}
              />
            </FormField>
          </div>

          <div>
            <FormField label="Active" >
              <select
                className={inputClasses}
                value={form.isActive ? 'true' : 'false'}
                onChange={(e) => setForm({ ...form, isActive: e.target.value === 'true' })}
                disabled={submitLoading}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </select>
            </FormField>
          </div>

          {submitError && (
            <div className="rounded-md border border-[#B4533B]/30 bg-[#B4533B]/10 px-3 py-2 text-[12px] text-[#B4533B]">
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" disabled={submitLoading} onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitLoading}>
              {submitLoading ? 'Creating…' : 'Create'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── KPI Cards ── */}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Assets"       value={`₹${totalAssets.toLocaleString()}`}       icon={<Landmark size={18} />}    gradient="from-green-500 to-emerald-600" delay="0.05s" />
        <StatCard label="Total Liabilities"  value={`₹${totalLiabilities.toLocaleString()}`}  icon={<PieChart size={18} />}    gradient="from-rose-400 to-red-500"      delay="0.10s" />
        <StatCard label="Total Equity"       value={`₹${totalEquity.toLocaleString()}`}       icon={<Wallet size={18} />}      gradient="from-blue-500 to-indigo-600"   delay="0.15s" />
      </div>

      {/* ── Grouped account tables ── */}
      <div className="mt-8 space-y-4 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        {ACCOUNT_TYPES.map((type) => {
          const group = accounts.filter(a => a.type === type);
          const total = group.reduce((s, a) => s + a.balance, 0);
          return (
            <div key={type} className="border border-[#E4E2DC] rounded-lg overflow-hidden">
              {/* Group header */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#FAFAF9] border-b border-[#E4E2DC]">
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[type]}`}>
                  {type}
                </span>
                <span className="text-[12px] font-mono text-[#8A8678]">
                  Total: ₹{total.toLocaleString()}
                </span>
              </div>
              {/* Rows */}
              <table className="w-full text-[13px]">
                <tbody>
                  {group.map((a, i) => (
                    <tr
                      key={a.code}
                      className={`border-b border-[#F0EEE7] last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAF9]"}`}
                    >
                      <td className="px-4 py-2.5 font-mono text-[#8A8678] w-16">{a.code}</td>
                      <td className="px-4 py-2.5 font-medium text-[#14171F]">{a.name}</td>
                      <td className="px-4 py-2.5 text-[#8A8678] text-[11px]">{a.subType.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-[#14171F]">
                        ₹{a.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}