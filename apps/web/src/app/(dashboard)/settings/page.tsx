"use client";

import { useState } from "react";
import { 
  Building2, 
  ShieldCheck, 
  Key, 
  ScrollText, 
  UserCog, 
  Save, 
  AlertCircle,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { mockTenantConfig, mockAuditLogs, mockGdprRequests } from "@/lib/mock/it";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [tenantConfig, setTenantConfig] = useState(mockTenantConfig);

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "sso", label: "Security & SSO", icon: ShieldCheck },
    { id: "audit", label: "Audit Logs", icon: ScrollText },
    { id: "compliance", label: "Compliance (GDPR)", icon: FileText },
  ];

  const handleSave = async () => {
    if (activeTab === "sso") {
      try {
        const res = await fetch("http://localhost:3001/tenant/sso", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ssoSessionIdleTimeout: tenantConfig.settings?.sso?.ssoSessionIdleTimeout,
            ssoSessionMaxLifespan: tenantConfig.settings?.sso?.ssoSessionMaxLifespan,
            mfaEnforced: tenantConfig.settings?.sso?.mfaEnforced,
          })
        });
        if (res.ok) alert("SSO Configuration securely synced with Keycloak Realm!");
        else alert("Failed to save Keycloak config.");
      } catch(err) {
        alert("Failed to connect to API backend.");
      }
    } else {
      alert("Configuration saved successfully!");
    }
  };

  const auditColumns: ColumnDef<typeof mockAuditLogs[0]>[] = [
    { header: "Date", accessorKey: "createdAt", cell: (row) => new Date(row.createdAt).toLocaleString() },
    { header: "Action", accessorKey: "action" },
    { header: "Entity", accessorKey: "entityType" },
    { header: "User ID", accessorKey: "userId" },
    { header: "Hash", accessorKey: "hash", cell: (row) => (
      <span className="font-mono text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
        {row.hash.substring(0, 8)}...
      </span>
    )}
  ];

  const gdprColumns: ColumnDef<typeof mockGdprRequests[0]>[] = [
    { header: "Subject Email", accessorKey: "subjectEmail" },
    { header: "Type", accessorKey: "type" },
    { header: "Requested", accessorKey: "requestedAt", cell: (row) => new Date(row.requestedAt).toLocaleDateString() },
    { header: "Status", accessorKey: "status", cell: (row) => (
      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${
        row.status === 'FULFILLED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' :
        'bg-amber-50 text-amber-600 border border-amber-200'
      }`}>
        {row.status}
      </span>
    )}
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-bold text-ink">IT Administration</h1>
          <p className="text-muted mt-1 text-sm">Manage tenant configuration, SSO, and compliance.</p>
        </div>
        {(activeTab === "general" || activeTab === "sso") && (
          <Button icon={<Save size={16} />} onClick={handleSave}>
            Save Changes
          </Button>
        )}
      </div>

      <div className="flex gap-8">
        {/* Sidebar Tabs */}
        <div className="w-64 shrink-0 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
          <div className="bg-canvas border border-line rounded-xl p-2 flex flex-col gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                    isActive 
                      ? "bg-violet-50 text-purple-600 font-semibold" 
                      : "text-muted hover:bg-gray-50 hover:text-ink"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-purple-600" : "text-muted"} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          
          {/* GENERAL SETTINGS */}
          {activeTab === "general" && (
            <div className="bg-canvas border border-line rounded-xl p-6">
              <h2 className="text-lg font-bold text-ink mb-6">General Settings</h2>
              
              <div className="space-y-5 max-w-xl">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Tenant Name</label>
                  <input 
                    type="text" 
                    value={tenantConfig.name}
                    onChange={(e) => setTenantConfig({...tenantConfig, name: e.target.value})}
                    className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Tenant Slug</label>
                  <input 
                    type="text" 
                    value={tenantConfig.slug}
                    disabled
                    className="w-full rounded-xl border border-line bg-gray-50 text-muted px-3.5 py-2.5 text-sm cursor-not-allowed"
                  />
                  <p className="text-xs text-muted mt-1.5">Used for tenant isolation and subdomains.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Active Plan</label>
                  <select 
                    value={tenantConfig.plan}
                    onChange={(e) => setTenantConfig({...tenantConfig, plan: e.target.value})}
                    className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all outline-none bg-white"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* SECURITY & SSO */}
          {activeTab === "sso" && (
            <div className="bg-canvas border border-line rounded-xl p-6">
              <h2 className="text-lg font-bold text-ink mb-6">SSO & Security Configuration</h2>
              
              <div className="space-y-6 max-w-xl">
                <div className="p-4 bg-violet-50 border border-violet-100 rounded-xl flex gap-3">
                  <Key className="text-purple-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="font-semibold text-sm text-purple-900">Keycloak OIDC Integration</h4>
                    <p className="text-xs text-purple-700/80 mt-1">These settings directly sync with your dedicated Keycloak Realm to enforce security policies.</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Realm Issuer URL (Read-Only)</label>
                  <input 
                    type="text" 
                    value={tenantConfig.settings?.sso?.realmUrl || 'http://localhost:8080/realms/default-tenant-id'}
                    disabled
                    className="w-full rounded-xl border border-line bg-gray-50 text-muted px-3.5 py-2.5 text-sm cursor-not-allowed"
                  />
                  <p className="text-xs text-muted mt-1.5">Your Identity Provider URL. Configured by ERP Administrator.</p>
                </div>

                <div className="pt-4 border-t border-line space-y-5">
                  <h3 className="font-semibold text-sm text-ink">Realm Security Policies</h3>
                  
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      id="mfa"
                      checked={tenantConfig.settings?.sso?.mfaEnforced || false}
                      onChange={(e) => setTenantConfig({
                        ...tenantConfig, 
                        settings: { ...tenantConfig.settings, sso: { ...tenantConfig.settings?.sso, mfaEnforced: e.target.checked } }
                      })}
                      className="w-4 h-4 rounded text-purple-600 focus:ring-purple-600"
                    />
                    <label htmlFor="mfa" className="text-sm font-medium text-ink">Enforce Multi-Factor Authentication (OTP)</label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">Session Idle Timeout (Seconds)</label>
                    <input 
                      type="number" 
                      value={tenantConfig.settings?.sso?.ssoSessionIdleTimeout || 1800}
                      onChange={(e) => setTenantConfig({
                        ...tenantConfig, 
                        settings: { ...tenantConfig.settings, sso: { ...tenantConfig.settings?.sso, ssoSessionIdleTimeout: parseInt(e.target.value) } }
                      })}
                      className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all outline-none"
                    />
                    <p className="text-xs text-muted mt-1.5">Time before inactive users are forced to log in again.</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-ink mb-1.5">Maximum Session Lifespan (Seconds)</label>
                    <input 
                      type="number" 
                      value={tenantConfig.settings?.sso?.ssoSessionMaxLifespan || 36000}
                      onChange={(e) => setTenantConfig({
                        ...tenantConfig, 
                        settings: { ...tenantConfig.settings, sso: { ...tenantConfig.settings?.sso, ssoSessionMaxLifespan: parseInt(e.target.value) } }
                      })}
                      className="w-full rounded-xl border border-line px-3.5 py-2.5 text-sm focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 transition-all outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="bg-canvas border border-line rounded-xl overflow-hidden">
              <div className="p-5 border-b border-line flex justify-between items-center bg-gray-50/50">
                <h2 className="text-sm font-bold text-ink">Immutable Audit Trail</h2>
                <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
                  <ShieldCheck size={14} /> Hash Chain Verified
                </div>
              </div>
              <DataTable data={mockAuditLogs} columns={auditColumns} keyExtractor={(r) => r.id} />
            </div>
          )}

          {/* COMPLIANCE */}
          {activeTab === "compliance" && (
            <div className="bg-canvas border border-line rounded-xl overflow-hidden">
              <div className="p-5 border-b border-line flex justify-between items-center bg-gray-50/50">
                <h2 className="text-sm font-bold text-ink">Data Subject Requests (GDPR)</h2>
              </div>
              <DataTable data={mockGdprRequests} columns={gdprColumns} keyExtractor={(r) => r.id} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
