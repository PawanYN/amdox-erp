"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Loader2, AlertCircle, Mail, ChevronRight } from "lucide-react";
import { tenantApi } from "@/lib/api/tenant-api";

type TenantOption = { slug: string; name: string };

/** Build the realm's Keycloak login URL, pre-filling the email when known. */
function keycloakLoginUrl(slug: string, email?: string) {
  const kcBase = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180";
  const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "amdox-erp-web";
  const redirectUri = encodeURIComponent(`${window.location.origin}/home`);
  const hint = email ? `&login_hint=${encodeURIComponent(email)}` : "";
  return `${kcBase}/realms/${slug}/protocol/openid-connect/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid${hint}`;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [slug, setSlug] = useState("");
  const [options, setOptions] = useState<TenantOption[]>([]);
  const [showSlugFallback, setShowSlugFallback] = useState(false);
  const [rememberedSlug, setRememberedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRememberedSlug(localStorage.getItem("tenant_slug"));
  }, []);

  const proceed = (tenantSlug: string, loginEmail?: string) => {
    localStorage.setItem("tenant_slug", tenantSlug);
    window.location.href = keycloakLoginUrl(tenantSlug, loginEmail);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return;

    setLoading(true);
    setError(null);
    setOptions([]);

    try {
      const { tenants } = await tenantApi.discoverByEmail(cleanEmail);

      if (tenants.length === 1) {
        proceed(tenants[0].slug, cleanEmail);
        return;
      }
      if (tenants.length > 1) {
        setOptions(tenants);
        return;
      }
      setShowSlugFallback(true);
      setError(
        "We couldn't find a company for this email. If you know your company ID, enter it below.",
      );
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSlugSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = slug.trim().toLowerCase();
    if (!cleanSlug) return;

    setLoading(true);
    setError(null);

    try {
      const data = await tenantApi.checkExists(cleanSlug);
      if (!data.exists) {
        setError(`No company found with ID "${cleanSlug}". Please check the spelling.`);
        return;
      }
      proceed(cleanSlug, email.trim().toLowerCase() || undefined);
    } catch {
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
          {options.length > 1 ? (
            <>
              <div className="flex items-center gap-3 mb-5">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Building2 size={18} className="text-blue-600" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-slate-900">Choose your company</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {email} belongs to more than one workspace
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                {options.map((t) => (
                  <button
                    key={t.slug}
                    onClick={() => proceed(t.slug, email.trim().toLowerCase())}
                    className="w-full flex items-center justify-between px-4 py-3 border border-slate-200 rounded-lg text-left hover:border-blue-300 hover:bg-blue-50/40 transition-colors"
                  >
                    <span>
                      <span className="block text-sm font-medium text-slate-900">{t.name}</span>
                      <span className="block text-xs text-slate-500">app / {t.slug}</span>
                    </span>
                    <ChevronRight size={16} className="text-slate-400" />
                  </button>
                ))}
              </div>
              <button
                onClick={() => setOptions([])}
                className="mt-4 text-xs text-slate-500 hover:text-slate-700"
              >
                ← Use a different email
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Mail size={18} className="text-blue-600" />
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-slate-900">Enter your work email</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    We&apos;ll find your company and take you to its login page
                  </p>
                </div>
              </div>

              {rememberedSlug && (
                <button
                  onClick={() => proceed(rememberedSlug)}
                  className="w-full flex items-center justify-between px-4 py-3 mb-4 border border-blue-200 bg-blue-50/50 rounded-lg text-left hover:bg-blue-50 transition-colors"
                >
                  <span>
                    <span className="block text-xs text-slate-500">Continue to</span>
                    <span className="block text-sm font-semibold text-blue-700">
                      app / {rememberedSlug}
                    </span>
                  </span>
                  <ArrowRight size={16} className="text-blue-600" />
                </button>
              )}

              <form onSubmit={handleEmailSubmit} className="space-y-4">
                <div>
                  <label className="block text-[12px] font-medium text-slate-600 mb-1.5">
                    Work email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    placeholder="you@yourcompany.com"
                    autoFocus
                    required
                    suppressHydrationWarning
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none bg-white text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                    <AlertCircle size={15} className="mt-0.5 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
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

              {showSlugFallback && (
                <form
                  onSubmit={handleSlugSubmit}
                  className="mt-4 pt-4 border-t border-slate-100 space-y-3"
                >
                  <label className="block text-[12px] font-medium text-slate-600">
                    Company ID (the slug chosen at signup)
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
                      className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-slate-900 placeholder:text-slate-300"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !slug.trim()}
                    className="w-full flex items-center justify-center gap-2 py-2 px-4 border border-blue-200 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-50 disabled:opacity-60 transition-colors"
                  >
                    Continue with company ID
                  </button>
                </form>
              )}
            </>
          )}
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
