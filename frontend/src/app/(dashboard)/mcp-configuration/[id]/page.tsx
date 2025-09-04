"use client";

import { useParams, useRouter } from "next/navigation";
import {
  useMCPServerConfiguration,
  useMCPServer,
} from "@/features/mcp/hooks/use-mcp-servers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import Image from "next/image";
import { ToolsTable } from "@/features/mcp/components/tools-table";
import { useRole } from "@/hooks/use-permissions";

export default function MCPConfigurationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configurationId = params.id as string;
  const { isAdmin, isActingAsMember } = useRole();
  const shouldShowAdminLink = isAdmin && !isActingAsMember;

  const {
    data: configuration,
    isLoading,
    error,
  } = useMCPServerConfiguration(configurationId);

  // Fetch full server data when all_tools_enabled is true to get the tools list
  const { data: serverData } = useMCPServer(
    configuration?.all_tools_enabled ? configuration.mcp_server_id : "",
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !configuration) {
    return (
      <div className="container max-w-5xl mx-auto p-6">
        <Button
          variant="outline"
          onClick={() => router.push("/mcp-configuration")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Configurations
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load configuration details</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => router.push("/mcp-configuration")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Configurations
        </Button>
        <Badge variant="outline" className="text-sm">
          Active Configuration
        </Badge>
      </div>

      {/* Configuration Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <div className="flex flex-col items-center gap-2">
              {configuration.mcp_server.logo && (
                <Image
                  src={configuration.mcp_server.logo}
                  alt={configuration.mcp_server.name}
                  width={48}
                  height={48}
                  className="rounded"
                />
              )}
              {shouldShowAdminLink ? (
                <Button
                  variant="link"
                  className="h-auto p-0 text-xs"
                  onClick={() =>
                    router.push(`/mcp-servers/${configuration.mcp_server_id}`)
                  }
                >
                  {configuration.mcp_server.name}
                </Button>
              ) : (
                <span className="text-xs text-center">
                  {configuration.mcp_server.name}
                </span>
              )}
            </div>
            <div className="flex-1">
              <CardTitle className="text-2xl">{configuration.name}</CardTitle>
              {configuration.description && (
                <p className="text-sm text-muted-foreground mt-2">
                  {configuration.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="border-t pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Authentication Type
              </label>
              <p className="text-sm mt-1 font-medium">
                {configuration.auth_type}
              </p>
            </div>

            {configuration.created_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created At
                </label>
                <p className="text-sm mt-1">
                  {new Date(configuration.created_at).toLocaleString()}
                </p>
              </div>
            )}

            {configuration.updated_at && (
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Updated At
                </label>
                <p className="text-sm mt-1">
                  {new Date(configuration.updated_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enabled Teams */}
      {configuration.allowed_teams &&
        configuration.allowed_teams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Enabled Teams</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 text-sm font-medium">
                        Team Name
                      </th>
                      <th className="text-center p-3 text-sm font-medium w-20">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {configuration.allowed_teams.map((team) => (
                      <tr key={team.team_id} className="border-b last:border-0">
                        <td className="p-3">
                          <code className="text-sm">{team.name}</code>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() =>
                              router.push(`/settings/teams/${team.team_id}`)
                            }
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

      {/* Enabled Tools */}
      <Card>
        <CardHeader>
          <CardTitle>
            Enabled Tools
            {configuration.all_tools_enabled && (
              <Badge className="ml-2" variant="secondary">
                All Tools Enabled
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {configuration.all_tools_enabled ? (
            serverData?.tools && serverData.tools.length > 0 ? (
              <ToolsTable
                tools={serverData.tools}
                emptyMessage="This configuration has access to all available tools from the MCP server."
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This configuration has access to all available tools from the
                MCP server.
              </p>
            )
          ) : configuration.enabled_tools &&
            configuration.enabled_tools.length > 0 ? (
            <ToolsTable
              tools={configuration.enabled_tools}
              emptyMessage="No specific tools are enabled for this configuration."
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No specific tools are enabled for this configuration.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
