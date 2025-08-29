export enum AuthType {
  OAUTH = "OAUTH",
  API_KEY = "API_KEY",
  BASIC = "BASIC",
  NONE = "NONE",
}

export interface AuthConfig {
  type: AuthType;
  [key: string]: unknown;
}

export interface MCPServerMetadata {
  need_session: boolean;
}

export interface MCPToolPublic {
  id: string;
  name: string;
  description: string;
  input_schema?: Record<string, unknown>;
  output_schema?: Record<string, unknown>;
  mcp_server_id: string;
  created_at: string;
  updated_at: string;
}

export interface MCPServerPublicBasic {
  id: string;
  name: string;
  url: string;
  description: string;
  logo: string;
  categories: string[];
}

export interface MCPServerPublic extends MCPServerPublicBasic {
  supported_auth_types: AuthType[];
  tools: MCPToolPublic[];
  created_at: string;
  updated_at: string;
}

export interface TeamInfo {
  team_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface MCPServerConfigurationCreate {
  mcp_server_id: string;
  auth_type: AuthType;
  all_tools_enabled: boolean;
  enabled_tools: string[];
  allowed_teams: string[];
}

export interface MCPServerConfigurationPublic {
  id: string;
  mcp_server_id: string;
  organization_id: string;
  auth_type: AuthType;
  all_tools_enabled: boolean;
  enabled_tools: MCPToolPublic[];
  allowed_teams: TeamInfo[];
  created_at: string;
  updated_at: string;
  mcp_server: MCPServerPublicBasic;
}

export interface MCPServerConfigurationPublicBasic {
  id: string;
  mcp_server_id: string;
  mcp_server: MCPServerPublicBasic;
  created_at: string;
  updated_at: string;
}

export interface PaginationParams {
  offset?: number;
  limit?: number;
}

export interface PaginationResponse<T> {
  data: T[];
  offset: number;
  total?: number;
}
