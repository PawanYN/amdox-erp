"use client";

import { useEffect, useState } from "react";
import { Package, LogOut, CheckCircle2, Loader2, KeyRound } from "lucide-react";
import {
  vendorPortalApi,
  getVendorPortalSession,
  setVendorPortalSession,
  clearVendorPortalSession,
  type VendorPortalSession,
} from "@/lib/api/vendor-portal-api";

type VendorProfile = {
  id: string;
  name: string;
  email: string;
  portalKeyIssuedAt: string | null;
};

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: string | number;
  orderedAt?: string;
  vendorAcknowledgedAt?: string | null;
  vendorExpectedDeliveryAt?: string | null;
  vendorShipmentNotes?: string | null;
  lines?: {
    quantity: string | number;
    unitPrice: string | number;
    product?: { name: string; sku: string };
  }[];
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all";

export default function VendorPortalPage() {
  const [session, setSession] = useState<VendorPortalSession | null>(null);
  const [profile, setProfile] = useState<VendorProfile | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ tenantSlug: "", email: "", accessKey: "" });
  const [ackForm, setAckForm] = useState<
    Record<string, { expectedDeliveryAt: string; notes: string }>
  >({});

  useEffect(() => {
    const saved = getVendorPortalSession();
    if (saved) setSession(saved);
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    Promise.all([vendorPortalApi.getPurchaseOrders(session), vendorPortalApi.getProfile(session)])
      .then(([ordersData, profileData]) => {
        setOrders(ordersData);
        setProfile(profileData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [session]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await vendorPortalApi.login(
        loginForm.tenantSlug,
        loginForm.email,
        loginForm.accessKey,
      );
      setVendorPortalSession(result);
      setSession(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearVendorPortalSession();
    setSession(null);
    setProfile(null);
    setOrders([]);
  };

  const handleAcknowledge = async (poId: string) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const form = ackForm[poId] || { expectedDeliveryAt: "", notes: "" };
      await vendorPortalApi.acknowledgePurchaseOrder(session, poId, {
        expectedDeliveryAt: form.expectedDeliveryAt || undefined,
        notes: form.notes || undefined,
      });
      const refreshed = await vendorPortalApi.getPurchaseOrders(session);
      setOrders(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acknowledgement failed");
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-card p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <KeyRound className="text-blue-600" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900">Supplier Portal</h1>
              <p className="text-sm text-slate-500">View and acknowledge purchase orders</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[12px] font-medium text-slate-600 block">Tenant slug</label>
              <input
                className={inputClass}
                value={loginForm.tenantSlug}
                onChange={(e) => setLoginForm({ ...loginForm, tenantSlug: e.target.value })}
                placeholder="acme-corp"
                required
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block">Supplier email</label>
              <input
                type="email"
                className={inputClass}
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 block">
                Portal access key
              </label>
              <input
                type="password"
                className={inputClass + " font-mono"}
                value={loginForm.accessKey}
                onChange={(e) => setLoginForm({ ...loginForm, accessKey: e.target.value })}
                placeholder="vp_..."
                required
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 text-white py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in to portal"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Supplier Portal</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {profile?.name ?? session.vendorName} · {session.tenantName}
            </p>
            {profile && (
              <p className="text-xs text-slate-500 mt-1">
                <a
                  href={`mailto:${profile.email}`}
                  className="hover:text-slate-700 transition-colors"
                >
                  {profile.email}
                </a>
                {profile.portalKeyIssuedAt && (
                  <>
                    {" "}
                    · Portal key issued {new Date(profile.portalKeyIssuedAt).toLocaleDateString()}
                  </>
                )}
              </p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <LogOut size={15} /> Sign out
          </button>
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {loading && orders.length === 0 ? (
          <div className="flex items-center gap-2 text-slate-500">
            <Loader2 className="animate-spin" size={18} /> Loading orders…
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-card p-10 text-center text-slate-500">
            <Package className="mx-auto mb-3 opacity-30" size={32} />
            No purchase orders sent to you yet.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((po) => (
              <div
                key={po.id}
                className="bg-white rounded-xl border border-slate-200 shadow-card p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-900">{po.poNumber}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {po.orderedAt ? new Date(po.orderedAt).toLocaleDateString() : "—"} · ₹
                      {Number(po.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 capitalize">
                      {po.status.toLowerCase().replace("_", " ")}
                    </p>
                  </div>
                  {po.vendorAcknowledgedAt ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full">
                      <CheckCircle2 size={13} /> Acknowledged
                    </span>
                  ) : po.status === "APPROVED" ? (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
                      Awaiting acknowledgement
                    </span>
                  ) : null}
                </div>

                <ul className="mt-4 space-y-1 text-sm text-slate-600">
                  {po.lines?.map((line, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-slate-500">
                        {line.product?.sku}
                      </span>
                      <span>{line.product?.name}:</span>
                      <span className="font-medium">
                        {Number(line.quantity)} × ₹{Number(line.unitPrice).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>

                {po.vendorAcknowledgedAt ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Acknowledged {new Date(po.vendorAcknowledgedAt).toLocaleString()}
                    {po.vendorExpectedDeliveryAt &&
                      ` · ETA ${new Date(po.vendorExpectedDeliveryAt).toLocaleDateString()}`}
                    {po.vendorShipmentNotes && ` · ${po.vendorShipmentNotes}`}
                  </p>
                ) : po.status === "APPROVED" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      value={ackForm[po.id]?.expectedDeliveryAt || ""}
                      onChange={(e) =>
                        setAckForm({
                          ...ackForm,
                          [po.id]: {
                            ...ackForm[po.id],
                            expectedDeliveryAt: e.target.value,
                            notes: ackForm[po.id]?.notes || "",
                          },
                        })
                      }
                    />
                    <input
                      className="rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      placeholder="Shipment notes (optional)"
                      value={ackForm[po.id]?.notes || ""}
                      onChange={(e) =>
                        setAckForm({
                          ...ackForm,
                          [po.id]: {
                            expectedDeliveryAt: ackForm[po.id]?.expectedDeliveryAt || "",
                            notes: e.target.value,
                          },
                        })
                      }
                    />
                    <button
                      onClick={() => handleAcknowledge(po.id)}
                      disabled={loading}
                      className="sm:col-span-2 rounded-lg bg-blue-600 text-white py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
                    >
                      Acknowledge purchase order
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
