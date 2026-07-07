"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Building2, Loader2, AlertCircle } from "lucide-react";
import { tenantApi } from "@/lib/api/tenant-api";

export default function LoginPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return;

    setLoading(true);
    setError(null);

    try {
      const data = await tenantApi.checkExists(cleanSlug);

      if (!data.exists) {
        setError(`No company found with domain "${cleanSlug}". Please check the spelling.`);
        return;
      }

      localStorage.setItem("tenant_slug", cleanSlug);

      const kcBase = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180";
      const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "amdox-erp-web";
      const redirectUri = encodeURIComponent(`${window.location.origin}/home`);

      const loginUrl = `${kcBase}/realms/${cleanSlug}/protocol/openid-connect/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid`;

      window.location.href = loginUrl;
    } catch (err) {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
              AX
            </div>
            <span className="text-xl font-semibold text-slate-900 tracking-tight">AmdoxERP</span>
          </div>
          <p className="text-sm text-slate-500">Sign in to your company workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-card">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
              <Building2 size={18} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-900">Enter your company domain</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                You&apos;ll be redirected to your company&apos;s login page
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                Company Domain
              </label>
              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
                <span className="px-3 py-2.5 text-sm text-slate-500 bg-slate-50 border-r border-slate-200 select-none">
                  app /
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setError(null);
                  }}
                  placeholder="company-b"
                  autoFocus
                  required
                  suppressHydrationWarning
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-slate-900 placeholder:text-slate-300"
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                This is the slug you used when creating your tenant.
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !slug.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Continue <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="mt-5 text-center space-y-2">
          <p className="text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/create-tenant" className="text-blue-600 hover:underline font-medium">
              Create a tenant
            </Link>
          </p>
          <Link
            href="/"
            className="block text-xs text-slate-500 hover:text-slate-700 transition-colors"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
