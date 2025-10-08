import { useInfiniteQuery, type QueryFunctionContext } from "@tanstack/react-query";
import { tokenManager } from "@/lib/token-manager";
import { logsService } from "../api/logs.service";
import type { LogsFilterParams } from "../types/logs.types";
import type { CursorPaginationResponse, MCPToolCallLog } from "../types/logs.types";

import { InfiniteData } from "@tanstack/react-query";
type LogsPage = CursorPaginationResponse<MCPToolCallLog>;
type LogsFilters = Omit<LogsFilterParams, "cursor">;
type LogsQueryKey = ["logs", "tool-calls", LogsFilters | undefined];

export const useLogs = (filters?: LogsFilters) => {
  return useInfiniteQuery<
    LogsPage, // TQueryFnData
    Error, // TError
    InfiniteData<LogsPage, string | undefined>, // TData
    LogsQueryKey, // TQueryKey
    string | undefined // TPageParam
  >({
    queryKey: ["logs", "tool-calls", filters],
    initialPageParam: undefined,
    queryFn: async ({ pageParam }: QueryFunctionContext<LogsQueryKey, string | undefined>) => {
      const token = await tokenManager.getAccessToken();
      if (!token) throw new Error("No authentication token available");

      return logsService.getToolCallLogs(token, {
        ...filters,
        cursor: pageParam,
      });
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });
};
