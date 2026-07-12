import { apiClient } from "./client";

export type SearchVendorHit = {
  id: string;
  name: string;
  email?: string | null;
  tenantId?: string;
};

export type SearchProductHit = {
  id: string;
  name: string;
  sku?: string | null;
  tenantId?: string;
};

export type SearchResponse = {
  vendors: SearchVendorHit[];
  products: SearchProductHit[];
};

export const searchApi = {
  search: (q: string, limit = 20): Promise<SearchResponse> =>
    apiClient(`/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  reindex: () => apiClient("/search/reindex", { method: "POST" }),
};
