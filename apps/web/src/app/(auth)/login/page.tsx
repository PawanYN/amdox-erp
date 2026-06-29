"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, AlertCircle } from "lucide-react";

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
      // Validate the slug exists in our DB first
      const res = await fetch(`http://localhost:3001/tenant/exists/${cleanSlug}`);
      const data = await res.json();

      if (!data.exists) {
        setError(`No company found with domain "${cleanSlug}". Please check the spelling.`);
        return;
      }

      // Build the Keycloak login URL for this tenant's realm
      const kcBase = process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180";
      const clientId = process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "amdox-erp-web";
      const redirectUri = encodeURIComponent(`${window.location.origin}/`);

      const loginUrl = `${kcBase}/realms/${cleanSlug}/protocol/openid-connect/auth?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=openid`;

      // Redirect to the correct realm's login page
      window.location.href = loginUrl;
    } catch (err) {
      setError("Could not reach the server. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-[#FAFAF9] flex items-center justify-center px-4"
      style={{ fontFamily: "'IBM Plex Sans', sans-serif" }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');`}</style>

      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span
            className="text-2xl font-semibold tracking-tight text-[#14171F]"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Amdox<span className="text-[#C99A4B]">ERP</span>
          </span>
          <p className="mt-2 text-sm text-[#8A8678]">Sign in to your company workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E4E2DC] rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-9 w-9 rounded-lg bg-[#1E3A5F]/10 flex items-center justify-center">
              <Building2 size={18} className="text-[#1E3A5F]" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[#14171F]">Enter your company domain</h1>
              <p className="text-xs text-[#8A8678]">You'll be redirected to your company's login page</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4A4740] mb-1.5">
                Company Domain
              </label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#1E3A5F]/30 focus-within:border-[#1E3A5F] transition-all">
                <span className="px-3 py-2.5 text-sm text-[#8A8678] bg-gray-50 border-r border-gray-300 select-none">
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
                  className="flex-1 px-3 py-2.5 text-sm outline-none bg-white text-[#14171F]"
                />
              </div>
              <p className="text-xs text-[#8A8678] mt-1.5">
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
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#1E3A5F] text-white text-sm font-medium rounded-lg hover:bg-[#16304d] disabled:opacity-60 transition-colors"
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
          <p className="text-xs text-[#8A8678]">
            Don't have an account?{" "}
            <a href="/create-tenant" className="text-[#1E3A5F] hover:underline font-medium">
              Create a tenant
            </a>
          </p>
          <a href="/" className="block text-xs text-[#8A8678] hover:text-[#14171F]">
            ← Back to home
          </a>
        </div>
      </div>
    </div>
  );
}