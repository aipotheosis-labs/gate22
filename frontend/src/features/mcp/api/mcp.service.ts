import {
  fetcher,
  fetcherWithAuth,
  createAuthenticatedRequest,
} from "@/lib/api-client";
import {
  MCPServerPublic,
  MCPServerConfigurationPublic,
  MCPServerConfigurationPublicBasic,
  MCPServerConfigurationCreate,
  MCPToolPublic,
  PaginationParams,
  PaginationResponse,
} from "../types/mcp.types";

const API_ENDPOINTS = {
  SERVERS: "/v1/mcp-servers",
  CONFIGURATIONS: "/v1/mcp-server-configurations",
  TOOLS: "/v1/mcp-tools",
};

export const mcpService = {
  // MCP Tools endpoints
  tools: {
    getByName: async (
      token: string,
      toolName: string,
    ): Promise<MCPToolPublic> => {
      return fetcherWithAuth<MCPToolPublic>(token)(
        `${API_ENDPOINTS.TOOLS}/${toolName}`,
      );
    },
  },

  // MCP Servers endpoints
  servers: {
    list: async (
      params?: PaginationParams,
    ): Promise<PaginationResponse<MCPServerPublic>> => {
      return fetcher<PaginationResponse<MCPServerPublic>>(
        API_ENDPOINTS.SERVERS,
        {
          params: {
            offset: params?.offset?.toString() || "0",
            limit: params?.limit?.toString() || "10",
          },
        },
      );
    },

    getById: async (
      token: string,
      serverId: string,
    ): Promise<MCPServerPublic> => {
      return fetcherWithAuth<MCPServerPublic>(token)(
        `${API_ENDPOINTS.SERVERS}/${serverId}`,
      );
    },

    getByName: async (
      serverName: string,
    ): Promise<MCPServerPublic | undefined> => {
      // This would need a search endpoint on the backend
      // For now, fetch all and filter client-side
      const response = await fetcher<PaginationResponse<MCPServerPublic>>(
        API_ENDPOINTS.SERVERS,
        {
          params: {
            offset: "0",
            limit: "100",
          },
        },
      );
      return response.data.find(
        (s) => s.name.toLowerCase() === serverName.toLowerCase(),
      );
    },
  },

  // MCP Server Configurations endpoints (requires auth)
  configurations: {
    list: async (
      token: string,
      params?: PaginationParams,
    ): Promise<PaginationResponse<MCPServerConfigurationPublicBasic>> => {
      return fetcherWithAuth<
        PaginationResponse<MCPServerConfigurationPublicBasic>
      >(token)(API_ENDPOINTS.CONFIGURATIONS, {
        params: {
          offset: params?.offset?.toString() || "0",
          limit: params?.limit?.toString() || "10",
        },
      });
    },

    getById: async (
      token: string,
      configurationId: string,
    ): Promise<MCPServerConfigurationPublic> => {
      return fetcherWithAuth<MCPServerConfigurationPublic>(token)(
        `${API_ENDPOINTS.CONFIGURATIONS}/${configurationId}`,
      );
    },

    create: async (
      token: string,
      data: MCPServerConfigurationCreate,
    ): Promise<MCPServerConfigurationPublic> => {
      const api = createAuthenticatedRequest(token);
      return api.post<MCPServerConfigurationPublic>(
        API_ENDPOINTS.CONFIGURATIONS,
        data,
      );
    },

    delete: async (token: string, configurationId: string): Promise<void> => {
      const api = createAuthenticatedRequest(token);
      return api.delete(`${API_ENDPOINTS.CONFIGURATIONS}/${configurationId}`);
    },
  },
};
