"use client";

import { useState, useEffect } from "react";
import { 
  Building2, 
  ShieldCheck, 
  Key, 
  ScrollText, 
  Save, 
  AlertCircle,
  FileText,
  Mail,
  Clock,
  UserCheck,
  Share2,
  Trash2,
  Plus,
  Settings2,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  HelpCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { auditApi } from "@/lib/api/audit-api";
import { tenantApi } from "@/lib/api/tenant-api";
import { useKeycloak } from "@/components/KeycloakProvider";
import keycloak from "@/lib/keycloak";

function AdminRequired() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
      <div className="h-12 w-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <ShieldAlert size={22} className="text-amber-500" />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-800">Administrator Access Required</p>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          This section is restricted to <span className="font-medium">SuperAdmin</span> and{" "}
          <span className="font-medium">TenantAdmin</span> roles. Contact your system administrator
          to request access.
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const { token, initialized } = useKeycloak();
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState("general");
  const [activeSubTab, setActiveSubTab] = useState("login"); // For Keycloak settings
  const [tenantConfig, setTenantConfig] = useState<{ name?: string; slug?: string; plan?: string }>({});
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [gdprRequests, setGdprRequests] = useState<any[]>([]);

  // Keycloak configs
  const [kcConfig, setKcConfig] = useState<any>({
    login: {
      registrationAllowed: false,
      resetPasswordAllowed: false,
      rememberMe: false,
      registrationEmailAsUsername: false,
      loginWithEmailAllowed: true,
      duplicateEmailsAllowed: false,
      verifyEmail: false,
      editUsernameAllowed: false,
    },
    smtpServer: {},
    sessions: {
      ssoSessionIdleTimeout: 1800,
      ssoSessionMaxLifespan: 36000,
      ssoSessionIdleTimeoutRememberMe: 0,
      ssoSessionMaxLifespanRememberMe: 0,
      clientSessionIdleTimeout: 0,
      clientSessionMaxLifespan: 0,
      offlineSessionIdleTimeout: 2592000,
      offlineSessionMaxLifespanEnabled: false,
      accessCodeLifespanUserAction: 300,
      accessCodeLifespan: 1800,
    },
    tokens: {
      defaultSignatureAlgorithm: 'RS256',
      oauth2DeviceCodeLifespan: 600,
      oauth2DevicePollingInterval: 5,
      revokeRefreshToken: false,
      accessTokenLifespan: 300,
      accessTokenLifespanForImplicitFlow: 900,
      clientLoginTimeout: 60,
      actionTokenGeneratedByUserLifespan: 300,
      actionTokenGeneratedByAdminLifespan: 43200,
    }
  });

  const [requiredActions, setRequiredActions] = useState<any[]>([]);
  const [authFlows, setAuthFlows] = useState<any[]>([]);
  const [identityProviders, setIdentityProviders] = useState<any[]>([]);
  const [newIdp, setNewIdp] = useState({ alias: "", providerId: "", displayName: "", enabled: true });

  const tabs = [
    { id: "general", label: "General", icon: Building2 },
    { id: "keycloak", label: "Identity Settings", icon: Settings2 },
    { id: "auth", label: "Authentication", icon: ShieldCheck },
    { id: "idp", label: "Identity Providers", icon: Share2 },
    { id: "audit", label: "Audit Logs", icon: ScrollText },
    { id: "compliance", label: "Compliance (GDPR)", icon: FileText },
  ];

  useEffect(() => {
    if (activeTab === "audit") {
      auditApi.getLogs().then(setAuditLogs).catch(console.error);
    }
    if (activeTab === "compliance") {
      auditApi.getGdprRequests().then(setGdprRequests).catch(console.error);
    }
  }, [activeTab]);

  const fetchAllData = async (adminUser: boolean) => {
    if (!token) return;
    setLoading(true);

    // General tenant config — available to all authenticated users
    try {
      const tenantData = await tenantApi.getConfig();
      if (!tenantData.error) setTenantConfig(tenantData);
    } catch {
      // Non-fatal: tenant config may require admin; leave defaults
    }

    // Admin-only Keycloak data — only fetch when user has the right role
    if (adminUser) {
      try {
        const configData = await tenantApi.getKeycloakConfig();
        if (!configData.error) setKcConfig(configData);
      } catch {
        // Individual failure — silently ignore, defaults already set
      }
      try {
        setRequiredActions(await tenantApi.getRequiredActions());
      } catch { /* ignore */ }
      try {
        setIdentityProviders(await tenantApi.getIdentityProviders());
      } catch { /* ignore */ }
      try {
        setAuthFlows(await tenantApi.getAuthenticationFlows());
      } catch { /* ignore */ }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!initialized) return;
    // Compute admin status from Keycloak token claims.
    // Realm roles may contain spaces (e.g. "Tenant Admin") — normalize to match
    // the same convention the backend RolesGuard uses (.replace(/\s+/g, '')).
    const realmRoles: string[] =
      (keycloak?.tokenParsed?.realm_access?.roles as string[]) ?? [];
    const normalizedRoles = realmRoles.map((r) => r.replace(/\s+/g, ""));
    const admin =
      normalizedRoles.includes("SuperAdmin") ||
      normalizedRoles.includes("TenantAdmin");
    setIsAdmin(admin);
    if (token) {
      fetchAllData(admin);
    }
  }, [initialized, token]);

  const handleSaveConfig = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.updateKeycloakConfig(kcConfig);
      setSuccessMsg("Keycloak configuration securely updated and synced!");
    } catch (err) {
      setErrorMsg("Connection failure while updating settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequiredAction = async (action: any, enabled: boolean) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.updateRequiredAction(action.alias, { ...action, enabled });
      setSuccessMsg(`Required action '${action.name}' updated!`);
      setRequiredActions(await tenantApi.getRequiredActions());
    } catch (err) {
      setErrorMsg("Connection failure while updating action.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIdp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIdp.alias || !newIdp.providerId) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.createIdentityProvider(newIdp);
      setSuccessMsg(`Identity provider '${newIdp.alias}' added!`);
      setNewIdp({ alias: "", providerId: "", displayName: "", enabled: true });
      setIdentityProviders(await tenantApi.getIdentityProviders());
    } catch (err) {
      setErrorMsg("Connection failure while adding identity provider.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteIdp = async (alias: string) => {
    if (!confirm(`Are you sure you want to remove ${alias}?`)) return;
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.deleteIdentityProvider(alias);
      setSuccessMsg(`Identity provider '${alias}' deleted!`);
      setIdentityProviders(await tenantApi.getIdentityProviders());
    } catch (err) {
      setErrorMsg("Connection failure while removing identity provider.");
    } finally {
      setLoading(false);
    }
  };

  const auditColumns: ColumnDef<any>[] = [
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

  const gdprColumns: ColumnDef<any>[] = [
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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title block */}
      <div className="flex items-start justify-between pb-5 border-b border-slate-200">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings2 size={18} className="text-slate-400" />
            Settings
          </h1>
          <p className="page-subtitle mt-1">Tenant policies, Keycloak identity, and compliance configuration</p>
        </div>
        {activeTab === "keycloak" && isAdmin && (
          <Button onClick={handleSaveConfig} disabled={loading} icon={<Save size={14} />}>
            Save Keycloak Config
          </Button>
        )}
      </div>

      {/* Success/Error Alerts */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs">
          <CheckCircle2 size={16} className="text-emerald-600" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs">
          <AlertCircle size={16} className="text-red-600" />
          {errorMsg}
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-6">
        {/* Navigation Sidebar */}
        <div className="w-full md:w-56 shrink-0">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-1.5 flex flex-col gap-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSuccessMsg(null);
                    setErrorMsg(null);
                  }}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white border border-slate-200 rounded-lg p-6 shadow-card min-h-[500px]">

          {/* GENERAL SETTINGS */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">General Settings</h2>
              <div className="grid grid-cols-1 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Company Workspace Name</label>
                  <input 
                    type="text" 
                    value={tenantConfig.name || ""}
                    onChange={(e) => setTenantConfig({ ...tenantConfig, name: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Company Domain / Slug</label>
                  <input 
                    type="text" 
                    value={tenantConfig.slug || ""}
                    disabled
                    className="w-full rounded-md border border-gray-200 bg-gray-50 text-gray-400 px-3 py-2 text-xs cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Immutable slug used for the workspace routing and realm separation.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ERP Active Plan</label>
                  <input 
                    type="text" 
                    value={tenantConfig.plan || "STANDARD"}
                    disabled
                    className="w-full rounded-md border border-gray-200 bg-gray-50 text-gray-400 px-3 py-2 text-xs cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          )}

          {/* KEYCLOAK SETTINGS SUBTAB INTERFACE */}
          {activeTab === "keycloak" && !isAdmin && (
            <AdminRequired />
          )}
          {activeTab === "keycloak" && isAdmin && (
            <div className="space-y-6">
              {/* Internal tabs */}
              <div className="flex border-b border-gray-200 gap-1 pb-px overflow-x-auto">
                {[
                  { id: "login", label: "Login Settings", icon: UserCheck },
                  { id: "smtp", label: "Email Server (SMTP)", icon: Mail },
                  { id: "sessions", label: "SSO Sessions", icon: Clock },
                  { id: "tokens", label: "Token Lifespans", icon: Sliders },
                ].map(sub => {
                  const Icon = sub.icon;
                  const isActive = activeSubTab === sub.id;
                  return (
                    <button
                      key={sub.id}
                      onClick={() => setActiveSubTab(sub.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-all ${
                        isActive
                          ? "border-blue-600 text-blue-700"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Icon size={13} />
                      {sub.label}
                    </button>
                  );
                })}
              </div>

              {/* Subtab 1: Login Settings */}
              {activeSubTab === "login" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Login & Info Customization</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Registration */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">User registration</h4>
                        <p className="text-[10px] text-gray-500">Allow users to register their own accounts.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.registrationAllowed}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, registrationAllowed: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Forgot password */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Forgot password</h4>
                        <p className="text-[10px] text-gray-500">Enable self-service reset links.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.resetPasswordAllowed}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, resetPasswordAllowed: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Remember me</h4>
                        <p className="text-[10px] text-gray-500">Stay logged in between browser sessions.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.rememberMe}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, rememberMe: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Edit username */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Edit username</h4>
                        <p className="text-[10px] text-gray-500">Allow users to modify their active logins.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.editUsernameAllowed}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, editUsernameAllowed: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">Email Logins</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Login with email */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Login with email</h4>
                        <p className="text-[10px] text-gray-500">Allow logins via email address instead of username.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.loginWithEmailAllowed}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, loginWithEmailAllowed: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Email as username */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Email as username</h4>
                        <p className="text-[10px] text-gray-500">Forces usernames to match full email addresses.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.registrationEmailAsUsername}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, registrationEmailAsUsername: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Duplicate emails */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Duplicate emails</h4>
                        <p className="text-[10px] text-gray-500">Allows multiple users to share the same email.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.duplicateEmailsAllowed}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, duplicateEmailsAllowed: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Verify email */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Verify email</h4>
                        <p className="text-[10px] text-gray-500">Require activation link click before login.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.login?.verifyEmail}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          login: { ...kcConfig.login, verifyEmail: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: SMTP Template settings */}
              {activeSubTab === "smtp" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">Mail server details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">From *</label>
                      <input 
                        type="email" 
                        placeholder="sender@company-b.com"
                        value={kcConfig.smtpServer?.from || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, from: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">From display name</label>
                      <input 
                        type="text" 
                        placeholder="Amdox Identity Team"
                        value={kcConfig.smtpServer?.fromDisplayName || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, fromDisplayName: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Reply to</label>
                      <input 
                        type="email" 
                        placeholder="support@company-b.com"
                        value={kcConfig.smtpServer?.replyTo || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, replyTo: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Reply to display name</label>
                      <input 
                        type="text" 
                        value={kcConfig.smtpServer?.replyToDisplayName || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, replyToDisplayName: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Envelope from</label>
                      <input 
                        type="email" 
                        value={kcConfig.smtpServer?.envelopeFrom || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, envelopeFrom: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">Connection & Encryption</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Host *</label>
                      <input 
                        type="text" 
                        placeholder="smtp.company.com"
                        value={kcConfig.smtpServer?.host || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, host: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Port</label>
                      <input 
                        type="text" 
                        placeholder="25"
                        value={kcConfig.smtpServer?.port || ""}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, port: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-6 items-center p-3">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="checkbox"
                          checked={kcConfig.smtpServer?.ssl === "true"}
                          onChange={(e) => setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, ssl: e.target.checked ? "true" : "false" }
                          })}
                          className="w-4 h-4 text-blue-700"
                        />
                        <label className="text-xs font-medium text-gray-700">Enable SSL</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="checkbox"
                          checked={kcConfig.smtpServer?.starttls === "true"}
                          onChange={(e) => setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, starttls: e.target.checked ? "true" : "false" }
                          })}
                          className="w-4 h-4 text-blue-700"
                        />
                        <label className="text-xs font-medium text-gray-700">Enable StartTLS</label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Authentication</h4>
                        <p className="text-[10px] text-gray-500">Provide username & credentials to SMTP server.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.smtpServer?.auth === "true"}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          smtpServer: { ...kcConfig.smtpServer, auth: e.target.checked ? "true" : "false" }
                        })}
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: SSO Sessions */}
              {activeSubTab === "sessions" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">SSO Session Settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">SSO Session Idle (Minutes)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.sessions?.ssoSessionIdleTimeout / 60) || 30}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, ssoSessionIdleTimeout: parseInt(e.target.value) * 60 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">SSO Session Max (Hours)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.sessions?.ssoSessionMaxLifespan / 3600) || 10}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, ssoSessionMaxLifespan: parseInt(e.target.value) * 3600 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">Offline Session settings</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Offline Session Idle (Days)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.sessions?.offlineSessionIdleTimeout / 86400) || 30}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, offlineSessionIdleTimeout: parseInt(e.target.value) * 86400 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Offline Session Max Limited</h4>
                        <p className="text-[10px] text-gray-500">Enforces dynamic max lifetimes on offline tokens.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.sessions?.offlineSessionMaxLifespanEnabled}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, offlineSessionMaxLifespanEnabled: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">Login timeout policies</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Login timeout (Minutes)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.sessions?.accessCodeLifespan / 60) || 30}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, accessCodeLifespan: parseInt(e.target.value) * 60 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Login action timeout (Minutes)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.sessions?.accessCodeLifespanUserAction / 60) || 5}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          sessions: { ...kcConfig.sessions, accessCodeLifespanUserAction: parseInt(e.target.value) * 60 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Token Lifespans */}
              {activeSubTab === "tokens" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">General Token parameters</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Default Signature Algorithm</label>
                      <select 
                        value={kcConfig.tokens?.defaultSignatureAlgorithm || "RS256"}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          tokens: { ...kcConfig.tokens, defaultSignatureAlgorithm: e.target.value }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="RS256">RS256</option>
                        <option value="HS256">HS256</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Revoke Refresh Token</h4>
                        <p className="text-[10px] text-gray-500">Revokes refresh tokens upon single usage rotation.</p>
                      </div>
                      <input 
                        type="checkbox"
                        checked={kcConfig.tokens?.revokeRefreshToken}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          tokens: { ...kcConfig.tokens, revokeRefreshToken: e.target.checked }
                        })}
                        className="w-4 h-4 text-blue-700"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">Token lifetimes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Access Token Lifespan (Minutes)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.tokens?.accessTokenLifespan / 60) || 5}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          tokens: { ...kcConfig.tokens, accessTokenLifespan: parseInt(e.target.value) * 60 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">Implicit Flow Access Token Lifespan (Minutes)</label>
                      <input 
                        type="number" 
                        value={Math.round(kcConfig.tokens?.accessTokenLifespanForImplicitFlow / 60) || 15}
                        onChange={(e) => setKcConfig({
                          ...kcConfig,
                          tokens: { ...kcConfig.tokens, accessTokenLifespanForImplicitFlow: parseInt(e.target.value) * 60 }
                        })}
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUTHENTICATION: Required Actions */}
          {activeTab === "auth" && !isAdmin && (
            <AdminRequired />
          )}
          {activeTab === "auth" && isAdmin && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">Required Authentication Actions</h2>
                <p className="text-xs text-gray-500">Actions required by users when authenticating. Enforce 2FA/MFA or update credentials here.</p>
              </div>

              <div className="divide-y divide-gray-150">
                {requiredActions.map((action: any) => (
                  <div key={action.alias} className="py-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{action.name}</h4>
                      <p className="text-[10px] text-gray-400 mt-0.5">Alias: {action.alias}</p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <input 
                          type="checkbox"
                          checked={action.enabled}
                          onChange={(e) => handleToggleRequiredAction(action, e.target.checked)}
                          className="w-4 h-4 text-blue-700"
                        />
                        <span className="text-xs font-medium text-gray-700">Enabled</span>
                      </div>
                    </div>
                  </div>
                ))}
                {requiredActions.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No Required Actions retrieved from the Identity Provider.
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-gray-200">
                <h3 className="text-xs font-bold text-gray-850 uppercase tracking-wider mb-1">Keycloak Authentication Flows</h3>
                <p className="text-xs text-gray-500 mb-4">View workflows used to authenticate users and API clients in this workspace.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authFlows.map((flow: any) => (
                    <div key={flow.id} className="p-3 border border-gray-200 rounded-lg flex items-center justify-between bg-gray-50/30">
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{flow.alias}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">{flow.description || "No description provided."}</p>
                      </div>
                      {flow.builtIn && (
                        <span className="text-[9px] font-medium bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded border border-gray-200">
                          Built-in
                        </span>
                      )}
                    </div>
                  ))}
                  {authFlows.length === 0 && (
                    <div className="col-span-2 py-6 text-center text-xs text-gray-450">
                      No Authentication Flows retrieved.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* IDENTITY PROVIDERS (OIDC / SAML / Microsoft / Google) */}
          {activeTab === "idp" && !isAdmin && (
            <AdminRequired />
          )}
          {activeTab === "idp" && isAdmin && (
            <div className="space-y-6">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">Configured Identity Providers</h2>
              <p className="text-xs text-gray-500">Add external social or enterprise (SAML 2.0 / Azure AD) connections for Single Sign-On (SSO).</p>

              {/* Add form */}
              <form onSubmit={handleCreateIdp} className="p-4 bg-gray-50 rounded-lg border border-gray-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Provider ID</label>
                  <select 
                    value={newIdp.providerId}
                    onChange={(e) => setNewIdp({ ...newIdp, providerId: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs bg-white"
                  >
                    <option value="">-- Choose Provider --</option>
                    <option value="saml">SAML v2.0</option>
                    <option value="microsoft">Microsoft (Entra ID/Azure AD)</option>
                    <option value="google">Google Workspace</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Alias ID</label>
                  <input 
                    type="text"
                    placeholder="my-saml-provider"
                    value={newIdp.alias}
                    onChange={(e) => setNewIdp({ ...newIdp, alias: e.target.value })}
                    required
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Display Name</label>
                  <input 
                    type="text"
                    placeholder="SSO Login"
                    value={newIdp.displayName}
                    onChange={(e) => setNewIdp({ ...newIdp, displayName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs"
                  />
                </div>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 text-xs">
                  <Plus size={14} className="mr-1" /> Add Provider
                </Button>
              </form>

              {/* List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {identityProviders.map((idp: any) => (
                  <div key={idp.alias} className="p-4 border border-gray-200 rounded-lg flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900">{idp.displayName || idp.alias}</h4>
                      <p className="text-[10px] text-gray-500 mt-1">Type: {idp.providerId} · Alias: {idp.alias}</p>
                    </div>
                    <Button 
                      variant="ghost" 
                      onClick={() => handleDeleteIdp(idp.alias)}
                      className="text-red-600 hover:text-red-800 hover:bg-red-50 p-1"
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
                {identityProviders.length === 0 && (
                  <div className="col-span-2 py-8 text-center text-xs text-gray-400">
                    No Identity Providers configured for this workspace.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-2 border-b">
                <h2 className="text-sm font-semibold text-gray-900">Immutable Audit Trail</h2>
                <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 font-medium">
                  <ShieldCheck size={12} /> Hash Chain Verified
                </div>
              </div>
              <DataTable data={auditLogs} columns={auditColumns} keyExtractor={(r) => r.id} />
            </div>
          )}

          {/* COMPLIANCE */}
          {activeTab === "compliance" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">Data Subject Requests (GDPR)</h2>
              <DataTable data={gdprRequests} columns={gdprColumns} keyExtractor={(r) => r.id} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
