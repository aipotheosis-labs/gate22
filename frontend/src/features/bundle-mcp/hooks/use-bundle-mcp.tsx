"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  MCPServerBundle,
  CreateMCPServerBundleInput,
} from "@/features/bundle-mcp/types/bundle-mcp.types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export function useMCPServerBundles() {
  return useQuery<MCPServerBundle[]>({
    queryKey: ["mcp-server-bundles"],
    queryFn: async () => {
      const response = await fetch(`${API_BASE_URL}/mcp-server-bundles`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch MCP server bundles");
      }
      const data = await response.json();
      return data.data || [];
    },
  });
}

export function useCreateMCPServerBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMCPServerBundleInput) => {
      const response = await fetch(`${API_BASE_URL}/mcp-server-bundles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to create MCP server bundle");
      }

      return response.json();
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (bundleId: string) => {
      const response = await fetch(
        `${API_BASE_URL}/mcp-server-bundles/${bundleId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to delete MCP server bundle");
      }

      return response.json();
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
  return useQuery<MCPServerBundle>({
    queryKey: ["mcp-server-bundles", bundleId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE_URL}/mcp-server-bundles/${bundleId}`,
        {
          credentials: "include",
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch MCP server bundle");
      }
      return response.json();
    },
    enabled: !!bundleId,
  });
}
