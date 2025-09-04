"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ExpandableText } from "@/components/ui/expandable-text";
import { MCPToolBasic } from "../types/mcp.types";
import { ToolSchemaDrawer } from "./tool-schema-drawer";

interface ToolsTableProps {
  tools: MCPToolBasic[];
  emptyMessage?: string;
}

export function ToolsTable({
  tools,
  emptyMessage = "No tools available",
}: ToolsTableProps) {
  const [selectedTool, setSelectedTool] = useState<MCPToolBasic | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <>
      <div className="border rounded-lg">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium text-sm">Name</th>
              <th className="text-left p-3 font-medium text-sm">Description</th>
              <th className="text-center p-3 font-medium text-sm w-20">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {tools && tools.length > 0 ? (
              tools.map((tool) => (
                <tr
                  key={tool.id}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3">
                    <code className="text-sm">{tool.name}</code>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">
                    <ExpandableText
                      text={tool.description || "No description available"}
                      className="text-sm text-muted-foreground"
                      maxLines={2}
                    />
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                      onClick={() => {
                        setSelectedTool(tool);
                        setIsDrawerOpen(true);
                      }}
                    >
                      View
                    </Button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={3}
                  className="p-4 text-center text-muted-foreground"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tool Schema Drawer */}
      <ToolSchemaDrawer
        tool={selectedTool}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTool(null);
        }}
      />
    </>
  );
}
