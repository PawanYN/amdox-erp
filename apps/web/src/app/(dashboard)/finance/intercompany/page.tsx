"use client";
import { toast } from "@/components/ui/toast";

import { useEffect, useState } from "react";
import { Plus, ArrowLeftRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, inputClasses } from "@/components/ui/modal";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { financeApi } from "@/lib/api/finance-api";

type GlAccount = { id: string; code: string; name: string };

type IntercompanyTransfer = {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: string | number;
  description?: string;
  createdAt: string;
};

export default function IntercompanyPage() {
  const [transfers, setTransfers] = useState<IntercompanyTransfer[]>([]);
  const [accounts, setAccounts] = useState<GlAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  const accountLabel = (id: string) => {
    const acct = accounts.find((a) => a.id === id);
    return acct ? `${acct.code} — ${acct.name}` : id.slice(0, 8);
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, accts] = await Promise.all([
        financeApi.listIntercompanyTransfers(),
        financeApi.getAccounts(),
      ]);
      setTransfers(list);
      setAccounts(accts);
      if (accts.length >= 2) {
        if (!fromAccountId) setFromAccountId(accts[0].id);
        if (!toAccountId) setToAccountId(accts[1].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load intercompany transfers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function handleCreate() {
    const amt = Number(amount);
    if (!fromAccountId || !toAccountId || !amt || amt <= 0) return;
    if (fromAccountId === toAccountId) {
      toast("Source and destination accounts must differ.", "error");
      return;
    }

    setSaving(true);
    try {
      await financeApi.createIntercompanyTransfer({
        fromAccountId,
        toAccountId,
        amount: amt,
        description: description.trim() || undefined,
      });
      setFormOpen(false);
      setAmount("");
      setDescription("");
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create transfer.", "error");
    } finally {
      setSaving(false);
    }
  }

  const columns: ColumnDef<IntercompanyTransfer>[] = [
    {
      header: "From",
      cell: (t) => (
        <span style={{fontSize: '13px', color: '#2b2f36'}}>{accountLabel(t.fromAccountId)}</span>
      ),
    },
    {
      header: "To",
      cell: (t) => (
        <span style={{fontSize: '13px', color: '#2b2f36'}}>{accountLabel(t.toAccountId)}</span>
      ),
    },
    {
      header: "Amount",
      cell: (t) => (
        <span style={{fontFamily: 'monospace', fontWeight: 600, color: '#2b2f36'}}>
          ₹{Number(t.amount).toLocaleString("en-IN")}
        </span>
      ),
    },
    {
      header: "Description",
      cell: (t) => <span style={{fontSize: '13px', color: '#6b7280'}}>{t.description || "—"}</span>,
    },
    {
      header: "Date",
      cell: (t) => (
        <span style={{fontSize: '13px', color: '#6b7280'}}>
          {new Date(t.createdAt).toLocaleDateString("en-IN")}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <ArrowLeftRight size={18} style={{color: '#6b7280'}} />
            Intercompany Transfers
          </h1>
          <p className="page-subtitle mt-1">
            Move balances between GL accounts with automatic journal entries
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setFormOpen(true)}>
          New Transfer
        </Button>
      </div>

      {error && <p style={{fontSize: '13px', color: '#dc2626'}}>{error}</p>}

      {loading ? (
        <p style={{fontSize: '14px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '8px'}}>
          <Loader2 size={16} style={{animation: 'spin 1s linear infinite'}} /> Loading transfers…
        </p>
      ) : (
        <DataTable
          data={transfers}
          columns={columns}
          keyExtractor={(t) => t.id}
          emptyMessage="No intercompany transfers yet."
        />
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="New Intercompany Transfer">
        <div className="space-y-3">
          <div>
            <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
              From account *
            </label>
            <select
              className={inputClasses}
              value={fromAccountId}
              onChange={(e) => setFromAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
              To account *
            </label>
            <select
              className={inputClasses}
              value={toAccountId}
              onChange={(e) => setToAccountId(e.target.value)}
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
              Amount (₹) *
            </label>
            <input
              type="number"
              min={0}
              className={inputClasses}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <label style={{fontSize: '12px', fontWeight: 500, color: '#2b2f36', display: 'block', marginBottom: '6px'}}>
              Description
            </label>
            <input
              className={inputClasses}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional memo"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving || accounts.length < 2}>
              {saving ? "Creating…" : "Create Transfer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
