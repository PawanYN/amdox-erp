import keycloak from "../keycloak";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (keycloak && keycloak.token) {
    try {
      // Refresh token if it will expire within 30 seconds
      await keycloak.updateToken(30);
    } catch (err) {
      console.warn("Failed to refresh token or session expired. Prompting re-login.");
      keycloak.login();
    }
    headers["Authorization"] = `Bearer ${keycloak.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  // Handle empty responses (like 204 or some patches)
  const text = await response.text();
  return text ? JSON.parse(text) : {};
}
