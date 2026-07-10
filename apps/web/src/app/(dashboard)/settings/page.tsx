"use client";

import { useState, useEffect } from "react";
import {
  Building2,
  ShieldCheck,
  ScrollText,
  Save,
  AlertCircle,
  FileText,
  Mail,
  Clock,
  UserCheck,
  Share2,
  Settings2,
  CheckCircle2,
  Sliders,
  ShieldAlert,
  Loader2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, ColumnDef } from "@/components/ui/data-table";
import { auditApi, type ConsentRecord, type VerifyChainResponse } from "@/lib/api/audit-api";
import { tenantApi } from "@/lib/api/tenant-api";
import { useKeycloak } from "@/components/KeycloakProvider";
import { apiClient } from "@/lib/api/client";
import { IdpManager, ExistingIdp } from "@/components/settings/idp-manager";

type KcLoginConfig = {
  registrationAllowed: boolean;
  resetPasswordAllowed: boolean;
  rememberMe: boolean;
  registrationEmailAsUsername: boolean;
  loginWithEmailAllowed: boolean;
  duplicateEmailsAllowed: boolean;
  verifyEmail: boolean;
  editUsernameAllowed: boolean;
};

type KcSmtpConfig = {
  from?: string;
  fromDisplayName?: string;
  replyTo?: string;
  replyToDisplayName?: string;
  envelopeFrom?: string;
  host?: string;
  port?: string;
  ssl?: string;
  starttls?: string;
  auth?: string;
};

type KcSessionsConfig = {
  ssoSessionIdleTimeout: number;
  ssoSessionMaxLifespan: number;
  ssoSessionIdleTimeoutRememberMe: number;
  ssoSessionMaxLifespanRememberMe: number;
  clientSessionIdleTimeout: number;
  clientSessionMaxLifespan: number;
  offlineSessionIdleTimeout: number;
  offlineSessionMaxLifespanEnabled: boolean;
  accessCodeLifespanUserAction: number;
  accessCodeLifespan: number;
};

type KcTokensConfig = {
  defaultSignatureAlgorithm: string;
  oauth2DeviceCodeLifespan: number;
  oauth2DevicePollingInterval: number;
  revokeRefreshToken: boolean;
  accessTokenLifespan: number;
  accessTokenLifespanForImplicitFlow: number;
  clientLoginTimeout: number;
  actionTokenGeneratedByUserLifespan: number;
  actionTokenGeneratedByAdminLifespan: number;
};

type KcConfig = {
  login: KcLoginConfig;
  smtpServer: KcSmtpConfig;
  sessions: KcSessionsConfig;
  tokens: KcTokensConfig;
};

type AuditLog = {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  userId: string;
  hash: string;
};

type GdprRequest = {
  id: string;
  subjectEmail: string;
  type: string;
  requestedAt: string;
  status: string;
};

type RequiredAction = {
  alias: string;
  name: string;
  enabled: boolean;
};

type AuthFlow = {
  id: string;
  alias: string;
  description?: string;
  builtIn?: boolean;
};

