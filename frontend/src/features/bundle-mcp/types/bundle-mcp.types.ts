export interface MCPServerBundle {
  id: string;
  name: string;
  description?: string | null;
  user_id: string;
  organization_id: string;
  mcp_server_configuration_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface MCPServerConfiguration {
  id: string;
  mcp_server_id: string;
  organization_id: string;
  auth_type: string;
  all_tools_enabled: boolean;
  enabled_tools: any[]; // Array of tool objects
  allowed_teams: string[]; // Array of team UUIDs
  created_at: string;
  updated_at: string;
  mcp_server: {
    id: string;
    name: string;
    description?: string | null;
    icon_url?: string | null;
  };
}

export interface MCPServerBundleDetailed extends Omit<MCPServerBundle, 'mcp_server_configuration_ids'> {
  mcp_server_configurations: MCPServerConfiguration[];
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
