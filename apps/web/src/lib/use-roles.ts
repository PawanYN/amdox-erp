"use client";

import { useEffect, useState } from "react";
import { apiClient } from "./api/client";

const WRITE_ROLES = ["SuperAdmin", "TenantAdmin", "Manager"];
const ADMIN_ROLES = ["SuperAdmin", "TenantAdmin"];

// Cached per page load so 12+ pages don't each refetch /auth/me.
let cachedRoles: string[] | null = null;

/**
 * Current user's DB roles, from the same /auth/me source the backend
 * RolesGuard uses. `canWrite` mirrors the @Roles() lists on write endpoints
 * (SuperAdmin/TenantAdmin/Manager) so Viewer users don't see buttons that
 * would only 403.
 */
export function useRoles() {
  const [roles, setRoles] = useState<string[]>(cachedRoles ?? []);
  const [loaded, setLoaded] = useState(cachedRoles !== null);

  useEffect(() => {
    if (cachedRoles !== null) return;
    apiClient("/auth/me")
      .then((me: { roles?: string[] }) => {
        cachedRoles = me?.roles ?? [];
        setRoles(cachedRoles);
      })
      .catch(() => {
        // On failure, leave roles empty: buttons hide, backend still enforces.
      })
      .finally(() => setLoaded(true));
  }, []);

  return {
    roles,
    loaded,
    canWrite: roles.some((r) => WRITE_ROLES.includes(r)),
    isAdmin: roles.some((r) => ADMIN_ROLES.includes(r)),
  };
}
