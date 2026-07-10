import keycloak from "./keycloak";

/** Minimum seconds of validity required before a token is considered fresh. */
const DEFAULT_MIN_VALIDITY = 30;

let authInitDone = false;
const authInitWaiters: Array<() => void> = [];

/** Called by KeycloakProvider once `init()` settles (auth or not). */
export function markAuthReady() {
  authInitDone = true;
  for (const resolve of authInitWaiters) resolve();
  authInitWaiters.length = 0;
}

/** Wait until KeycloakProvider has finished its first init pass. */
export function waitForAuthReady(): Promise<void> {
  if (authInitDone || keycloak?.authenticated) return Promise.resolve();
  return new Promise((resolve) => authInitWaiters.push(resolve));
}

/**
 * Ensures the Keycloak access token is valid for at least `minValidity` seconds.
 * Returns the current token string, or undefined if the user is not authenticated.
 */
export async function ensureFreshToken(
  minValidity = DEFAULT_MIN_VALIDITY,
): Promise<string | undefined> {
  await waitForAuthReady();
  if (!keycloak?.authenticated) return undefined;

  try {
    await keycloak.updateToken(minValidity);
    return keycloak.token;
  } catch {
    console.warn("Session expired — redirecting to login.");
    keycloak.login();
    return undefined;
  }
}

/**
 * Builds request headers with a freshly validated Bearer token and tenant slug.
 */
export async function getAuthHeaders(
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extra,
  };

  const token = await ensureFreshToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (typeof window !== "undefined") {
    const slug = localStorage.getItem("tenant_slug");
    if (slug) {
      headers["x-tenant-id"] = slug;
    }
  }

  return headers;
}