const CONSENT_TYPES = ["marketing", "analytics", "data_processing", "third_party_sharing"] as const;

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
  const [tenantConfig, setTenantConfig] = useState<{ name?: string; slug?: string; plan?: string }>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [gdprRequests, setGdprRequests] = useState<GdprRequest[]>([]);
  const [dsrEmail, setDsrEmail] = useState("");
  const [dsrType, setDsrType] = useState("ACCESS");
  const [consents, setConsents] = useState<ConsentRecord[]>([]);
  const [consentEmail, setConsentEmail] = useState("");
  const [consentType, setConsentType] = useState<string>(CONSENT_TYPES[0]);
  const [consentGranted, setConsentGranted] = useState(true);
  const [consentFilter, setConsentFilter] = useState("");
  const [consentLoading, setConsentLoading] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [consentSaving, setConsentSaving] = useState(false);
  const [chainStatus, setChainStatus] = useState<
    "idle" | "checking" | "valid" | "invalid" | "error"
  >("idle");
  const [chainDetail, setChainDetail] = useState<string | null>(null);

  const refreshGdpr = () => auditApi.getGdprRequests().then(setGdprRequests).catch(console.error);

  const refreshConsents = async (emailFilter?: string) => {
    setConsentLoading(true);
    setConsentError(null);
    try {
      const data = await auditApi.listConsents(emailFilter || undefined);
      setConsents(Array.isArray(data) ? data : []);
    } catch (err) {
      setConsentError(err instanceof Error ? err.message : "Failed to load consents");
    } finally {
      setConsentLoading(false);
    }
  };

  const handleVerifyChain = async () => {
    setChainStatus("checking");
    setChainDetail(null);
    try {
      const result: VerifyChainResponse = await auditApi.verifyChain();
      if (result?.valid) {
        setChainStatus("valid");
        setChainDetail("Hash chain integrity verified.");
      } else {
        setChainStatus("invalid");
        setChainDetail(
          typeof result?.brokenAt === "number"
            ? `Chain broken at index ${result.brokenAt}.`
            : "Hash chain integrity check failed.",
        );
      }
    } catch (err) {
      setChainStatus("error");
      setChainDetail(err instanceof Error ? err.message : "Failed to verify hash chain.");
    }
  };

  // Keycloak configs
  const [kcConfig, setKcConfig] = useState<KcConfig>({
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
      defaultSignatureAlgorithm: "RS256",
      oauth2DeviceCodeLifespan: 600,
      oauth2DevicePollingInterval: 5,
      revokeRefreshToken: false,
      accessTokenLifespan: 300,
      accessTokenLifespanForImplicitFlow: 900,
      clientLoginTimeout: 60,
      actionTokenGeneratedByUserLifespan: 300,
      actionTokenGeneratedByAdminLifespan: 43200,
    },
  });

  const [requiredActions, setRequiredActions] = useState<RequiredAction[]>([]);
  const [authFlows, setAuthFlows] = useState<AuthFlow[]>([]);
  const [identityProviders, setIdentityProviders] = useState<ExistingIdp[]>([]);

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
      setChainStatus("idle");
      setChainDetail(null);
    }
    if (activeTab === "compliance") {
      auditApi.getGdprRequests().then(setGdprRequests).catch(console.error);
      refreshConsents(consentFilter.trim() || undefined);
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
      } catch {
        /* ignore */
      }
      try {
        setIdentityProviders(await tenantApi.getIdentityProviders());
      } catch {
        /* ignore */
      }
      try {
        setAuthFlows(await tenantApi.getAuthenticationFlows());
      } catch {
        /* ignore */
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    if (!initialized || !token) return;
    // Fetch DB roles from /auth/me — same source the backend RolesGuard uses,
    // so this works regardless of whether Keycloak realm roles are set up.
    apiClient("/auth/me")
      .then((me: { roles: string[] }) => {
        const admin = me.roles.includes("SuperAdmin") || me.roles.includes("TenantAdmin");
        setIsAdmin(admin);
        fetchAllData(admin);
      })
      .catch(() => {
        // If /auth/me fails, still attempt data fetch as non-admin
        fetchAllData(false);
      });
  }, [initialized, token]);

  const handleSaveConfig = async () => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.updateKeycloakConfig(kcConfig);
      setSuccessMsg("Keycloak configuration securely updated and synced!");
    } catch {
      setErrorMsg("Connection failure while updating settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleRequiredAction = async (action: RequiredAction, enabled: boolean) => {
    setLoading(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      await tenantApi.updateRequiredAction(action.alias, { ...action, enabled });
      setSuccessMsg(`Required action '${action.name}' updated!`);
      setRequiredActions(await tenantApi.getRequiredActions());
    } catch {
      setErrorMsg("Connection failure while updating action.");
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
    } catch {
      setErrorMsg("Connection failure while removing identity provider.");
    } finally {
      setLoading(false);
    }
  };

  const auditColumns: ColumnDef<AuditLog>[] = [
    {
      header: "Date",
      accessorKey: "createdAt",
      cell: (row) => new Date(row.createdAt).toLocaleString(),
    },
    { header: "Action", accessorKey: "action" },
    { header: "Entity", accessorKey: "entityType" },
    { header: "User ID", accessorKey: "userId" },
    {
      header: "Hash",
      accessorKey: "hash",
      cell: (row) => (
        <span className="font-mono text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">
          {row.hash.substring(0, 8)}...
        </span>
      ),
    },
  ];

  const gdprColumns: ColumnDef<GdprRequest>[] = [
    { header: "Subject Email", accessorKey: "subjectEmail" },
    { header: "Type", accessorKey: "type" },
    {
      header: "Requested",
      accessorKey: "requestedAt",
      cell: (row) => new Date(row.requestedAt).toLocaleDateString(),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row) => (
        <span
          className={`px-2 py-1 rounded-lg text-xs font-medium ${
            row.status === "FULFILLED"
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-amber-50 text-amber-600 border border-amber-200"
          }`}
        >
          {row.status}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          {row.status !== "FULFILLED" && (
            <button
              type="button"
              className="text-xs text-blue-600 hover:underline"
              onClick={async () => {
                await auditApi.fulfillGdprRequest(row.id);
                refreshGdpr();
              }}
            >
              Fulfill
            </button>
          )}
          {row.status === "FULFILLED" && (row.type === "ACCESS" || row.type === "PORTABILITY") && (
            <button
              type="button"
              className="text-xs text-emerald-600 hover:underline"
              onClick={async () => {
                const blob = await auditApi.downloadGdprExport(row.id);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `dsr-export-${row.id}.zip`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download ZIP
            </button>
          )}
        </div>
      ),
    },
  ];

  const consentColumns: ColumnDef<ConsentRecord>[] = [
    { header: "Subject Email", accessorKey: "subjectEmail" },
    { header: "Consent Type", accessorKey: "consentType" },
    {
      header: "Granted",
      accessorKey: "granted",
      cell: (row) => (
        <span
          className={`px-2 py-1 rounded-lg text-xs font-medium ${
            row.granted
              ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
              : "bg-slate-100 text-slate-600 border border-slate-200"
          }`}
        >
          {row.granted ? "Granted" : "Withdrawn"}
        </span>
      ),
    },
    {
      header: "Recorded",
      accessorKey: "recordedAt",
      cell: (row) => new Date(row.recordedAt).toLocaleString(),
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Title block */}
      <div className="flex items-start justify-between pb-5 border-b border-slate-200">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Settings2 size={18} className="text-slate-500" />
            Settings
          </h1>
          <p className="page-subtitle mt-1">
            Tenant policies, Keycloak identity, and compliance configuration
          </p>
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

      {/* Horizontal Tab Bar */}
      <div className="border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
        {tabs.map((tab) => {
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
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-all ${
                isActive
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300"
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div>
        {/* Content Area */}
        <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-card min-h-[500px]">
          {/* GENERAL SETTINGS */}
          {activeTab === "general" && (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">
                General Settings
              </h2>
              <div className="grid grid-cols-1 gap-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Company Workspace Name
                  </label>
                  <input
                    type="text"
                    value={tenantConfig.name || ""}
                    onChange={(e) => setTenantConfig({ ...tenantConfig, name: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Company Domain / Slug
                  </label>
                  <input
                    type="text"
                    value={tenantConfig.slug || ""}
                    disabled
                    className="w-full rounded-md border border-gray-200 bg-gray-50 text-gray-400 px-3 py-2 text-xs cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Immutable slug used for the workspace routing and realm separation.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ERP Active Plan
                  </label>
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
          {activeTab === "keycloak" && !isAdmin && <AdminRequired />}
          {activeTab === "keycloak" && isAdmin && (
            <div className="space-y-6">
              {/* Internal tabs */}
              <div className="flex border-b border-gray-200 gap-1 pb-px overflow-x-auto">
                {[
                  { id: "login", label: "Login Settings", icon: UserCheck },
                  { id: "smtp", label: "Email Server (SMTP)", icon: Mail },
                  { id: "sessions", label: "SSO Sessions", icon: Clock },
                  { id: "tokens", label: "Token Lifespans", icon: Sliders },
                ].map((sub) => {
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
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Login & Info Customization
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* User Registration */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">User registration</h4>
                        <p className="text-[10px] text-gray-500">
                          Allow users to register their own accounts.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.registrationAllowed}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, registrationAllowed: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Forgot password */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Forgot password</h4>
                        <p className="text-[10px] text-gray-500">
                          Enable self-service reset links.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.resetPasswordAllowed}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, resetPasswordAllowed: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Remember me */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Remember me</h4>
                        <p className="text-[10px] text-gray-500">
                          Stay logged in between browser sessions.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.rememberMe}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, rememberMe: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Edit username */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Edit username</h4>
                        <p className="text-[10px] text-gray-500">
                          Allow users to modify their active logins.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.editUsernameAllowed}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, editUsernameAllowed: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">
                    Email Logins
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Login with email */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Login with email</h4>
                        <p className="text-[10px] text-gray-500">
                          Allow logins via email address instead of username.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.loginWithEmailAllowed}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, loginWithEmailAllowed: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Email as username */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Email as username</h4>
                        <p className="text-[10px] text-gray-500">
                          Forces usernames to match full email addresses.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.registrationEmailAsUsername}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: {
                              ...kcConfig.login,
                              registrationEmailAsUsername: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Duplicate emails */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Duplicate emails</h4>
                        <p className="text-[10px] text-gray-500">
                          Allows multiple users to share the same email.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.duplicateEmailsAllowed}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, duplicateEmailsAllowed: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>

                    {/* Verify email */}
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Verify email</h4>
                        <p className="text-[10px] text-gray-500">
                          Require activation link click before login.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.login?.verifyEmail}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            login: { ...kcConfig.login, verifyEmail: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 2: SMTP Template settings */}
              {activeSubTab === "smtp" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    Mail server details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        From *
                      </label>
                      <input
                        type="email"
                        placeholder="sender@company-b.com"
                        value={kcConfig.smtpServer?.from || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, from: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        From display name
                      </label>
                      <input
                        type="text"
                        placeholder="Amdox Identity Team"
                        value={kcConfig.smtpServer?.fromDisplayName || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, fromDisplayName: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Reply to
                      </label>
                      <input
                        type="email"
                        placeholder="support@company-b.com"
                        value={kcConfig.smtpServer?.replyTo || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, replyTo: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Reply to display name
                      </label>
                      <input
                        type="text"
                        value={kcConfig.smtpServer?.replyToDisplayName || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: {
                              ...kcConfig.smtpServer,
                              replyToDisplayName: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Envelope from
                      </label>
                      <input
                        type="email"
                        value={kcConfig.smtpServer?.envelopeFrom || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, envelopeFrom: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">
                    Connection & Encryption
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Host *
                      </label>
                      <input
                        type="text"
                        placeholder="smtp.company.com"
                        value={kcConfig.smtpServer?.host || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, host: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Port
                      </label>
                      <input
                        type="text"
                        placeholder="25"
                        value={kcConfig.smtpServer?.port || ""}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: { ...kcConfig.smtpServer, port: e.target.value },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>

                    <div className="flex gap-6 items-center p-3">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={kcConfig.smtpServer?.ssl === "true"}
                          onChange={(e) =>
                            setKcConfig({
                              ...kcConfig,
                              smtpServer: {
                                ...kcConfig.smtpServer,
                                ssl: e.target.checked ? "true" : "false",
                              },
                            })
                          }
                          className="w-4 h-4 text-blue-700"
                        />
                        <label className="text-xs font-medium text-gray-700">Enable SSL</label>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={kcConfig.smtpServer?.starttls === "true"}
                          onChange={(e) =>
                            setKcConfig({
                              ...kcConfig,
                              smtpServer: {
                                ...kcConfig.smtpServer,
                                starttls: e.target.checked ? "true" : "false",
                              },
                            })
                          }
                          className="w-4 h-4 text-blue-700"
                        />
                        <label className="text-xs font-medium text-gray-700">Enable StartTLS</label>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">Authentication</h4>
                        <p className="text-[10px] text-gray-500">
                          Provide username & credentials to SMTP server.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.smtpServer?.auth === "true"}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            smtpServer: {
                              ...kcConfig.smtpServer,
                              auth: e.target.checked ? "true" : "false",
                            },
                          })
                        }
                        className="w-4 h-4 text-blue-700 focus:ring-[#1E3A5F]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 3: SSO Sessions */}
              {activeSubTab === "sessions" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    SSO Session Settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        SSO Session Idle (Minutes)
                      </label>
                      <input
                        type="number"
                        value={Math.round(kcConfig.sessions?.ssoSessionIdleTimeout / 60) || 30}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              ssoSessionIdleTimeout: parseInt(e.target.value) * 60,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        SSO Session Max (Hours)
                      </label>
                      <input
                        type="number"
                        value={Math.round(kcConfig.sessions?.ssoSessionMaxLifespan / 3600) || 10}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              ssoSessionMaxLifespan: parseInt(e.target.value) * 3600,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">
                    Offline Session settings
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Offline Session Idle (Days)
                      </label>
                      <input
                        type="number"
                        value={
                          Math.round(kcConfig.sessions?.offlineSessionIdleTimeout / 86400) || 30
                        }
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              offlineSessionIdleTimeout: parseInt(e.target.value) * 86400,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">
                          Offline Session Max Limited
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          Enforces dynamic max lifetimes on offline tokens.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.sessions?.offlineSessionMaxLifespanEnabled}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              offlineSessionMaxLifespanEnabled: e.target.checked,
                            },
                          })
                        }
                        className="w-4 h-4 text-blue-700"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">
                    Login timeout policies
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Login timeout (Minutes)
                      </label>
                      <input
                        type="number"
                        value={Math.round(kcConfig.sessions?.accessCodeLifespan / 60) || 30}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              accessCodeLifespan: parseInt(e.target.value) * 60,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Login action timeout (Minutes)
                      </label>
                      <input
                        type="number"
                        value={
                          Math.round(kcConfig.sessions?.accessCodeLifespanUserAction / 60) || 5
                        }
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            sessions: {
                              ...kcConfig.sessions,
                              accessCodeLifespanUserAction: parseInt(e.target.value) * 60,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Subtab 4: Token Lifespans */}
              {activeSubTab === "tokens" && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                    General Token parameters
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Default Signature Algorithm
                      </label>
                      <select
                        value={kcConfig.tokens?.defaultSignatureAlgorithm || "RS256"}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            tokens: {
                              ...kcConfig.tokens,
                              defaultSignatureAlgorithm: e.target.value,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                      >
                        <option value="RS256">RS256</option>
                        <option value="HS256">HS256</option>
                      </select>
                    </div>

                    <div className="flex items-center justify-between p-3 border border-gray-150 rounded-lg">
                      <div>
                        <h4 className="text-xs font-semibold text-gray-800">
                          Revoke Refresh Token
                        </h4>
                        <p className="text-[10px] text-gray-500">
                          Revokes refresh tokens upon single usage rotation.
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={kcConfig.tokens?.revokeRefreshToken}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            tokens: { ...kcConfig.tokens, revokeRefreshToken: e.target.checked },
                          })
                        }
                        className="w-4 h-4 text-blue-700"
                      />
                    </div>
                  </div>

                  <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider mt-6 pt-4 border-t">
                    Token lifetimes
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Access Token Lifespan (Minutes)
                      </label>
                      <input
                        type="number"
                        value={Math.round(kcConfig.tokens?.accessTokenLifespan / 60) || 5}
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            tokens: {
                              ...kcConfig.tokens,
                              accessTokenLifespan: parseInt(e.target.value) * 60,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-gray-700 mb-1">
                        Implicit Flow Access Token Lifespan (Minutes)
                      </label>
                      <input
                        type="number"
                        value={
                          Math.round(kcConfig.tokens?.accessTokenLifespanForImplicitFlow / 60) || 15
                        }
                        onChange={(e) =>
                          setKcConfig({
                            ...kcConfig,
                            tokens: {
                              ...kcConfig.tokens,
                              accessTokenLifespanForImplicitFlow: parseInt(e.target.value) * 60,
                            },
                          })
                        }
                        className="w-full rounded-md border border-gray-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* AUTHENTICATION: Required Actions */}
          {activeTab === "auth" && !isAdmin && <AdminRequired />}
          {activeTab === "auth" && isAdmin && (
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">
                  Required Authentication Actions
                </h2>
                <p className="text-xs text-gray-500">
                  Actions required by users when authenticating. Enforce 2FA/MFA or update
                  credentials here.
                </p>
              </div>

              <div className="divide-y divide-gray-150">
                {requiredActions.map((action) => (
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
                <h3 className="text-xs font-bold text-gray-850 uppercase tracking-wider mb-1">
                  Keycloak Authentication Flows
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  View workflows used to authenticate users and API clients in this workspace.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {authFlows.map((flow) => (
                    <div
                      key={flow.id}
                      className="p-3 border border-gray-200 rounded-lg flex items-center justify-between bg-gray-50/30"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-gray-900">{flow.alias}</h4>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {flow.description || "No description provided."}
                        </p>
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

          {/* IDENTITY PROVIDERS (OIDC / SAML / Microsoft / Google / GitHub …) */}
          {activeTab === "idp" && !isAdmin && <AdminRequired />}
          {activeTab === "idp" && isAdmin && (
            <IdpManager
              identityProviders={identityProviders}
              tenantSlug={tenantConfig.slug || "my-realm"}
              onAdd={async (body) => {
                try {
                  await tenantApi.createIdentityProvider(body);
                } catch {
                  setErrorMsg(`Failed to add identity provider '${body.alias as string}'.`);
                  throw new Error("createIdentityProvider failed");
                }
                setSuccessMsg(`Identity provider '${body.alias as string}' added!`);
                try {
                  setIdentityProviders(await tenantApi.getIdentityProviders());
                } catch {
                  /* ignore */
                }
              }}
              onDelete={handleDeleteIdp}
            />
          )}

          {/* AUDIT LOGS */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-3 pb-2 border-b">
                <h2 className="text-sm font-semibold text-gray-900">Immutable Audit Trail</h2>
                <div className="flex items-center gap-2">
                  {chainStatus === "valid" && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 font-medium">
                      <ShieldCheck size={12} /> Hash Chain Verified
                    </div>
                  )}
                  {chainStatus === "invalid" && (
                    <div className="flex items-center gap-1.5 text-[10px] text-red-600 bg-red-50 px-2.5 py-1 rounded-full border border-red-100 font-medium">
                      <XCircle size={12} /> Chain Broken
                    </div>
                  )}
                  {chainStatus === "error" && (
                    <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 font-medium">
                      <AlertCircle size={12} /> Verify Failed
                    </div>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleVerifyChain}
                    disabled={chainStatus === "checking"}
                    icon={
                      chainStatus === "checking" ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <ShieldCheck size={13} />
                      )
                    }
                  >
                    {chainStatus === "checking" ? "Verifying…" : "Verify chain"}
                  </Button>
                </div>
              </div>
              {chainDetail && (
                <p
                  className={`text-xs ${
                    chainStatus === "valid"
                      ? "text-emerald-700"
                      : chainStatus === "invalid"
                        ? "text-red-600"
                        : "text-amber-700"
                  }`}
                >
                  {chainDetail}
                </p>
              )}
              <DataTable data={auditLogs} columns={auditColumns} keyExtractor={(r) => r.id} />
            </div>
          )}

          {/* COMPLIANCE */}
          {activeTab === "compliance" && (
            <div className="space-y-8">
              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">
                  Data Subject Requests (GDPR)
                </h2>
                <div className="flex flex-wrap gap-2 items-end pb-4 border-b border-slate-100">
                  <label className="text-xs text-slate-600">
                    Subject email
                    <input
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={dsrEmail}
                      onChange={(e) => setDsrEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Type
                    <select
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={dsrType}
                      onChange={(e) => setDsrType(e.target.value)}
                    >
                      <option value="ACCESS">ACCESS</option>
                      <option value="PORTABILITY">PORTABILITY</option>
                      <option value="ERASURE">ERASURE</option>
                    </select>
                  </label>
                  <Button
                    size="sm"
                    onClick={async () => {
                      if (!dsrEmail) return;
                      await auditApi.createGdprRequest(dsrEmail, dsrType);
                      setDsrEmail("");
                      refreshGdpr();
                    }}
                  >
                    Create DSR
                  </Button>
                </div>
                <DataTable data={gdprRequests} columns={gdprColumns} keyExtractor={(r) => r.id} />
              </div>

              <div className="space-y-4">
                <h2 className="text-sm font-semibold text-gray-900 pb-2 border-b">
                  Consent Records
                </h2>
                <div className="flex flex-wrap gap-2 items-end pb-4 border-b border-slate-100">
                  <label className="text-xs text-slate-600">
                    Subject email
                    <input
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={consentEmail}
                      onChange={(e) => setConsentEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </label>
                  <label className="text-xs text-slate-600">
                    Consent type
                    <select
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={consentType}
                      onChange={(e) => setConsentType(e.target.value)}
                    >
                      {CONSENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">
                    Decision
                    <select
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={consentGranted ? "granted" : "withdrawn"}
                      onChange={(e) => setConsentGranted(e.target.value === "granted")}
                    >
                      <option value="granted">Granted</option>
                      <option value="withdrawn">Withdrawn</option>
                    </select>
                  </label>
                  <Button
                    size="sm"
                    disabled={consentSaving || !consentEmail.trim()}
                    onClick={async () => {
                      if (!consentEmail.trim()) return;
                      setConsentSaving(true);
                      setConsentError(null);
                      try {
                        await auditApi.recordConsent(
                          consentEmail.trim(),
                          consentType,
                          consentGranted,
                        );
                        setConsentEmail("");
                        await refreshConsents(consentFilter.trim() || undefined);
                      } catch (err) {
                        setConsentError(
                          err instanceof Error ? err.message : "Failed to record consent",
                        );
                      } finally {
                        setConsentSaving(false);
                      }
                    }}
                  >
                    {consentSaving ? "Recording…" : "Record Consent"}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-end">
                  <label className="text-xs text-slate-600">
                    Filter by email
                    <input
                      className="mt-1 block border border-slate-200 rounded-md px-3 py-1.5 text-sm"
                      value={consentFilter}
                      onChange={(e) => setConsentFilter(e.target.value)}
                      placeholder="optional filter"
                    />
                  </label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => refreshConsents(consentFilter.trim() || undefined)}
                    disabled={consentLoading}
                  >
                    {consentLoading ? "Loading…" : "Refresh"}
                  </Button>
                </div>
                {consentError && (
                  <div className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
                    {consentError}
                  </div>
                )}
                {consentLoading && consents.length === 0 ? (
                  <div className="space-y-2">
                    {[0, 1].map((i) => (
                      <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <DataTable data={consents} columns={consentColumns} keyExtractor={(r) => r.id} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
