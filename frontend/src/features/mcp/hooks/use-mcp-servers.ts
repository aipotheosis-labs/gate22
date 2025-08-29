import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mcpService } from "../api/mcp.service";
import {
  MCPServerConfigurationCreate,
  PaginationParams,
} from "../types/mcp.types";
import { useMetaInfo } from "@/components/context/metainfo";

// Query keys
export const mcpQueryKeys = {
  all: ["mcp"] as const,
  servers: {
    all: ["mcp", "servers"] as const,
    list: (params?: PaginationParams) =>
      ["mcp", "servers", "list", params] as const,
    detail: (id: string) => ["mcp", "servers", "detail", id] as const,
    byName: (name: string) => ["mcp", "servers", "byName", name] as const,
  },
  configurations: {
    all: ["mcp", "configurations"] as const,
    list: (params?: PaginationParams) =>
      ["mcp", "configurations", "list", params] as const,
    detail: (id: string) => ["mcp", "configurations", "detail", id] as const,
  },
};

// Hook to list all available MCP servers
export function useMCPServers(params?: PaginationParams) {
  return useQuery({
    queryKey: mcpQueryKeys.servers.list(params),
    queryFn: () => mcpService.servers.list(params),
  });
}

// Hook to get a specific MCP server by ID
export function useMCPServer(serverId: string) {
  const { accessToken } = useMetaInfo();

  return useQuery({
    queryKey: mcpQueryKeys.servers.detail(serverId),
    queryFn: () => mcpService.servers.getById(accessToken!, serverId),
    enabled: !!accessToken && !!serverId,
  });
}

// Hook to get a specific MCP server by name
export function useMCPServerByName(serverName: string) {
  return useQuery({
    queryKey: mcpQueryKeys.servers.byName(serverName),
    queryFn: () => mcpService.servers.getByName(serverName),
    enabled: !!serverName,
  });
}

// Hook to list MCP server configurations for the current organization
export function useMCPServerConfigurations(params?: PaginationParams) {
  const { accessToken } = useMetaInfo();

  return useQuery({
    queryKey: mcpQueryKeys.configurations.list(params),
    queryFn: () => mcpService.configurations.list(accessToken!, params),
    enabled: !!accessToken,
  });
}

// Hook to get a specific MCP server configuration
export function useMCPServerConfiguration(configurationId: string) {
  const { accessToken } = useMetaInfo();

  return useQuery({
    queryKey: mcpQueryKeys.configurations.detail(configurationId),
    queryFn: () =>
      mcpService.configurations.getById(accessToken!, configurationId),
    enabled: !!accessToken && !!configurationId,
  });
}

// Hook to create a new MCP server configuration
export function useCreateMCPServerConfiguration() {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: MCPServerConfigurationCreate) =>
      mcpService.configurations.create(accessToken!, data),
    onSuccess: () => {
      // Invalidate configurations list to refetch
      queryClient.invalidateQueries({
        queryKey: mcpQueryKeys.configurations.all,
      });
    },
  });
}

// Hook to delete an MCP server configuration
export function useDeleteMCPServerConfiguration() {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configurationId: string) =>
      mcpService.configurations.delete(accessToken!, configurationId),
    onSuccess: () => {
      // Invalidate configurations list to refetch
      queryClient.invalidateQueries({
        queryKey: mcpQueryKeys.configurations.all,
      });
    },
  });
}
