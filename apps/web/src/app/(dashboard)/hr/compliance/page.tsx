"use client";

import { useEffect, useState } from "react";
import { Scale, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeycloak } from "@/components/layout/keycloak-provider";
import { hrApi } from "@/lib/api/hr-api";

type StatutoryConfig = {
  pfEmployeeRate: number;
  pfEmployerRate: number;
  esiEmployeeRate: number;
  esiEmployerRate: number;
  professionalTaxMonthly: number;
  gratuityRate: number;
  labourWelfareFund: number;
  notes?: string;
};

type TaxSlab = {
  id: string;
  name: string;
  minSalary: number;
  maxSalary?: number | null;
  rate: number;
};

const FIELDS: { key: keyof StatutoryConfig; label: string; step?: string }[] = [
  { key: "pfEmployeeRate", label: "PF — Employee Rate", step: "0.01" },
  { key: "pfEmployerRate", label: "PF — Employer Rate", step: "0.01" },
  { key: "esiEmployeeRate", label: "ESI — Employee Rate", step: "0.0001" },
  { key: "esiEmployerRate", label: "ESI — Employer Rate", step: "0.0001" },
  { key: "professionalTaxMonthly", label: "Professional Tax (₹/month)", step: "1" },
  { key: "gratuityRate", label: "Gratuity Rate", step: "0.0001" },
  { key: "labourWelfareFund", label: "Labour Welfare Fund (₹)", step: "1" },
];

export default function CompliancePage() {
  const { token } = useKeycloak();
  const [config, setConfig] = useState<StatutoryConfig | null>(null);
  const [slabs, setSlabs] = useState<TaxSlab[]>([]);
  const [saving, setSaving] = useState(false);
  const [slabForm, setSlabForm] = useState({ name: "", minSalary: "", maxSalary: "", rate: "" });

  const load = async () => {
    const [statutory, taxSlabs] = await Promise.all([
      hrApi.getStatutoryCompliance(),
      hrApi.getTaxSlabs(),
    ]);
    setConfig(statutory);
    setSlabs(taxSlabs);
  };

  useEffect(() => {
    if (!token) return;
    load().catch(console.error);
  }, [token]);

  const saveStatutory = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await hrApi.updateStatutoryCompliance(config);
    } finally {
      setSaving(false);
    }
  };

  const addSlab = async () => {
    await hrApi.createTaxSlab({
      name: slabForm.name,
      minSalary: Number(slabForm.minSalary),
      maxSalary: slabForm.maxSalary ? Number(slabForm.maxSalary) : undefined,
      rate: Number(slabForm.rate),
    });
    setSlabForm({ name: "", minSalary: "", maxSalary: "", rate: "" });
    setSlabs(await hrApi.getTaxSlabs());
  };

  if (!config) {
    return <p className="text-sm" style={{color: '#6b7280'}}>Loading compliance settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Scale size={18} style={{color: '#6b7280'}} />
          Statutory Compliance
        </h1>
        <p className="page-subtitle mt-1" style={{color: '#6b7280'}}>
          PF, ESI, professional tax, gratuity, and income tax slabs
        </p>
      </div>

      <div style={{background: '#ffffff', border: '1px solid #dfe3e8'}} className="rounded-lg shadow-card p-6 space-y-4">
        <h2 style={{color: '#2b2f36'}} className="text-sm font-semibold">Statutory Rates</h2>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, step }) => (
            <label key={key} style={{color: '#2b2f36'}} className="text-xs font-medium">
              {label}
              <input
                type="number"
                step={step}
                className="mt-1 w-full rounded-md px-3 py-2 text-sm"
                style={{borderColor: '#dfe3e8', border: '1px solid', color: '#2b2f36'}}
                value={config[key] as number}
                onChange={(e) => setConfig({ ...config, [key]: parseFloat(e.target.value) || 0 })}
              />
            </label>
          ))}
        </div>
        <label style={{color: '#2b2f36'}} className="block text-xs font-medium">
          Notes
          <textarea
            className="mt-1 w-full rounded-md px-3 py-2 text-sm"
            style={{borderColor: '#dfe3e8', border: '1px solid', color: '#2b2f36'}}
            rows={2}
            value={config.notes ?? ""}
            onChange={(e) => setConfig({ ...config, notes: e.target.value })}
          />
        </label>
        <Button onClick={saveStatutory} disabled={saving} style={{background: '#1f5fa8', borderColor: '#1f5fa8', color: '#fff'}}>
          {saving ? "Saving…" : "Save Statutory Config"}
        </Button>
      </div>

      <div style={{background: '#ffffff', border: '1px solid #dfe3e8'}} className="rounded-lg shadow-card p-6 space-y-4">
        <h2 style={{color: '#2b2f36'}} className="text-sm font-semibold">Income Tax Slabs</h2>
        <div className="grid grid-cols-4 gap-3">
          {(["name", "minSalary", "maxSalary", "rate"] as const).map((f) => (
            <input
              key={f}
              placeholder={f}
              className="rounded-md px-3 py-2 text-sm"
              style={{borderColor: '#dfe3e8', border: '1px solid', color: '#2b2f36'}}
              value={slabForm[f]}
              onChange={(e) => setSlabForm({ ...slabForm, [f]: e.target.value })}
            />
          ))}
        </div>
        <Button icon={<Plus size={14} />} onClick={addSlab} style={{background: '#1f5fa8', borderColor: '#1f5fa8', color: '#fff'}}>
          Add Slab
        </Button>
        <ul style={{borderColor: '#f3f4f6'}} className="divide-y">
          {slabs.map((s) => (
            <li key={s.id} style={{color: '#2b2f36'}} className="flex items-center justify-between py-2 text-sm">
              <span>
                {s.name}: ₹{s.minSalary}
                {s.maxSalary ? `–${s.maxSalary}` : "+"} @ {(s.rate * 100).toFixed(1)}%
              </span>
              <button
                type="button"
                style={{color: '#dc2626'}}
                className="hover:text-red-700"
                onClick={async () => {
                  await hrApi.deleteTaxSlab(s.id);
                  setSlabs(await hrApi.getTaxSlabs());
                }}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
