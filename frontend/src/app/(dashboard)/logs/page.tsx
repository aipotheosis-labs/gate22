"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Search, ChevronDown, ChevronUp } from "lucide-react";
import { DateRange } from "react-day-picker";
import { useLogs } from "@/features/logs/hooks/use-logs";
import { MCPToolCallLog, MCPToolCallStatus } from "@/features/logs/types/logs.types";
import { cn } from "@/lib/utils";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export default function LogsPage() {
  const [mcpToolNameFilter, setMcpToolNameFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [appliedFilters, setAppliedFilters] = useState<{
    mcp_tool_name?: string;
    start_timestamp?: string;
    end_timestamp?: string;
  }>({});

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, error } = useLogs({
    mcp_tool_name: appliedFilters.mcp_tool_name,
    start_timestamp: appliedFilters.start_timestamp,
    end_timestamp: appliedFilters.end_timestamp,
  });

  const observerTarget = useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  // Flatten all pages into a single array
  const allLogs = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  const handleApplyFilters = () => {
    setAppliedFilters({
      mcp_tool_name: mcpToolNameFilter || undefined,
      start_timestamp: dateRange?.from?.toISOString() || undefined,
      end_timestamp: dateRange?.to?.toISOString() || undefined,
    });
  };

  const handleResetFilters = () => {
    setMcpToolNameFilter("");
    setDateRange(undefined);
    setAppliedFilters({});
  };

  const getStatusColor = (status: MCPToolCallStatus) => {
    switch (status) {
      case MCPToolCallStatus.SUCCESS:
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case MCPToolCallStatus.ERROR:
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b px-6 py-4">
        <h2 className="text-2xl font-bold">Logs</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Filters - Horizontal Layout */}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Tool call"
                value={mcpToolNameFilter}
                onChange={(e) => setMcpToolNameFilter(e.target.value)}
                className="h-9 pl-9"
              />
            </div>
          </div>

          <div className="min-w-[300px]">
            <DateRangePicker
              date={dateRange}
              onDateChange={setDateRange}
              placeholder="Select date range"
            />
          </div>

          <Button onClick={handleApplyFilters} size="sm" className="h-9">
            Apply
          </Button>
          <Button variant="outline" onClick={handleResetFilters} size="sm" className="h-9">
            Reset
          </Button>

          {!isLoading && (
            <span className="ml-auto text-sm text-muted-foreground">
              {allLogs.length} result{allLogs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="py-12 text-center">
            <p className="text-red-500">Failed to load logs. Please try again.</p>
          </div>
        )}

        {/* Logs List */}
        {!isLoading && !error && (
          <div className="space-y-0">
            {/* Column Headers */}
            <div className="grid grid-cols-[100px_180px_200px_1fr_1fr_100px_150px_40px] gap-4 border-b bg-muted/50 px-2 py-2 text-xs font-medium text-muted-foreground">
              <div>Status</div>
              <div>MCP Server</div>
              <div>MCP Tool</div>
              <div>Arguments</div>
              <div>Result</div>
              <div>Duration</div>
              <div>Started At</div>
              <div></div>
            </div>

            {allLogs.map((log) => (
              <LogRow
                key={log.id}
                log={log}
                getStatusColor={getStatusColor}
                formatDate={formatDate}
              />
            ))}

            {/* Empty state */}
            {allLogs.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No logs found matching your criteria.</p>
              </div>
            )}

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-4">
              {isFetchingNextPage && (
                <div className="flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LogRow({
  log,
  getStatusColor,
  formatDate,
}: {
  log: MCPToolCallLog;
  getStatusColor: (status: MCPToolCallStatus) => string;
  formatDate: (dateString: string) => string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const truncateText = (text: string | null | undefined, maxLength: number = 50) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const formatArguments = (args: string | null) => {
    if (!args) return "-";
    try {
      const parsed = JSON.parse(args);
      return truncateText(JSON.stringify(parsed), 80);
    } catch {
      return truncateText(args, 80);
    }
  };

  const formatResult = (result: Record<string, unknown>) => {
    if (!result || Object.keys(result).length === 0) return "-";
    const resultStr = JSON.stringify(result);
    return truncateText(resultStr, 80);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-b transition-colors hover:bg-muted/50">
        <CollapsibleTrigger className="w-full text-left">
          <div className="grid grid-cols-[100px_180px_200px_1fr_1fr_100px_150px_40px] items-center gap-4 px-2 py-3">
            {/* Status Column */}
            <div>
              <Badge className={cn("shrink-0 border text-xs", getStatusColor(log.status))}>
                {log.status}
              </Badge>
            </div>

            {/* MCP Server Column */}
            <div className="truncate text-sm">{log.mcp_server_name || "-"}</div>

            {/* MCP Tool Column */}
            <div className="truncate text-sm font-medium">{log.mcp_tool_name || "-"}</div>

            {/* Arguments Column */}
            <div className="truncate font-mono text-xs text-muted-foreground">
              {formatArguments(log.arguments)}
            </div>

            {/* Result Column */}
            <div className="truncate font-mono text-xs text-muted-foreground">
              {formatResult(log.result)}
            </div>

            {/* Duration Column */}
            <div className="text-sm text-muted-foreground">{log.duration_ms}ms</div>

            {/* Started At Column */}
            <div className="text-sm text-muted-foreground">{formatDate(log.started_at)}</div>

            {/* Expand Icon Column */}
            <div className="flex items-center justify-center">
              {isOpen ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-3 border-t bg-muted/20 p-4">
            <div className="grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="font-medium text-muted-foreground">Request ID:</span>
                  <p className="mt-1 font-mono text-xs">{log.request_id}</p>
                </div>

                <div>
                  <span className="font-medium text-muted-foreground">Session ID:</span>
                  <p className="mt-1 font-mono text-xs">{log.session_id}</p>
                </div>
              </div>

              {log.mcp_server_configuration_name && (
                <div>
                  <span className="font-medium text-muted-foreground">Configuration:</span>
                  <p className="mt-1">{log.mcp_server_configuration_name}</p>
                </div>
              )}

              {log.arguments && (
                <div>
                  <span className="font-medium text-muted-foreground">Arguments:</span>
                  <pre className="mt-1 overflow-x-auto rounded bg-background p-2 font-mono text-xs">
                    {log.arguments}
                  </pre>
                </div>
              )}

              <div>
                <span className="font-medium text-muted-foreground">Result:</span>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-background p-2 font-mono text-xs">
                  {JSON.stringify(log.result, null, 2)}
                </pre>
              </div>

              <div>
                <span className="font-medium text-muted-foreground">JSONRPC Payload:</span>
                <pre className="mt-1 max-h-48 overflow-auto rounded bg-background p-2 font-mono text-xs">
                  {JSON.stringify(log.jsonrpc_payload, null, 2)}
                </pre>
              </div>

              <div className="grid grid-cols-4 gap-3 pt-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Started At:</span>
                  <p className="mt-1">{formatDate(log.started_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Ended At:</span>
                  <p className="mt-1">{formatDate(log.ended_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Created At:</span>
                  <p className="mt-1">{formatDate(log.created_at)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated At:</span>
                  <p className="mt-1">{formatDate(log.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
