"use client";

import { useState } from "react";
import { Plus, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CreateTenantPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    adminEmail: "",
    adminPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await fetch("http://localhost:3001/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to create tenant");
      }

      setSuccess(true);
      setTimeout(() => router.push("/home"), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAF9] py-20 px-4 font-sans">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create New Tenant</h1>
          <p className="text-[#6B675D] mt-1">
            Provision a new isolated workspace (Realm + Database Segment) for a new customer.
          </p>
        </div>

      {success ? (
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center flex flex-col items-center justify-center">
          <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
          <h3 className="text-lg font-medium text-green-800">Tenant Created Successfully!</h3>
          <p className="text-green-600 mt-2 text-sm">
            Keycloak Realm and Database records have been provisioned. Redirecting to home...
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="bg-white border border-[#E4E2DC] rounded-lg p-6 shadow-sm">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#4A4740] mb-1.5">Company Name</label>
              <input
                required
                type="text"
                placeholder="e.g., Acme Corporation"
                className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-[#1E3A5F] text-sm"
                value={formData.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setFormData({
                    ...formData,
                    name,
                    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)+/g, "")
                  });
                }}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4A4740] mb-1.5">Tenant Slug (Realm ID)</label>
              <input
                required
                type="text"
                placeholder="e.g., acme-corp"
                className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-[#1E3A5F] text-sm bg-gray-50"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              />
              <p className="text-xs text-gray-500 mt-1">This will be used for the unique Keycloak Realm and Login URL.</p>
            </div>

            <hr className="border-gray-200 my-6" />
            <h3 className="text-[13px] font-semibold text-[#8A8678] uppercase tracking-wider mb-4 flex items-center gap-2">
              <KeyRound size={14} /> Initial Admin Account
            </h3>

            <div>
              <label className="block text-sm font-medium text-[#4A4740] mb-1.5">Admin Email</label>
              <input
                required
                type="email"
                placeholder="admin@company.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-[#1E3A5F] text-sm"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#4A4740] mb-1.5">Admin Password</label>
              <input
                required
                type="password"
                placeholder="••••••••"
                minLength={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md outline-none focus:ring-1 focus:ring-[#1E3A5F] text-sm"
                value={formData.adminPassword}
                onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1E3A5F] rounded-md hover:bg-[#152a45] disabled:opacity-70"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Provision Tenant
            </button>
          </div>
        </form>
      )}
      </div>
    </div>
  );
}
