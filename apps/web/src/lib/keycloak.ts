import Keycloak from "keycloak-js";

const isClient = typeof window !== "undefined";

const getRealm = () => {
  if (!isClient) return "amdox-erp";
  return localStorage.getItem("tenant_slug") || "amdox-erp";
};

const keycloak = isClient
  ? new Keycloak({
      url: "http://localhost:8180",
      realm: getRealm(),
      clientId: "amdox-erp-web",
    })
  : null;

export default keycloak;
