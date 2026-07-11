"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { BookOpen, Landmark, PieChart, Wallet, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { financeApi, type AccountBalance } from "@/lib/api/finance-api";

const TYPE_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  asset: { label: "Asset", color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-100" },
  liability: {
    label: "Liability",
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  equity: {
    label: "Equity",
    color: "text-violet-700",
    bg: "bg-violet-50",
    border: "border-violet-100",
  },
  revenue: {
    label: "Revenue",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  expense: {
    label: "Expense",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
};

type Account = {
  code: string;
  name: string;
  type: "asset" | "liability" | "equity" | "revenue" | "expense";
  subType: string;
  balance: number;
};

const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

type RawAccount = {
  id: string;
  code: string;
  name: string;
  type: string;
};

/** Credit-normal account types: display balance as credit − debit so KPIs stay positive. */
const CREDIT_NORMAL = new Set(["liability", "equity", "revenue"]);

function displayBalance(type: Account["type"], rawDebitMinusCredit: number): number {
  return CREDIT_NORMAL.has(type) ? -rawDebitMinusCredit : rawDebitMinusCredit;
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    asset: true,
    liability: true,
    equity: true,
    revenue: true,
    expense: true,
  });
  const [formOpen, setFormOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE">(
    "ASSET",
  );
  const [saving, setSaving] = useState(false);

  const load = () =>
    Promise.all([financeApi.getAccounts(), financeApi.getAccountBalances()])
      .then(([rows, balances]: [RawAccount[], AccountBalance[]]) => {
        const byId = new Map(balances.map((b) => [b.accountId, b.balance]));
        const byCode = new Map(balances.map((b) => [b.code, b.balance]));
        setAccounts(
          rows.map((a) => {
            const acctType = String(a.type).toLowerCase() as Account["type"];
            const raw = byId.get(a.id) ?? byCode.get(a.code) ?? 0;
            return {
              code: a.code,
              name: a.name,
              type: acctType,
              subType: a.type,
              balance: displayBalance(acctType, raw),
            };
          }),
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setCode("");
    setName("");
    setType("ASSET");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!code.trim() || !name.trim()) return;
    setSaving(true);
    try {
      await financeApi.createAccount({ code: code.trim(), name: name.trim(), type });
      await load();
      setFormOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create account.", "error");
    } finally {
      setSaving(false);
    }
  }

  const totalAssets = accounts.filter((a) => a.type === "asset").reduce((s, a) => s + a.balance, 0);
  const totalLiabilities = accounts
    .filter((a) => a.type === "liability")
    .reduce((s, a) => s + a.balance, 0);
  const totalEquity = accounts
    .filter((a) => a.type === "equity")
    .reduce((s, a) => s + a.balance, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen size={18} className="text-slate-500" />
            Chart of Accounts
          </h1>
          <p className="page-subtitle mt-1">
            Standard GL account codes — double-entry bookkeeping foundation
          </p>
        </div>
        <Button icon={<Plus size={14} />} onClick={openCreate}>
          New Account
        </Button>
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Assets"
            value={`₹${totalAssets.toLocaleString()}`}
            icon={<Landmark size={16} />}
            gradient="from-blue-500 to-blue-600"
            delay="0s"
          />
          <StatCard
            label="Total Liabilities"
            value={`₹${totalLiabilities.toLocaleString()}`}
            icon={<PieChart size={16} />}
            gradient="from-red-400 to-red-500"
            delay="0.05s"
          />
          <StatCard
            label="Total Equity"
            value={`₹${totalEquity.toLocaleString()}`}
            icon={<Wallet size={16} />}
            gradient="from-violet-500 to-violet-600"
            delay="0.1s"
          />
        </div>
      )}

      {/* Account groups */}
      <div className="space-y-3">
        {ACCOUNT_TYPES.map((type) => {
          const group = accounts.filter((a) => a.type === type);
          const meta = TYPE_META[type];
          const total = group.reduce((s, a) => s + a.balance, 0);
          const open = openGroups[type];

          return (
            <div
              key={type}
              className="bg-white rounded-lg border border-slate-200 shadow-card overflow-hidden"
            >
              {/* Group header */}
              <button
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                onClick={() => setOpenGroups((s) => ({ ...s, [type]: !s[type] }))}
              >
                <div className="flex items-center gap-2.5">
                  <ChevronRight
                    size={14}
                    className={`text-slate-500 transition-transform duration-150 ${open ? "rotate-90" : ""}`}
                  />
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full capitalize ${meta.bg} ${meta.color} ${meta.border} border`}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[12px] text-slate-500">{group.length} accounts</span>
                </div>
                <span className="text-[12px] font-mono text-slate-500">
                  ₹{total.toLocaleString()}
                </span>
              </button>

              {open && (
                <div className="overflow-x-auto">
                  <table className="w-full text-[13px]">
                    <tbody className="divide-y divide-slate-100">
                      {group.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="px-4 py-3 text-[12px] text-slate-500 italic">
                            No {type} accounts found.
                          </td>
                        </tr>
                      ) : (
                        group.map((a) => (
                          <tr key={a.code} className="hover:bg-slate-50/60 transition-colors">
                            <td className="px-4 py-2.5 font-mono text-[12px] text-slate-500 w-16">
                              {a.code}
                            </td>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{a.name}</td>
                            <td className="px-4 py-2.5 text-[12px] text-slate-500 hidden sm:table-cell">
                              {a.subType.replace(/_/g, " ")}
                            </td>
                            <td className="px-4 py-2.5 text-right font-mono text-slate-700">
                              ₹{a.balance.toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Account">
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Code *</label>
            <input
              className={inputClasses}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 1300"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Name *</label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inventory"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Type *</label>
            <select
              className={inputClasses}
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t.toUpperCase()}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
