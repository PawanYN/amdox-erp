import Keycloak from "keycloak-js";

const isClient = typeof window !== "undefined";

const getRealm = () => {
  if (!isClient) return "amdox-erp";
  return localStorage.getItem("tenant_slug") || "amdox-erp";
};

const keycloak = isClient
  ? new Keycloak({
      url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8180",
      realm: getRealm(),
      clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "amdox-erp-web",
    })
  : null;

export default keycloak;
