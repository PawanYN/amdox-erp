"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import keycloak from "../lib/keycloak";

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

export function KeycloakProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const isRun = useRef(false);

  useEffect(() => {
    // Prevent strict-mode double-initialization
    if (isRun.current) return;
    isRun.current = true;

    // Use onLoad: 'check-sso' so the landing page stays public!
    if (!keycloak) {
      setInitialized(true);
      return;
    }

    keycloak
      .init({ onLoad: "check-sso" })
      .then((auth) => {
        setAuthenticated(auth);
        setInitialized(true);
        if (auth && window.location.search.includes('code=')) {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      })
      .catch((err) => {
        console.error("Keycloak initialization failed", err);
        setInitialized(true);
      });
  }, []);

  return (
    <KeycloakContext.Provider
      value={{
        initialized,
        authenticated,
        token: keycloak?.token,
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
