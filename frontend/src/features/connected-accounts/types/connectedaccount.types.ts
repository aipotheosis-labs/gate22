import { MCPServerConfigurationBasic } from "./mcp-server-configuration.types";

export type ConnectedAccount = {
  id: string;
  user_id: string;
  mcp_server_configuration_id: string;
  created_at: string;
  updated_at: string;
  last_used_at?: string;
  mcp_server_configuration: MCPServerConfigurationBasic;
};
