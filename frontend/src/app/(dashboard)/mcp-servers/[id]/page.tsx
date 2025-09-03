"use client";

import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Shield, Wrench, Loader2, Plus } from "lucide-react";
import Image from "next/image";
import { useMCPServer } from "@/features/mcp/hooks/use-mcp-servers";
import { useState } from "react";
import { MCPServerConfigurationStepper } from "@/features/mcp/components/mcp-server-configuration-stepper";
import { ToolSchemaDrawer } from "@/features/mcp/components/tool-schema-drawer";
import { MCPToolBasic } from "@/features/mcp/types/mcp.types";
import { PermissionGuard } from "@/components/rbac/permission-guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default function MCPServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<MCPToolBasic | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Fetch server data using the new hook
  const { data: server, isLoading, error } = useMCPServer(serverId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !server) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Server Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The MCP server could not be found.
          </p>
          <Button variant="outline" onClick={() => router.push("/mcp-servers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to MCP Servers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back Button */}
      <Button
        variant="outline"
        onClick={() => router.push("/mcp-servers")}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to MCP Servers
      </Button>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg">
            <Image
              src={server.logo}
              alt={`${server.name} logo`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{server.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {server.supported_auth_types &&
                server.supported_auth_types.length > 0 && (
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>{server.supported_auth_types.join(", ")}</span>
                  </div>
                )}
            </div>
          </div>
        </div>
        <PermissionGuard permission={PERMISSIONS.MCP_CONFIGURATION_CREATE}>
          <Button onClick={() => setIsConfigModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Configure Server
          </Button>
        </PermissionGuard>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-6">{server.description}</p>

      <Separator className="mb-4" />

      {/* Categories */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {server.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-sm">
              {category}
            </Badge>
          ))}
        </div>
      </div>

      <Separator className="mb-4" />

      {/* Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5" />
          <h2 className="text-lg font-semibold">
            Available Tools ({server.tools?.length || 0})
          </h2>
        </div>
        <div className="rounded-lg border">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left p-2 font-medium text-sm">Name</th>
                <th className="text-left p-2 font-medium text-sm">
                  Description
                </th>
                <th className="text-center p-2 font-medium text-sm w-20">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {server.tools && server.tools.length > 0 ? (
                server.tools.map((tool) => (
                  <tr
                    key={tool.id}
                    className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-2 font-medium text-sm">{tool.name}</td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {tool.description || "No description available"}
                    </td>
                    <td className="p-2 text-center">
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
                    No tools available for this server
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Configuration Stepper */}
      {server && (
        <MCPServerConfigurationStepper
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          server={server}
        />
      )}

      {/* Tool Schema Drawer */}
      <ToolSchemaDrawer
        tool={selectedTool}
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedTool(null);
        }}
      />
    </div>
  );
}
