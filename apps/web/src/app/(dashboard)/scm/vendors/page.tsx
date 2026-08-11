"use client";
import { toast } from "@/components/ui/toast";

import { useState, useEffect } from "react";
import { Building2, Plus, Users, Briefcase, KeyRound, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { Modal, inputClasses } from "@/components/ui/modal";
import { FormRow, FormInput } from "@/components/ui/form-row";
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 size={18} style={{color: '#6b7280'}} />
            Vendors
          </h1>
          <p className="page-subtitle mt-1">Manage vendor profiles, contacts and portal access</p>
        </div>
        <button className="btn primary" onClick={openCreate} style={{display: 'flex', alignItems: 'center', gap: '6px'}}>
          <Plus size={14} />
          Add Vendor
        </button>
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
          value={vendors.filter((v) => v.isActive).length}
          icon={<Users size={16} />}
          gradient="from-emerald-500 to-emerald-600"
          delay="0.05s"
        />
      </div>

      <div className="bg-card" style={{border: '1px solid #dfe3e8', borderRadius: '6px', overflow: 'hidden'}}>
        <table className="table-data" style={{width: '100%'}}>
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Portal</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>Loading vendors…</td></tr>
            ) : vendors.length === 0 ? (
              <tr><td colSpan={5} style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>No vendors found.</td></tr>
            ) : (
              vendors.map((v) => (
                <tr key={v.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-md border flex items-center justify-center shrink-0" style={{background: '#e8f1fb', borderColor: '#dfe3e8'}}>
                        <Building2 size={14} style={{color: '#1f5fa8'}} />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold" style={{color: '#2b2f36'}}>{v.name}</p>
                        <p className="text-[11px]" style={{color: '#6b7280'}}>{v.email || "No email"}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="text-[13px]" style={{color: '#6b7280'}}>{v.phone || "—"}</span></td>
                  <td><Badge tone={v.isActive ? "active" : "inactive"}>{v.isActive ? "Active" : "Inactive"}</Badge></td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleIssuePortalKey(v)}
                      disabled={!v.email || issuingKeyFor === v.id}
                      className="inline-flex items-center gap-1.5 text-[12px] font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      style={{color: v.email && issuingKeyFor !== v.id ? '#1f5fa8' : '#6b7280'}}
                      title={v.email ? "Issue supplier portal access key" : "Add vendor email first"}
                    >
                      <KeyRound size={13} />
                      {issuingKeyFor === v.id ? "Issuing…" : "Issue key"}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(v)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
                        style={{background: '#f4f6f8', borderColor: '#dfe3e8', color: '#6b7280'}}
                        onMouseEnter={(e) => {e.currentTarget.style.background = '#e8f1fb'; e.currentTarget.style.borderColor = '#1f5fa8'; e.currentTarget.style.color = '#1f5fa8'}}
                        onMouseLeave={(e) => {e.currentTarget.style.background = '#f4f6f8'; e.currentTarget.style.borderColor = '#dfe3e8'; e.currentTarget.style.color = '#6b7280'}}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(v)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
                        style={{background: '#f4f6f8', borderColor: '#dfe3e8', color: '#6b7280'}}
                        onMouseEnter={(e) => {e.currentTarget.style.background = '#fdecea'; e.currentTarget.style.borderColor = '#d0392b'; e.currentTarget.style.color = '#d0392b'}}
                        onMouseLeave={(e) => {e.currentTarget.style.background = '#f4f6f8'; e.currentTarget.style.borderColor = '#dfe3e8'; e.currentTarget.style.color = '#6b7280'}}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Vendor" : "Add Vendor"}
      >
        <div style={{padding: '20px 24px'}}>
          <FormRow label="Name" required>
            <FormInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Supplies"
            />
          </FormRow>
          <FormRow label="Email">
            <FormInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@vendor.com"
            />
          </FormRow>
          <FormRow label="Phone">
            <FormInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
            />
          </FormRow>
          <div style={{marginTop: '20px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
            <button className="btn" onClick={() => setFormOpen(false)}>Cancel</button>
            <button className="btn primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Update" : "Create"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(issuedKey)}
        onClose={() => setIssuedKey(null)}
        title="Supplier portal key"
      >
        {issuedKey && (
          <div style={{padding: '20px 24px'}}>
            <p style={{fontSize: '13px', color: '#6b7280', marginBottom: '12px'}}>
              Key for <span style={{fontWeight: 600, color: '#2b2f36'}}>{issuedKey.vendorName}</span>.
              Copy it now — it is shown only once.
            </p>
            <div style={{borderRadius: '4px', border: '1px solid #dfe3e8', background: '#f4f6f8', padding: '12px', fontFamily: 'monospace', fontSize: '13px', color: '#2b2f36', wordBreak: 'break-all', userSelect: 'all'}}>
              {issuedKey.accessKey}
            </div>
            <p style={{fontSize: '12px', color: '#6b7280', marginTop: '12px'}}>
              Supplier login: <span style={{fontWeight: 500}}>/vendor-portal</span> · tenant slug <span style={{fontWeight: 500}}>company-a</span> · vendor email · this key
            </p>
            <div style={{marginTop: '16px', display: 'flex', gap: '10px', justifyContent: 'flex-end'}}>
              <button
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(issuedKey.accessKey);
                }}
              >
                Copy key
              </button>
              <button className="btn primary" onClick={() => setIssuedKey(null)}>Done</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
