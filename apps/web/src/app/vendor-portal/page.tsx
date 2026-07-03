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

type PurchaseOrder = {
  id: string;
  poNumber: string;
  status: string;
  totalAmount: string | number;
  orderedAt?: string;
  vendorAcknowledgedAt?: string | null;
  vendorExpectedDeliveryAt?: string | null;
  vendorShipmentNotes?: string | null;
  lines?: { quantity: string | number; unitPrice: string | number; product?: { name: string; sku: string } }[];
};

export default function VendorPortalPage() {
  const [session, setSession] = useState<VendorPortalSession | null>(null);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginForm, setLoginForm] = useState({ tenantSlug: "", email: "", accessKey: "" });
  const [ackForm, setAckForm] = useState<Record<string, { expectedDeliveryAt: string; notes: string }>>({});

  useEffect(() => {
    const saved = getVendorPortalSession();
    if (saved) setSession(saved);
  }, []);

  useEffect(() => {
    if (!session) return;
    setLoading(true);
    vendorPortalApi
      .getPurchaseOrders(session)
      .then(setOrders)
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
      <div className="min-h-screen bg-[#F7F5F0] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl border border-[#E8E4DA] shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#2F6B4F]/10 flex items-center justify-center">
              <KeyRound className="text-[#2F6B4F]" size={20} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-[#1A1A18]">Supplier Portal</h1>
              <p className="text-sm text-[#8A8678]">View and acknowledge purchase orders</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#8A8678]">Tenant slug</label>
              <input
                className="mt-1 w-full rounded-lg border border-[#E8E4DA] px-3 py-2 text-sm"
                value={loginForm.tenantSlug}
                onChange={(e) => setLoginForm({ ...loginForm, tenantSlug: e.target.value })}
                placeholder="acme-corp"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8A8678]">Supplier email</label>
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-[#E8E4DA] px-3 py-2 text-sm"
                value={loginForm.email}
                onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#8A8678]">Portal access key</label>
              <input
                type="password"
                className="mt-1 w-full rounded-lg border border-[#E8E4DA] px-3 py-2 text-sm font-mono"
                value={loginForm.accessKey}
                onChange={(e) => setLoginForm({ ...loginForm, accessKey: e.target.value })}
                placeholder="vp_..."
                required
              />
            </div>
            {error && <p className="text-sm text-[#B4533B]">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#2F6B4F] text-white py-2.5 text-sm font-medium hover:bg-[#265a42] disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in to portal"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F0] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-[#1A1A18]">Supplier Portal</h1>
            <p className="text-sm text-[#8A8678]">
              {session.vendorName} · {session.tenantName}
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-[#8A8678] hover:text-[#1A1A18]"
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>

        {error && <p className="mb-4 text-sm text-[#B4533B]">{error}</p>}

        {loading && orders.length === 0 ? (
          <div className="flex items-center gap-2 text-[#8A8678]">
            <Loader2 className="animate-spin" size={18} /> Loading orders...
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-2xl border border-[#E8E4DA] p-10 text-center text-[#8A8678]">
            <Package className="mx-auto mb-3 opacity-40" size={32} />
            No purchase orders sent to you yet.
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((po) => (
              <div key={po.id} className="bg-white rounded-2xl border border-[#E8E4DA] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-[#1A1A18]">{po.poNumber}</h2>
                    <p className="text-sm text-[#8A8678]">
                      {po.orderedAt ? new Date(po.orderedAt).toLocaleDateString() : "—"} · ₹
                      {Number(po.totalAmount).toLocaleString()}
                    </p>
                    <p className="text-xs text-[#8A8678] mt-1 capitalize">{po.status.toLowerCase().replace("_", " ")}</p>
                  </div>
                  {po.vendorAcknowledgedAt ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-[#2F6B4F] bg-[#2F6B4F]/10 px-2 py-1 rounded-full">
                      <CheckCircle2 size={14} /> Acknowledged
                    </span>
                  ) : po.status === "APPROVED" ? (
                    <span className="text-xs font-medium text-[#D9A85C] bg-[#D9A85C]/10 px-2 py-1 rounded-full">
                      Awaiting acknowledgement
                    </span>
                  ) : null}
                </div>

                <ul className="mt-4 space-y-1 text-sm text-[#4A4840]">
                  {po.lines?.map((line, i) => (
                    <li key={i}>
                      {line.product?.sku} — {line.product?.name}: {Number(line.quantity)} × ₹
                      {Number(line.unitPrice).toLocaleString()}
                    </li>
                  ))}
                </ul>

                {po.vendorAcknowledgedAt ? (
                  <p className="mt-3 text-xs text-[#8A8678]">
                    Acknowledged {new Date(po.vendorAcknowledgedAt).toLocaleString()}
                    {po.vendorExpectedDeliveryAt &&
                      ` · ETA ${new Date(po.vendorExpectedDeliveryAt).toLocaleDateString()}`}
                    {po.vendorShipmentNotes && ` · ${po.vendorShipmentNotes}`}
                  </p>
                ) : po.status === "APPROVED" ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <input
                      type="date"
                      className="rounded-lg border border-[#E8E4DA] px-3 py-2 text-sm"
                      value={ackForm[po.id]?.expectedDeliveryAt || ""}
                      onChange={(e) =>
                        setAckForm({
                          ...ackForm,
                          [po.id]: { ...ackForm[po.id], expectedDeliveryAt: e.target.value, notes: ackForm[po.id]?.notes || "" },
                        })
                      }
                    />
                    <input
                      className="rounded-lg border border-[#E8E4DA] px-3 py-2 text-sm"
                      placeholder="Shipment notes (optional)"
                      value={ackForm[po.id]?.notes || ""}
                      onChange={(e) =>
                        setAckForm({
                          ...ackForm,
                          [po.id]: { expectedDeliveryAt: ackForm[po.id]?.expectedDeliveryAt || "", notes: e.target.value },
                        })
                      }
                    />
                    <button
                      onClick={() => handleAcknowledge(po.id)}
                      disabled={loading}
                      className="sm:col-span-2 rounded-lg bg-[#2F6B4F] text-white py-2 text-sm font-medium hover:bg-[#265a42] disabled:opacity-60"
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
