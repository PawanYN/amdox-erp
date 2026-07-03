"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, Star, Users, Briefcase, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { scmApi } from "@/lib/api/scm-api";

type BackendVendor = {
  id: string; name: string; email?: string; contactPhone?: string;
  rating?: number; isActive: boolean;
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<BackendVendor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    scmApi.getVendors()
      .then(setVendors)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleIssuePortalKey = async (vendor: BackendVendor) => {
    if (!vendor.email) { alert("Add an email to this vendor before issuing a portal key."); return; }
    try {
      const result = await scmApi.issueVendorPortalKey(vendor.id);
      alert(`Portal key for ${vendor.name}:\n\n${result.accessKey}\n\nShare this with the supplier. Login at /vendor-portal`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue portal key");
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
            <p className="text-[11px] text-slate-400">{v.email || "No email"}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Phone",
      cell: (v) => <span className="text-[13px] text-slate-500">{v.contactPhone || "—"}</span>,
    },
    {
      header: "Rating",
      cell: (v) => v.rating ? (
        <div className="flex items-center gap-1 text-amber-500 font-semibold text-[13px]">
          <Star size={13} className="fill-amber-400" />
          {v.rating}
        </div>
      ) : <span className="text-slate-300 text-[13px]">—</span>,
    },
    {
      header: "Status",
      cell: (v) => <Badge tone={v.isActive ? "active" : "inactive"}>{v.isActive ? "Active" : "Inactive"}</Badge>,
    },
    {
      header: "Portal",
      cell: (v) => (
        <button
          onClick={() => handleIssuePortalKey(v)}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-blue-600 hover:text-blue-700 hover:underline"
        >
          <KeyRound size={13} /> Issue key
        </button>
      ),
    },
  ];

  const activeVendors = vendors.filter((v) => v.isActive).length;
  const avgRating = vendors.length > 0
    ? (vendors.reduce((a, v) => a + (v.rating || 0), 0) / vendors.length).toFixed(1)
    : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Building2 size={18} className="text-slate-400" />
            Vendors
          </h1>
          <p className="page-subtitle mt-1">Manage vendor profiles, contacts, ratings and portal access</p>
        </div>
        <Button icon={<Plus size={14} />} onClick={() => console.log("Add Vendor — FE-01 pending")}>
          Add Vendor
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Vendors" value={vendors.length} icon={<Briefcase size={16} />} gradient="from-blue-500 to-blue-600"      delay="0s" />
        <StatCard label="Active"        value={activeVendors}  icon={<Users size={16} />}     gradient="from-emerald-500 to-emerald-600" delay="0.05s" />
        <StatCard label="Avg Rating"    value={avgRating}      icon={<Star size={16} />}      gradient="from-amber-400 to-amber-500"    delay="0.1s" />
      </div>

      <DataTable
        data={vendors}
        columns={columns}
        keyExtractor={(v) => v.id}
        emptyMessage={loading ? "Loading vendors…" : "No vendors found."}
      />
    </div>
  );
}
