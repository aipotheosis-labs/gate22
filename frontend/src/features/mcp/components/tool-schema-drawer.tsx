"use client";

import { MCPToolBasic } from "../types/mcp.types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code2, FileJson, Loader2, AlertCircle } from "lucide-react";
import { JsonViewer } from "./json-viewer";
import { useMCPTool } from "../hooks/use-mcp-servers";

interface ToolSchemaDrawerProps {
  tool: MCPToolBasic | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ToolSchemaDrawer({
  tool,
  isOpen,
  onClose,
}: ToolSchemaDrawerProps) {
  // Fetch full tool details including schema when drawer opens
  const { data: fullTool, isLoading, error } = useMCPTool(tool?.name || "");

  if (!tool) return null;

  const renderSchemaContent = (
    schema?: Record<string, unknown>,
    type: "input" | "output" = "input",
  ) => {
    // Show loading state while fetching
    if (isLoading) {
      return (
        <div className="py-8 rounded-lg border border-dashed bg-muted/5 flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin mb-2 text-muted-foreground/30" />
          <p className="text-xs font-medium text-center text-muted-foreground">
            Loading schema...
          </p>
        </div>
      );
    }

    // Show error state if fetch failed
    if (error) {
      return (
        <div className="py-8 rounded-lg border border-dashed bg-destructive/5 flex flex-col items-center">
          <AlertCircle className="h-8 w-8 mb-2 text-destructive/50" />
          <p className="text-xs font-medium text-center text-destructive">
            Failed to load schema
          </p>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {error instanceof Error ? error.message : "Unknown error"}
          </p>
        </div>
      );
    }

    // Only input schema is available from the API
    if (type === "output") {
      return (
        <div className="py-8 rounded-lg border border-dashed bg-muted/5">
          <FileJson className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs font-medium text-center text-muted-foreground">
            Output schema not available
          </p>
        </div>
      );
    }

    if (!schema) {
      return (
        <div className="py-8 rounded-lg border border-dashed bg-muted/5">
          <FileJson className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-xs font-medium text-center text-muted-foreground">
            No {type} schema
          </p>
        </div>
      );
    }

    return (
      <JsonViewer
        data={schema}
        title={`${type.charAt(0).toUpperCase() + type.slice(1)} Parameters`}
        className="border"
        maxHeight="400px"
        collapsed={2}
      />
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle className="text-xl font-semibold tracking-tight leading-none">
            {tool.name}
          </SheetTitle>
          {tool.description && (
            <SheetDescription className="text-sm leading-relaxed text-muted-foreground mt-2 whitespace-pre-wrap">
              {tool.description}
            </SheetDescription>
          )}
        </SheetHeader>
        <div className="p-6 pt-4">
          {/* Schema Content with Compact Tabs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-foreground/80 uppercase tracking-wider">
              Schema Definition
            </h3>

            <Tabs defaultValue="input" className="w-full">
              <TabsList className="grid w-full grid-cols-2 h-9 px-1 bg-muted/20 border">
                <TabsTrigger
                  value="input"
                  className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-muted-foreground/20 data-[state=active]:shadow-sm h-7"
                >
                  <Code2 className="h-3 w-3 mr-1.5" />
                  Input
                </TabsTrigger>
                <TabsTrigger
                  value="output"
                  className="text-xs font-medium data-[state=active]:bg-background data-[state=active]:border data-[state=active]:border-muted-foreground/20 data-[state=active]:shadow-sm h-7"
                >
                  <FileJson className="h-3 w-3 mr-1.5" />
                  Output
                </TabsTrigger>
              </TabsList>

              <TabsContent value="input" className="mt-3 space-y-3">
                {renderSchemaContent(fullTool?.input_schema, "input")}
              </TabsContent>

              <TabsContent value="output" className="mt-3 space-y-3">
                {renderSchemaContent(undefined, "output")}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
