"use client";

import { useState } from "react";
import {
  ChevronRight,
  Copy,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  ChevronDown,
  ExternalLink,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Provider {
  id: string;
  label: string;
  section: "user-defined" | "social";
  icon: React.ReactNode;
}

export interface ExistingIdp {
  alias: string;
  providerId: string;
  displayName?: string;
  enabled?: boolean;
}

interface IdpManagerProps {
  identityProviders: ExistingIdp[];
  tenantSlug: string;
  onAdd: (body: Record<string, unknown>) => Promise<void>;
  onDelete: (alias: string) => Promise<void>;
}

type View = "list" | "picker" | "form";

// ─── Provider Catalog ─────────────────────────────────────────────────────────

const KC_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180"
    : "http://localhost:8180";

const PROVIDERS: Provider[] = [
  // User-defined
  {
    id: "keycloak-oidc",
    label: "Keycloak OpenID Connect",
    section: "user-defined",
    icon: <KcIcon />,
  },
  {
    id: "oidc",
    label: "OpenID Connect v1.0",
    section: "user-defined",
    icon: <OidcIcon />,
  },
  {
    id: "saml",
    label: "SAML v2.0",
    section: "user-defined",
    icon: <SamlIcon />,
  },
  // Social
  { id: "google", label: "Google", section: "social", icon: <GoogleIcon /> },
  {
    id: "microsoft",
    label: "Microsoft",
    section: "social",
    icon: <MsIcon />,
  },
  { id: "github", label: "GitHub", section: "social", icon: <GhIcon /> },
  { id: "gitlab", label: "GitLab", section: "social", icon: <GlIcon /> },
  {
    id: "linkedin",
    label: "LinkedIn",
    section: "social",
    icon: <LinkedInIcon />,
  },
  { id: "facebook", label: "Facebook", section: "social", icon: <FbIcon /> },
  { id: "twitter", label: "Twitter", section: "social", icon: <TwIcon /> },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
        checked ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy to clipboard"
      className="ml-2 flex-shrink-0 p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center gap-0">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "••••••••••••"}
        className="flex-1 rounded-l-md border border-r-0 border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="px-2.5 py-2 border border-slate-300 rounded-r-md text-slate-400 hover:text-slate-600 bg-slate-50 transition-colors"
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-6 py-4 border-b border-slate-100 last:border-0">
      <div className="w-48 shrink-0 pt-1">
        <label className="text-[12px] font-semibold text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      </div>
      <div className="flex-1 min-w-0">
        {children}
        {hint && <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">{hint}</p>}
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-5 pb-2">
      <h3 className="text-[13px] font-semibold text-slate-800">{children}</h3>
      <div className="mt-1.5 h-px bg-slate-200" />
    </div>
  );
}

function RedirectUriField({
  providerId,
  alias,
  tenantSlug,
}: {
  providerId: string;
  alias: string;
  tenantSlug: string;
}) {
  const aliasOrId = alias || providerId;
  const uri = `${KC_BASE}/realms/${tenantSlug}/broker/${aliasOrId}/endpoint`;
  return (
    <FormField
      label="Redirect URI"
      hint="Copy this URI and register it as an allowed redirect in your identity provider's OAuth application."
    >
      <div className="flex items-center">
        <input
          readOnly
          value={uri}
          className="flex-1 rounded-l-md border border-slate-300 px-3 py-2 text-xs bg-slate-50 text-slate-500 outline-none select-all"
        />
        <CopyButton value={uri} />
      </div>
    </FormField>
  );
}

// ─── Per-provider forms ───────────────────────────────────────────────────────

