import { ensureFreshToken } from "../auth";

function resolveGraphqlUrl(): string {
  if (process.env.NEXT_PUBLIC_GRAPHQL_URL) {
    return process.env.NEXT_PUBLIC_GRAPHQL_URL;
  }
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";
  const base = apiUrl.replace(/\/api\/v1\/?$/, "");
  return `${base}/graphql`;
}

export const GRAPHQL_URL = resolveGraphqlUrl();

type GraphQLResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function graphqlQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const token = await ensureFreshToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (typeof window !== "undefined") {
    const slug = localStorage.getItem("tenant_slug");
    if (slug) {
      headers["x-tenant-id"] = slug;
    }
  }

  const body = JSON.stringify({ query, variables });

  const response = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers,
    body,
  });

  if (response.status === 401 && token) {
    const retryToken = await ensureFreshToken(0);
    if (retryToken && retryToken !== token) {
      headers["Authorization"] = `Bearer ${retryToken}`;
      const retryResponse = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers,
        body,
      });
      if (retryResponse.ok) {
        const result: GraphQLResponse<T> = await retryResponse.json();
        if (result.errors?.length) {
          throw new Error(result.errors[0].message);
        }
        if (!result.data) {
          throw new Error("GraphQL response missing data");
        }
        return result.data;
      }
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `GraphQL Error: ${response.status}`);
  }

  const result: GraphQLResponse<T> = await response.json();
  if (result.errors?.length) {
    throw new Error(result.errors[0].message);
  }
  if (!result.data) {
    throw new Error("GraphQL response missing data");
  }
  return result.data;
}

export const graphqlApi = {
  getHealth: () => graphqlQuery<{ health: string }>("{ health }"),

  getPlatformStats: () =>
    graphqlQuery<{ employeeCount: number; projectCount: number }>(
      `query PlatformStats {
        employeeCount
        projectCount
      }`,
    ),
};
