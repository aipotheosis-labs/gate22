import { MCPServerConfigurationBasic } from "./mcp-server-configuration.types";

export type LinkedAccount = {
  id: string;
  user_id: string;
  mcp_server_configuration_id: string;
  created_at: string;
  updated_at: string;
  mcp_server_configuration: MCPServerConfigurationBasic;
};
