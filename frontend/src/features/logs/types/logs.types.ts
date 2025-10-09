export enum MCPToolCallStatus {
  SUCCESS = "SUCCESS",
  ERROR = "ERROR",
}

export interface MCPToolCallLog {
  id: string;
  organization_id: string;
  user_id: string;
  request_id: string;
  session_id: string;
  bundle_name: string;
  bundle_id: string;
  mcp_server_name: string | null;
  mcp_server_id: string | null;
  mcp_tool_name: string | null;
  mcp_tool_id: string | null;
  mcp_server_configuration_name: string | null;
  mcp_server_configuration_id: string | null;
  arguments: string | null;
  result: Record<string, unknown>;
  status: MCPToolCallStatus;
  via_execute_tool: boolean;
  jsonrpc_payload: Record<string, unknown>;
  started_at: string;
  ended_at: string;
  duration_ms: number;
  created_at: string;
  updated_at: string;
}

export interface CursorPaginationResponse<T> {
  data: T[];
  next_cursor: string | null;
}

export interface LogsFilterParams {
  cursor?: string;
  mcp_tool_name?: string;
  start_timestamp?: string;
  end_timestamp?: string;
}
