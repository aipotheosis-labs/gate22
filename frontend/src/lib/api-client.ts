import {
  useQuery,
  useMutation,
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query";
import { tokenManager } from "./token-manager";

// Get API base URL from environment
export const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

// Generic fetcher function with automatic token refresh
export async function fetcher<T = unknown>(
  endpoint: string,
  options?: RequestInit & { params?: Record<string, string> },
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  let url = `${baseUrl}${endpoint}`;

  // Add query parameters if provided
  if (options?.params) {
    const searchParams = new URLSearchParams(options.params);
    url += `?${searchParams.toString()}`;
  }

  const makeRequest = async (token?: string) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };

  let response = await makeRequest();

  // If unauthorized and we haven't provided a token, try to get one
  const headersRecord = options?.headers as Record<string, string> | undefined;
  if (response.status === 401 && !headersRecord?.["Authorization"]) {
    try {
      const token = await tokenManager.refreshAccessToken();
      if (token) {
        response = await makeRequest(token);
      }
    } catch {
      // Token refresh failed, proceed with original response
    }
  }

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `Request failed: ${response.status}`);
  }

  // Handle empty responses (204 No Content)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

// Fetcher with authentication and automatic token refresh
export function fetcherWithAuth<T = unknown>(token?: string) {
  return async (
    endpoint: string,
    options?: RequestInit & { params?: Record<string, string> },
  ): Promise<T> => {
    // Get valid token (refresh if needed)
    const validToken = token || (await tokenManager.ensureValidToken());

    if (!validToken) {
      throw new Error("No valid authentication token");
    }

    const baseUrl = getApiBaseUrl();
    let url = `${baseUrl}${endpoint}`;

    // Add query parameters if provided
    if (options?.params) {
      const searchParams = new URLSearchParams(options.params);
      url += `?${searchParams.toString()}`;
    }

    const makeRequest = async (authToken: string) => {
      return fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...options?.headers,
          Authorization: `Bearer ${authToken}`,
        },
      });
    };

    let response = await makeRequest(validToken);

    // If unauthorized, try to refresh token and retry once
    if (response.status === 401) {
      try {
        const newToken = await tokenManager.refreshAccessToken();
        if (newToken) {
          response = await makeRequest(newToken);
        } else {
          // No valid token after refresh
          const errorText = await response.text();
          throw new Error(errorText || "Unauthorized");
        }
      } catch {
        // Token refresh failed, throw original error
        const errorText = await response.text();
        throw new Error(errorText || "Unauthorized");
      }
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Request failed: ${response.status}`);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return response.json();
  };
}

// Custom hook for API queries
export function useApiQuery<T = unknown>(
  key: string | string[],
  endpoint: string,
  token?: string,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
) {
  const queryKey = Array.isArray(key) ? key : [key];

  return useQuery<T>({
    queryKey,
    queryFn: () => {
      if (token) {
        return fetcherWithAuth<T>(token)(endpoint);
      }
      return fetcher<T>(endpoint);
    },
    ...options,
  });
}

// Custom hook for API mutations
export function useApiMutation<TData = unknown, TVariables = unknown>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseMutationOptions<TData, Error, TVariables>,
) {
  return useMutation<TData, Error, TVariables>({
    mutationFn,
    ...options,
  });
}

// Helper to create authenticated API calls
export const createAuthenticatedRequest = (token?: string) => ({
  get: <T = unknown>(endpoint: string, params?: Record<string, string>) =>
    fetcherWithAuth<T>(token)(endpoint, { method: "GET", params }),

  post: <T = unknown>(endpoint: string, data?: unknown) =>
    fetcherWithAuth<T>(token)(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, data?: unknown) =>
    fetcherWithAuth<T>(token)(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T = unknown>(endpoint: string, data?: unknown) =>
    fetcherWithAuth<T>(token)(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T = unknown>(endpoint: string) =>
    fetcherWithAuth<T>(token)(endpoint, { method: "DELETE" }),
});
