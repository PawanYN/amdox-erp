"use client";

import { useState, useEffect } from "react";
import { Building2, Plus, Star, Users, Briefcase, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, statusToTone } from "@/components/ui/badge";
import { Card, Table, THead, TH, TBody, TR, TD, EmptyState } from "@/components/ui/table";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { StatCard } from "@/components/ui/stat-card";
import { scmApi } from "@/lib/api/scm-api";

type BackendVendor = {
  id: string;
  name: string;
  email?: string;
  contactPhone?: string;
  rating?: number;
  isActive: boolean;
};

export default function VendorsPage() {
  const [vendors, setVendors] = useState<BackendVendor[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await scmApi.getVendors();
      setVendors(data);
    } catch (err) {
      console.error("Failed to fetch vendors", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleAddVendor = () => {
    // Stub
    console.log("Add Vendor clicked");
  };

  const handleIssuePortalKey = async (vendor: BackendVendor) => {
    if (!vendor.email) {
      alert("Add an email to this vendor before issuing a portal key.");
      return;
    }
    try {
      const result = await scmApi.issueVendorPortalKey(vendor.id);
      alert(
        `Portal key for ${vendor.name}:\n\n${result.accessKey}\n\nShare this with the supplier. Login at /vendor-portal`,
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to issue portal key");
    }
  };

  const columns: ColumnDef<BackendVendor>[] = [
    {
      header: "Vendor ID",
      cell: (vendor) => (
        <span className="font-mono text-xs font-bold text-brand-purple bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">
          {vendor.id.slice(0, 8).toUpperCase()}
        </span>
      ),
    },
    {
      header: "Name",
      cell: (vendor) => <span className="font-semibold text-ink">{vendor.name}</span>,
    },
    {
      header: "Email",
      cell: (vendor) => <span className="text-sm text-muted">{vendor.email || "N/A"}</span>,
    },
    {
      header: "Phone",
      cell: (vendor) => <span className="text-sm text-muted">{vendor.contactPhone || "N/A"}</span>,
    },
    {
      header: "Rating",
      cell: (vendor) => (
        <div className="flex items-center gap-1 text-amber-500 font-medium">
          <Star size={14} className="fill-amber-500" />
          {vendor.rating || "N/A"}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (vendor) => (
        <Badge tone={vendor.isActive ? "active" : "inactive"}>
          {vendor.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Portal",
      cell: (vendor) => (
        <button
          onClick={() => handleIssuePortalKey(vendor)}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-purple hover:underline"
        >
          <KeyRound size={14} /> Issue key
        </button>
      ),
    },
  ];

  const totalVendors = vendors.length;
  const activeVendors = vendors.filter(v => v.isActive).length;
  const avgRating = totalVendors > 0 
    ? (vendors.reduce((acc, curr) => acc + (curr.rating || 0), 0) / totalVendors).toFixed(1)
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in-up">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]">
              <Building2 size={16} />
            </div>
            <h1 className="text-2xl font-bold text-ink">Vendors</h1>
          </div>
          <p className="text-sm text-muted ml-10">
            Manage vendor profiles, contacts, and performance ratings
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={handleAddVendor}>
          Add Vendor
        </Button>
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total Vendors" value={totalVendors} icon={<Briefcase size={18} />} gradient="from-indigo-500 to-purple-600" delay="0.05s" />
        <StatCard label="Active" value={activeVendors} icon={<Users size={18} />} gradient="from-emerald-400 to-teal-500" delay="0.10s" />
        <StatCard label="Avg Rating" value={avgRating} icon={<Star size={18} />} gradient="from-amber-400 to-orange-500" delay="0.15s" />
      </div>

      <div className="mt-8 animate-fade-in-up" style={{ animationDelay: "0.20s" }}>
        <DataTable data={vendors} columns={columns} keyExtractor={(vendor) => vendor.id} emptyMessage={loading ? "Loading..." : "No vendors found."} />
      </div>
    </div>
  );
}