function GoogleForm({
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [hostedDomain, setHostedDomain] = useState("");
  const [useUserIp, setUseUserIp] = useState(false);
  const [requestRefresh, setRequestRefresh] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias: "google",
      providerId: "google",
      displayName: "Google",
      enabled: true,
      config: {
        clientId,
        clientSecret,
        hostedDomain,
        useUserIpParam: String(useUserIp),
        requestRefreshToken: String(requestRefresh),
        guiOrder: displayOrder,
      },
    });
  };

  return (
    <form onSubmit={submit} className="space-y-0">
      <RedirectUriField providerId="google" alias="google" tenantSlug={tenantSlug} />
      <FormField label="Client ID" required>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          placeholder="Your Google OAuth Client ID"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Client Secret" required>
        <SecretInput value={clientSecret} onChange={setClientSecret} />
      </FormField>
      <FormField
        label="Display order"
        hint="Order in which this provider appears on the login page."
      >
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField
        label="Hosted Domain"
        hint="Set the 'hd' query parameter when logging in with Google. Google will list accounts only for this domain. When '*' is entered, any hosted account can be used. Comma ',' separated list of domains is supported."
      >
        <input
          value={hostedDomain}
          onChange={(e) => setHostedDomain(e.target.value)}
          placeholder="yourcompany.com"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Use userIp param">
        <div className="flex items-center gap-2.5 pt-0.5">
          <Toggle checked={useUserIp} onChange={setUseUserIp} />
          <span className="text-xs text-slate-600">{useUserIp ? "On" : "Off"}</span>
        </div>
      </FormField>
      <FormField label="Request refresh token">
        <div className="flex items-center gap-2.5 pt-0.5">
          <Toggle checked={requestRefresh} onChange={setRequestRefresh} />
          <span className="text-xs text-slate-600">{requestRefresh ? "On" : "Off"}</span>
        </div>
      </FormField>
      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function MicrosoftForm({
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [tenantId, setTenantId] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias: "microsoft",
      providerId: "microsoft",
      displayName: "Microsoft",
      enabled: true,
      config: { clientId, clientSecret, guiOrder: displayOrder, tenantId },
    });
  };

  return (
    <form onSubmit={submit}>
      <RedirectUriField providerId="microsoft" alias="microsoft" tenantSlug={tenantSlug} />
      <FormField label="Client ID" required>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Client Secret" required>
        <SecretInput value={clientSecret} onChange={setClientSecret} />
      </FormField>
      <FormField label="Display order">
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField
        label="Tenant ID"
        hint="Uses single-tenant auth endpoints when specified, uses 'common' multi-tenant endpoints otherwise."
      >
        <input
          value={tenantId}
          onChange={(e) => setTenantId(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function GitHubForm({
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiUrl, setApiUrl] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias: "github",
      providerId: "github",
      displayName: "GitHub",
      enabled: true,
      config: { clientId, clientSecret, guiOrder: displayOrder, baseUrl, apiUrl },
    });
  };

  return (
    <form onSubmit={submit}>
      <RedirectUriField providerId="github" alias="github" tenantSlug={tenantSlug} />
      <FormField label="Client ID" required>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Client Secret" required>
        <SecretInput value={clientSecret} onChange={setClientSecret} />
      </FormField>
      <FormField label="Display order">
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Base URL" hint="Override the default Base URL for this identity provider.">
        <input
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="API URL" hint="Override the default API URL for this identity provider.">
        <input
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function SamlForm({
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [alias, setAlias] = useState("saml");
  const [displayName, setDisplayName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [entityId, setEntityId] = useState(`${KC_BASE}/realms/${tenantSlug}`);
  const [useDescriptor, setUseDescriptor] = useState(true);
  const [entityDescriptor, setEntityDescriptor] = useState("");
  const [showMeta, setShowMeta] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias,
      providerId: "saml",
      displayName,
      enabled: true,
      config: {
        guiOrder: displayOrder,
        entityId,
        useMetadataDescriptorUrl: String(useDescriptor),
        metadataDescriptorUrl: entityDescriptor,
      },
    });
  };

  return (
    <form onSubmit={submit}>
      <RedirectUriField providerId="saml" alias={alias || "saml"} tenantSlug={tenantSlug} />
      <FormField label="Alias" required>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Display order">
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>

      <SectionHeading>SAML settings</SectionHeading>

      <FormField label="Service provider entity ID" required>
        <input
          value={entityId}
          onChange={(e) => setEntityId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField
        label="Use entity descriptor"
        hint="When enabled, import SAML settings automatically from the IDP's metadata URL or XML."
      >
        <div className="flex items-center gap-2.5 pt-0.5">
          <Toggle checked={useDescriptor} onChange={setUseDescriptor} />
          <span className="text-xs text-slate-600">{useDescriptor ? "On" : "Off"}</span>
        </div>
      </FormField>
      {useDescriptor && (
        <FormField
          label="SAML entity descriptor"
          required
          hint="URL or XML of the SAML Identity Provider metadata."
        >
          <input
            value={entityDescriptor}
            onChange={(e) => setEntityDescriptor(e.target.value)}
            required
            placeholder="https://idp.example.com/saml/metadata"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </FormField>
      )}

      <div className="py-2">
        <button
          type="button"
          onClick={() => setShowMeta((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ChevronRight
            size={13}
            className={`transition-transform ${showMeta ? "rotate-90" : ""}`}
          />
          Show metadata
        </button>
        {showMeta && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600 space-y-1">
            <p>
              SP Metadata URL:{" "}
              <span className="font-mono text-blue-600">
                {KC_BASE}/realms/{tenantSlug}/broker/{alias || "saml"}/endpoint/descriptor
              </span>
            </p>
          </div>
        )}
      </div>

      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function OidcForm({
  providerId,
  providerLabel,
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  providerId: "keycloak-oidc" | "oidc";
  providerLabel: string;
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const defaultAlias = providerId === "keycloak-oidc" ? "keycloak-oidc" : "oidc";
  const [alias, setAlias] = useState(defaultAlias);
  const [displayName, setDisplayName] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");
  const [useDiscovery, setUseDiscovery] = useState(true);
  const [discoveryEndpoint, setDiscoveryEndpoint] = useState("");
  const [clientAuth, setClientAuth] = useState("client_secret_post");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [sigAlgo, setSigAlgo] = useState("");
  const [showMeta, setShowMeta] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias,
      providerId,
      displayName,
      enabled: true,
      config: {
        guiOrder: displayOrder,
        useDiscoveryEndpoint: String(useDiscovery),
        discoveryEndpoint,
        clientAuthMethod: clientAuth,
        clientId,
        clientSecret,
        clientAssertionSignatureAlgorithm: sigAlgo,
      },
    });
  };

  return (
    <form onSubmit={submit}>
      <RedirectUriField
        providerId={providerId}
        alias={alias || defaultAlias}
        tenantSlug={tenantSlug}
      />
      <FormField label="Alias" required>
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Display name">
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Display order">
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>

      <SectionHeading>OpenID Connect settings</SectionHeading>

      <FormField
        label="Use discovery endpoint"
        hint="Automatically fetch OpenID Connect configuration from a discovery URL."
      >
        <div className="flex items-center gap-2.5 pt-0.5">
          <Toggle checked={useDiscovery} onChange={setUseDiscovery} />
          <span className="text-xs text-slate-600">{useDiscovery ? "On" : "Off"}</span>
        </div>
      </FormField>
      {useDiscovery && (
        <FormField
          label="Discovery endpoint"
          required
          hint="The well-known OpenID configuration URL."
        >
          <input
            value={discoveryEndpoint}
            onChange={(e) => setDiscoveryEndpoint(e.target.value)}
            required
            placeholder="https://hostname/auth/realms/master/.well-known/openid-configuration"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </FormField>
      )}

      <div className="py-2">
        <button
          type="button"
          onClick={() => setShowMeta((s) => !s)}
          className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
        >
          <ChevronRight
            size={13}
            className={`transition-transform ${showMeta ? "rotate-90" : ""}`}
          />
          Show metadata
        </button>
        {showMeta && (
          <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-md text-[11px] text-slate-600">
            <p>
              Issuer, auth endpoint, and token endpoint will be auto-populated from the discovery
              document.
            </p>
          </div>
        )}
      </div>

      <FormField label="Client authentication">
        <select
          value={clientAuth}
          onChange={(e) => setClientAuth(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="client_secret_post">Client secret sent as post</option>
          <option value="client_secret_basic">Client secret sent as basic auth</option>
          <option value="client_secret_jwt">Client secret as JWT</option>
          <option value="private_key_jwt">JWT signed with private key</option>
        </select>
      </FormField>
      <FormField label="Client ID" required>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Client Secret" required>
        <SecretInput value={clientSecret} onChange={setClientSecret} />
      </FormField>
      <FormField label="Client assertion signature algorithm">
        <select
          value={sigAlgo}
          onChange={(e) => setSigAlgo(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs bg-white focus:ring-1 focus:ring-blue-500 outline-none"
        >
          <option value="">Algorithm not specified</option>
          <option value="RS256">RS256</option>
          <option value="RS384">RS384</option>
          <option value="RS512">RS512</option>
          <option value="ES256">ES256</option>
          <option value="ES384">ES384</option>
          <option value="ES512">ES512</option>
        </select>
      </FormField>
      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function GenericSocialForm({
  provider,
  tenantSlug,
  onSubmit,
  onCancel,
  loading,
}: {
  provider: Provider;
  tenantSlug: string;
  onSubmit: (body: Record<string, unknown>) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [displayOrder, setDisplayOrder] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      alias: provider.id,
      providerId: provider.id,
      displayName: provider.label,
      enabled: true,
      config: { clientId, clientSecret, guiOrder: displayOrder },
    });
  };

  return (
    <form onSubmit={submit}>
      <RedirectUriField providerId={provider.id} alias={provider.id} tenantSlug={tenantSlug} />
      <FormField label="Client ID" required>
        <input
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormField label="Client Secret" required>
        <SecretInput value={clientSecret} onChange={setClientSecret} />
      </FormField>
      <FormField label="Display order">
        <input
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
          type="number"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
        />
      </FormField>
      <FormActions loading={loading} onCancel={onCancel} />
    </form>
  );
}

function FormActions({ loading, onCancel }: { loading: boolean; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 pt-6 mt-2 border-t border-slate-100">
      <button
        type="submit"
        disabled={loading}
        className="px-5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-md transition-colors"
      >
        {loading ? "Adding…" : "Add"}
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 text-xs font-medium text-blue-600 hover:underline transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

// ─── Provider Picker ──────────────────────────────────────────────────────────

function ProviderCard({ p, onClick }: { p: Provider; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 p-4 bg-white border border-slate-200 rounded-lg text-left hover:border-blue-400 hover:shadow-sm transition-all group"
    >
      <div className="h-8 w-8 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors shrink-0">
        {p.icon}
      </div>
      <span className="text-[12.5px] font-medium text-slate-700 group-hover:text-blue-700 transition-colors leading-tight">
        {p.label}
      </span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IdpManager({ identityProviders, tenantSlug, onAdd, onDelete }: IdpManagerProps) {
  const [view, setView] = useState<View>("list");
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(false);

  const userDefined = PROVIDERS.filter((p) => p.section === "user-defined");
  const social = PROVIDERS.filter((p) => p.section === "social");

  const handleSelectProvider = (p: Provider) => {
    setSelectedProvider(p);
    setView("form");
  };

  const handleSubmit = async (body: Record<string, unknown>) => {
    setLoading(true);
    try {
      await onAdd(body);
      setView("list");
      setSelectedProvider(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    if (view === "form") {
      setView("picker");
      return;
    }
    setView("list");
    setSelectedProvider(null);
  };

  // ── Breadcrumb ──
  const breadcrumb = (
    <div className="flex items-center gap-1.5 text-xs mb-5">
      <button
        type="button"
        onClick={() => setView("list")}
        className="text-blue-600 hover:underline font-medium"
      >
        Identity providers
      </button>
      {(view === "picker" || view === "form") && (
        <>
          <ChevronRight size={12} className="text-slate-400" />
          <button
            type="button"
            onClick={() => setView("picker")}
            className={
              view === "picker"
                ? "text-slate-700 font-medium"
                : "text-blue-600 hover:underline font-medium"
            }
          >
            Add provider
          </button>
        </>
      )}
      {view === "form" && selectedProvider && (
        <>
          <ChevronRight size={12} className="text-slate-400" />
          <span className="text-slate-700 font-medium">{selectedProvider.label}</span>
        </>
      )}
    </div>
  );

  // ── List view ──
  if (view === "list") {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Identity providers</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Identity providers are social networks or identity brokers that allow users to
              authenticate to Keycloak.{" "}
              <a
                href="#"
                className="text-blue-600 hover:underline inline-flex items-center gap-0.5"
              >
                Learn more <ExternalLink size={10} />
              </a>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setView("picker")}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
          >
            <Plus size={13} /> Add provider
          </button>
        </div>

        {identityProviders.length === 0 ? (
          <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-lg">
            <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <KcIcon />
            </div>
            <p className="text-xs font-medium text-slate-700">No identity providers configured</p>
            <p className="text-[11px] text-slate-400 mt-1">
              Add Google, Microsoft, GitHub, SAML or OpenID Connect to enable SSO.
            </p>
            <button
              type="button"
              onClick={() => setView("picker")}
              className="mt-4 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-md transition-colors"
            >
              Add your first provider
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {identityProviders.map((idp) => {
              const meta = PROVIDERS.find((p) => p.id === idp.providerId);
              return (
                <div
                  key={idp.alias}
                  className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg bg-white"
                >
                  <div className="h-8 w-8 flex items-center justify-center text-slate-400 shrink-0">
                    {meta?.icon ?? <KcIcon />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12.5px] font-semibold text-slate-800 truncate">
                      {idp.displayName || idp.alias}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {idp.providerId} · alias: {idp.alias}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${idp.enabled !== false ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-slate-50 text-slate-500 border-slate-200"}`}
                    >
                      {idp.enabled !== false ? "Enabled" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDelete(idp.alias)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Remove provider"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Picker view ──
  if (view === "picker") {
    return (
      <div>
        {breadcrumb}
        <h2 className="text-[15px] font-semibold text-slate-900 mb-1">Add identity provider</h2>
        <p className="text-xs text-slate-500 mb-6">
          To get started, select a provider from the list below.
        </p>

        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              User-defined
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {userDefined.map((p) => (
              <ProviderCard key={p.id} p={p} onClick={() => handleSelectProvider(p)} />
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
              Social
            </span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
            {social.map((p) => (
              <ProviderCard key={p.id} p={p} onClick={() => handleSelectProvider(p)} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Form view ──
  if (view === "form" && selectedProvider) {
    return (
      <div>
        {breadcrumb}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="h-8 w-8 flex items-center justify-center text-blue-600 bg-blue-50 rounded-lg">
            {selectedProvider.icon}
          </div>
          <h2 className="text-[15px] font-semibold text-slate-900">
            Add {selectedProvider.label} provider
          </h2>
        </div>
        <div className="h-px bg-slate-200 mb-1" />

        {selectedProvider.id === "google" && (
          <GoogleForm
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
        {selectedProvider.id === "microsoft" && (
          <MicrosoftForm
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
        {selectedProvider.id === "github" && (
          <GitHubForm
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
        {selectedProvider.id === "saml" && (
          <SamlForm
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
        {(selectedProvider.id === "keycloak-oidc" || selectedProvider.id === "oidc") && (
          <OidcForm
            providerId={selectedProvider.id as "keycloak-oidc" | "oidc"}
            providerLabel={selectedProvider.label}
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
        {!["google", "microsoft", "github", "saml", "keycloak-oidc", "oidc"].includes(
          selectedProvider.id,
        ) && (
          <GenericSocialForm
            provider={selectedProvider}
            tenantSlug={tenantSlug}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            loading={loading}
          />
        )}
      </div>
    );
  }

  return null;
}

// ─── Provider Icons ───────────────────────────────────────────────────────────

function KcIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path
        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
        stroke="currentColor"
        fill="none"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function OidcIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
    </svg>
  );
}
function SamlIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 7h10M7 12h10M7 17h6" />
    </svg>
  );
}
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
function MsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20">
      <rect x="1" y="1" width="10" height="10" fill="#f25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7fba00" />
      <rect x="1" y="13" width="10" height="10" fill="#00a4ef" />
      <rect x="13" y="13" width="10" height="10" fill="#ffb900" />
    </svg>
  );
}
function GhIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
function GlIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#FC6D26">
      <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}
function FbIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
function TwIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#1DA1F2">
      <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
    </svg>
  );
}
