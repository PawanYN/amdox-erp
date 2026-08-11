"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { BookOpen, Landmark, PieChart, Wallet, Plus, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { Modal } from "@/components/ui/modal";
import { FormRow, FormInput, FormSelect } from "@/components/ui/form-row";
import { financeApi, type AccountBalance } from "@/lib/api/finance-api";

const TYPE_META: Record<string, { label: string; color: string; bg: string; borderColor: string }> = {
  asset: { label: "Asset", color: "#1f5fa8", bg: "#e8f1fb", borderColor: "#dfe3e8" },
  liability: { label: "Liability", color: "#d0392b", bg: "#fdecea", borderColor: "#dfe3e8" },
  equity: { label: "Equity", color: "#8a6300", bg: "#fff6e0", borderColor: "#dfe3e8" },
  revenue: { label: "Revenue", color: "#1e7a3e", bg: "#e6f4ea", borderColor: "#dfe3e8" },
  expense: { label: "Expense", color: "#8a6300", bg: "#fff6e0", borderColor: "#dfe3e8" },
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
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen size={18} style={{color: '#6b7280'}} />
            Chart of Accounts
          </h1>
          <p className="page-subtitle mt-1">
            Standard GL account codes — double-entry bookkeeping foundation
          </p>
        </div>
        <button className="btn primary" onClick={openCreate} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
          <Plus size={14} />
          New Account
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-lg animate-pulse" style={{background: '#f4f6f8'}} />
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

      <div className="space-y-3">
        {ACCOUNT_TYPES.map((type) => {
          const group = accounts.filter((a) => a.type === type);
          const meta = TYPE_META[type];
          const total = group.reduce((s, a) => s + a.balance, 0);
          const open = openGroups[type];

          return (
            <div
              key={type}
              className="bg-white rounded-lg shadow-card overflow-hidden"
              style={{border: '1px solid #dfe3e8'}}
            >
              <button
                className="w-full flex items-center justify-between px-4 py-3 transition-colors"
                style={{
                  background: open ? '#f7f9fb' : 'transparent'
                }}
                onMouseEnter={(e) => {if (!open) e.currentTarget.style.background = '#f7f9fb'}}
                onMouseLeave={(e) => {if (!open) e.currentTarget.style.background = 'transparent'}}
                onClick={() => setOpenGroups((s) => ({ ...s, [type]: !s[type] }))}
              >
                <div className="flex items-center gap-2.5">
                  <ChevronRight
                    size={14}
                    style={{
                      color: '#6b7280',
                      transition: 'transform 0.15s',
                      transform: open ? 'rotate(90deg)' : 'rotate(0)'
                    }}
                  />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 8px',
                      borderRadius: '3px',
                      background: meta.bg,
                      color: meta.color,
                      border: `1px solid ${meta.borderColor}`,
                      textTransform: 'capitalize'
                    }}
                  >
                    {meta.label}
                  </span>
                  <span style={{fontSize: '12px', color: '#6b7280'}}>{group.length} accounts</span>
                </div>
                <span style={{fontSize: '12px', fontFamily: 'monospace', color: '#6b7280'}}>
                  ₹{total.toLocaleString()}
                </span>
              </button>

              {open && (
                <div className="overflow-x-auto">
                  <table className="table-data" style={{width: '100%'}}>
                    <tbody>
                      {group.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{padding: '12px 16px', fontSize: '12px', color: '#6b7280', fontStyle: 'italic'}}>
                            No {type} accounts found.
                          </td>
                        </tr>
                      ) : (
                        group.map((a) => (
                          <tr key={a.code} style={{borderBottom: '1px solid #f2f3f5'}}>
                            <td style={{padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6b7280', width: '64px'}}>
                              {a.code}
                            </td>
                            <td style={{padding: '10px 16px', fontWeight: 500, color: '#2b2f36'}}>{a.name}</td>
                            <td style={{padding: '10px 16px', fontSize: '12px', color: '#6b7280', display: window.innerWidth < 640 ? 'none' : 'table-cell'}}>
                              {a.subType.replace(/_/g, " ")}
                            </td>
                            <td style={{padding: '10px 16px', textAlign: 'right', fontFamily: 'monospace', color: '#2b2f36'}}>
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
        <div style={{padding: '20px 24px'}}>
          <FormRow label="Code" required>
            <FormInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. 1300"
            />
          </FormRow>
          <FormRow label="Name" required>
            <FormInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Inventory"
            />
          </FormRow>
          <FormRow label="Type" required>
            <FormSelect value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t.toUpperCase()}>
                  {TYPE_META[t].label}
                </option>
              ))}
            </FormSelect>
          </FormRow>
          <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Create"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
