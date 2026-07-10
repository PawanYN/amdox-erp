"use client";

import { useEffect } from "react";
import { markAuthReady } from "@/lib/auth";

/** Public auth routes have no KeycloakProvider; unblock apiClient waits. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    markAuthReady();
  }, []);

  return children;
}
