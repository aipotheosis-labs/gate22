export interface MCPServerBundle {
  id: string;
  name: string;
  description?: string | null;
  user_id: string;
  mcp_server_configuration_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateMCPServerBundleInput {
  name: string;
  description?: string | null;
  mcp_server_configuration_ids: string[];
}

export interface UpdateMCPServerBundleInput {
  name?: string;
  description?: string | null;
  mcp_server_configuration_ids?: string[];
}
