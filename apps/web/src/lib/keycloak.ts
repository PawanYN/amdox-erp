import Keycloak from "keycloak-js";

// Initialize Keycloak instance
// This is exactly like your React App:
const keycloak = new Keycloak({
  url: "http://localhost:8180",
  realm: "amdox-erp",
  clientId: "amdox-erp-web",
});

export default keycloak;
