"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import keycloak from "../../lib/keycloak";
import { markAuthReady } from "../../lib/auth";

interface KeycloakContextType {
  initialized: boolean;
  authenticated: boolean;
  token: string | undefined;
  login: () => void;
  logout: () => void;
}

const KeycloakContext = createContext<KeycloakContextType>({
  initialized: false,
  authenticated: false,
  token: undefined,
  login: () => {},
  logout: () => {},
});

export const useKeycloak = () => useContext(KeycloakContext);

/** How often to proactively check token expiry (ms). */
const REFRESH_CHECK_INTERVAL_MS = 30_000;
/** Refresh when less than this many seconds remain before expiry. */
const REFRESH_MIN_VALIDITY_SEC = 70;

function hasOAuthCallback(): boolean {
  if (typeof window === "undefined") return false;
  return window.location.search.includes("code=") || window.location.hash.includes("code=");
}

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}

export function KeycloakProvider({
  children,
  requireAuth = false,
}: {
  children: ReactNode;
  requireAuth?: boolean;
}) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [token, setToken] = useState<string | undefined>(undefined);
  const isRun = useRef(false);

  const syncToken = useCallback(() => {
    setToken(keycloak?.token);
  }, []);

  const refreshToken = useCallback(async () => {
    if (!keycloak?.authenticated) return;
    try {
      const refreshed = await keycloak.updateToken(REFRESH_MIN_VALIDITY_SEC);
      if (refreshed) syncToken();
    } catch {
      console.warn("Token refresh failed — redirecting to login.");
      redirectToLogin();
    }
  }, [syncToken]);

  useEffect(() => {
    if (isRun.current) return;
    isRun.current = true;

    if (!keycloak) {
      setInitialized(true);
      markAuthReady();
      return;
    }

    const kc = keycloak;

    kc.onTokenExpired = () => {
      refreshToken();
    };

    kc.onAuthRefreshSuccess = () => {
      syncToken();
    };

    kc.onAuthRefreshError = () => {
      console.warn("Auth refresh error — redirecting to login.");
      redirectToLogin();
    };

    kc.onAuthLogout = () => {
      setAuthenticated(false);
      setToken(undefined);
    };

    kc.init({
      onLoad: "check-sso",
      checkLoginIframe: false,
      // Without this, keycloak-js's check-sso does a full top-level
      // redirect to Keycloak and back on every fresh page load — found
      // live via the Day 21 Lighthouse audit costing ~5s per navigation
      // (the "redirects" opportunity, present on every protected route).
      // Pointing it at a static page lets the check run in a hidden
      // iframe instead, with no visible navigation at all.
      silentCheckSsoRedirectUri: `${window.location.origin}/silent-check-sso.html`,
    })
      .then((auth) => {
        setAuthenticated(auth);
        if (auth) syncToken();
        setInitialized(true);
        markAuthReady();
        if (auth && hasOAuthCallback()) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        if (requireAuth && !auth && !hasOAuthCallback()) {
          redirectToLogin();
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
        setInitialized(true);
        markAuthReady();
      });

    const interval = setInterval(refreshToken, REFRESH_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [refreshToken, syncToken, requireAuth]);

  return (
    <KeycloakContext.Provider
      value={{
        initialized,
        authenticated,
        token,
        login: () => keycloak?.login(),
        logout: () => {
          if (typeof window !== "undefined") {
            localStorage.removeItem("tenant_slug");
            keycloak?.logout({
              redirectUri: `${window.location.origin}/`,
            });
          } else {
            keycloak?.logout();
          }
        },
      }}
    >
      {children}
    </KeycloakContext.Provider>
  );
}
