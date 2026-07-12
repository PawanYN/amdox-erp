"use client";

import { useEffect, useState } from "react";
import { Scale, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useKeycloak } from "@/components/KeycloakProvider";
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
    return <p className="text-sm text-slate-500">Loading compliance settings…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Scale size={18} className="text-slate-500" />
          Statutory Compliance
        </h1>
        <p className="page-subtitle mt-1">
          PF, ESI, professional tax, gratuity, and income tax slabs
        </p>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Statutory Rates</h2>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, step }) => (
            <label key={key} className="text-xs font-medium text-slate-600">
              {label}
              <input
                type="number"
                step={step}
                className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
                value={config[key] as number}
                onChange={(e) => setConfig({ ...config, [key]: parseFloat(e.target.value) || 0 })}
              />
            </label>
          ))}
        </div>
        <label className="block text-xs font-medium text-slate-600">
          Notes
          <textarea
            className="mt-1 w-full border border-slate-200 rounded-md px-3 py-2 text-sm"
            rows={2}
            value={config.notes ?? ""}
            onChange={(e) => setConfig({ ...config, notes: e.target.value })}
          />
        </label>
        <Button onClick={saveStatutory} disabled={saving}>
          {saving ? "Saving…" : "Save Statutory Config"}
        </Button>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-card p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Income Tax Slabs</h2>
        <div className="grid grid-cols-4 gap-3">
          {(["name", "minSalary", "maxSalary", "rate"] as const).map((f) => (
            <input
              key={f}
              placeholder={f}
              className="border border-slate-200 rounded-md px-3 py-2 text-sm"
              value={slabForm[f]}
              onChange={(e) => setSlabForm({ ...slabForm, [f]: e.target.value })}
            />
          ))}
        </div>
        <Button icon={<Plus size={14} />} onClick={addSlab}>
          Add Slab
        </Button>
        <ul className="divide-y divide-slate-100">
          {slabs.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2 text-sm">
              <span>
                {s.name}: ₹{s.minSalary}
                {s.maxSalary ? `–${s.maxSalary}` : "+"} @ {(s.rate * 100).toFixed(1)}%
              </span>
              <button
                type="button"
                className="text-red-500 hover:text-red-700"
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
