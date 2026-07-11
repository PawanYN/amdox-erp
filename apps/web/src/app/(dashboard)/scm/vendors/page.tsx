"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { Building2, Plus, Users, Briefcase, KeyRound, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { scmApi } from "@/lib/api/scm-api";

type BackendVendor = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  isActive: boolean;
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<BackendVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BackendVendor | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [issuingKeyFor, setIssuingKeyFor] = useState<string | null>(null);
  const [issuedKey, setIssuedKey] = useState<{
    vendorName: string;
    accessKey: string;
  } | null>(null);

  const load = () =>
    scmApi
      .getVendors()
      .then(setVendors)
      .catch(console.error)
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName("");
    setEmail("");
    setPhone("");
    setFormOpen(true);
  }

  function openEdit(vendor: BackendVendor) {
    setEditing(vendor);
    setName(vendor.name);
    setEmail(vendor.email || "");
    setPhone(vendor.phone || "");
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      if (editing) {
        await scmApi.updateVendor(editing.id, payload);
      } else {
        await scmApi.createVendor(payload);
      }
      await load();
      setFormOpen(false);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save vendor.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vendor: BackendVendor) {
    if (!confirm(`Delete vendor "${vendor.name}"?`)) return;
    try {
      await scmApi.deleteVendor(vendor.id);
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete vendor.", "error");
    }
  }

  const handleIssuePortalKey = async (vendor: BackendVendor) => {
    if (!vendor.email) {
      toast("Add an email to this vendor before issuing a portal key.", "error");
      return;
    }
    setIssuingKeyFor(vendor.id);
    try {
      const result = (await scmApi.issueVendorPortalKey(vendor.id)) as {
        accessKey?: string;
        vendorName?: string;
      };
      if (!result.accessKey) {
        throw new Error("Server did not return an access key.");
      }
      setIssuedKey({
        vendorName: result.vendorName || vendor.name,
        accessKey: result.accessKey,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to issue portal key";
      toast(
        message.includes("403") || message.toLowerCase().includes("forbidden")
          ? "Permission denied — your role cannot issue portal keys. Try logging in as Tenant Admin."
          : message,
        "error",
      );
    } finally {
      setIssuingKeyFor(null);
    }
  };

  const columns: ColumnDef<BackendVendor>[] = [
    {
      header: "Vendor",
      cell: (v) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 shrink-0">
            <Building2 size={14} />
          </div>
          <div>
            <p className="text-[13px] font-semibold text-slate-900">{v.name}</p>
            <p className="text-[11px] text-slate-500">{v.email || "No email"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Phone",
      cell: (v) => <span className="text-[13px] text-slate-500">{v.phone || "—"}</span>,
    },
    {
      header: "Status",
      cell: (v) => (
        <Badge tone={v.isActive ? "active" : "inactive"}>
          {v.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Portal",
      cell: (v) => (
        <button
          type="button"
          onClick={() => handleIssuePortalKey(v)}
          disabled={!v.email || issuingKeyFor === v.id}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:no-underline"
          title={v.email ? "Issue supplier portal access key" : "Add vendor email first"}
        >
          <KeyRound size={13} />
          {issuingKeyFor === v.id ? "Issuing…" : "Issue key"}
        </button>
      ),
    },
    {
      header: "Actions",
      cell: (v) => (
        <div className="flex gap-2">
          <button
            onClick={() => openEdit(v)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 transition-colors"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleDelete(v)}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-50 border border-slate-200 text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  const activeVendors = vendors.filter((v) => v.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 size={18} className="text-slate-500" />
            Vendors
          </h1>
          <p className="page-subtitle mt-1">Manage vendor profiles, contacts and portal access</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={openCreate}>
          Add Vendor
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total Vendors"
          value={vendors.length}
          icon={<Briefcase size={16} />}
          gradient="from-blue-500 to-blue-600"
          delay="0s"
        />
        <StatCard
          label="Active"
          value={activeVendors}
          icon={<Users size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
      </div>

      <DataTable
        data={vendors}
        columns={columns}
        keyExtractor={(v) => v.id}
        emptyMessage={loading ? "Loading vendors…" : "No vendors found."}
      />

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Vendor" : "Add Vendor"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Name *</label>
            <input
              className={inputClasses}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Supplies"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Email</label>
            <input
              className={inputClasses}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@vendor.com"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-slate-600 block mb-1.5">Phone</label>
            <input
              className={inputClasses}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title="Supplier portal key"
      >
        {issuedKey && (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Key for <span className="font-semibold text-slate-900">{issuedKey.vendorName}</span>.
              Copy it now — it is shown only once.
            </p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-900 break-all select-all">
              {issuedKey.accessKey}
            </div>
            <p className="text-xs text-slate-500">
              Supplier login: <span className="font-medium">/vendor-portal</span> · tenant slug{" "}
              <span className="font-medium">company-a</span> · vendor email · this key
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  void navigator.clipboard.writeText(issuedKey.accessKey);
                }}
              >
                Copy key
              </Button>
              <Button onClick={() => setIssuedKey(null)}>Done</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
