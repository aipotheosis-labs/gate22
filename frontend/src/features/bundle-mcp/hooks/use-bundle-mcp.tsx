"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";
import { throwApiError } from "@/lib/api-error-handler";
import {
  MCPServerBundle,
  MCPServerBundleDetailed,
  CreateMCPServerBundleInput,
} from "@/features/bundle-mcp/types/bundle-mcp.types";

const getApiBaseUrl = () => {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
};

interface PaginatedResponse<T> {
  data: T[];
  offset: number;
  limit?: number;
  total?: number;
}

export function useMCPServerBundles() {
  const { accessToken } = useMetaInfo();

  return useQuery<MCPServerBundle[]>({
    queryKey: ["mcp-server-bundles"],
    queryFn: async () => {
      const response = await fetch(
        `${getApiBaseUrl()}/v1/control-plane/mcp-server-bundles?limit=100`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        },
      );
      if (!response.ok) {
        await throwApiError(response, "Failed to fetch MCP server bundles");
      }
      const result: PaginatedResponse<MCPServerBundle> = await response.json();
      return result.data || [];
    },
    enabled: !!accessToken,
  });
}

export function useCreateMCPServerBundle() {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMCPServerBundleInput) => {
      if (!accessToken) {
        throw new Error("Authentication required. Please log in.");
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/v1/control-plane/mcp-server-bundles`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(data),
            credentials: "include",
          },
        );

        if (!response.ok) {
          await throwApiError(response, "Failed to create MCP server bundle");
        }

        return response.json();
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error(
            "Network error: Unable to connect to the server. Please check your connection.",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-server-bundles"] });
      toast.success("MCP server bundle created successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create MCP server bundle");
    },
  });
}

export function useDeleteMCPServerBundle() {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bundleId: string) => {
      if (!accessToken) {
        throw new Error("Authentication required. Please log in.");
      }

      try {
        const response = await fetch(
          `${getApiBaseUrl()}/v1/control-plane/mcp-server-bundles/${bundleId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            credentials: "include",
          },
        );

        if (!response.ok) {
          await throwApiError(response, "Failed to delete MCP server bundle");
        }

        // Handle empty response (204 No Content) or other successful responses
        if (
          response.status === 204 ||
          response.headers.get("content-length") === "0"
        ) {
          return null;
        }

        try {
          return await response.json();
        } catch {
          // If parsing fails but response was ok, return null
          return null;
        }
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error(
            "Network error: Unable to connect to the server. Please check your connection.",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-server-bundles"] });
      toast.success("MCP server bundle deleted successfully");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to delete MCP server bundle");
    },
  });
}

export function useMCPServerBundle(bundleId: string) {
  const { accessToken } = useMetaInfo();

  return useQuery<MCPServerBundleDetailed>({
    queryKey: ["mcp-server-bundles", bundleId],
    queryFn: async () => {
      const response = await fetch(
        `${getApiBaseUrl()}/v1/control-plane/mcp-server-bundles/${bundleId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: "include",
        },
      );
      if (!response.ok) {
        await throwApiError(response, "Failed to fetch MCP server bundle");
      }
      return response.json();
    },
    enabled: !!accessToken && !!bundleId,
  });
}
