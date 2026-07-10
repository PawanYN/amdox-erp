import { ensureFreshToken } from "../auth";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = await ensureFreshToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && token) {
    const retryToken = await ensureFreshToken(0);
    if (retryToken && retryToken !== token) {
      headers["Authorization"] = `Bearer ${retryToken}`;
      const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });
      if (retryResponse.ok) {
        const text = await retryResponse.text();
        return text ? JSON.parse(text) : {};
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

/** Fetch a binary response (e.g. PDF) with auth headers. */
export async function apiBlobClient(endpoint: string): Promise<Blob> {
  const headers: Record<string, string> = {};
  const token = await ensureFreshToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }
  return response.blob();
}
