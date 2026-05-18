import { fetcherWithAuth } from "@/lib/api-client";
import { CONTROL_PLANE_PATH } from "@/config/api.constants";
import { MCPToolCallLog, CursorPaginationResponse, LogsFilterParams } from "../types/logs.types";

export const logsService = {
  getToolCallLogs: async (
    token: string,
    params?: LogsFilterParams,
  ): Promise<CursorPaginationResponse<MCPToolCallLog>> => {
    const queryParams: Record<string, string> = {};

    if (params?.cursor) queryParams.cursor = params.cursor;
    if (params?.mcp_tool_name) queryParams.mcp_tool_name = params.mcp_tool_name;
    if (params?.start_timestamp) queryParams.start_time = params.start_timestamp;
    if (params?.end_timestamp) queryParams.end_time = params.end_timestamp;

    return fetcherWithAuth<CursorPaginationResponse<MCPToolCallLog>>(token)(
      `${CONTROL_PLANE_PATH}/logs/tool-calls`,
      {
        params: queryParams,
      },
    );
  },
};
