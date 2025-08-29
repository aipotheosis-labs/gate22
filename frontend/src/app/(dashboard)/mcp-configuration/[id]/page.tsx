"use client";

import { useParams, useRouter } from "next/navigation";
import { useMCPServerConfiguration } from "@/features/mcp/hooks/use-mcp-servers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Copy, Check, AlertCircle } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

export default function MCPConfigurationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const configurationId = params.id as string;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const {
    data: configuration,
    isLoading,
    error,
  } = useMCPServerConfiguration(configurationId);

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    toast.success(`Copied to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

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

      {/* MCP Server Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {configuration.mcp_server.logo && (
              <Image
                src={configuration.mcp_server.logo}
                alt={configuration.mcp_server.name}
                width={48}
                height={48}
                className="rounded"
              />
            )}
            <div className="flex-1">
              <CardTitle className="text-xl">
                {configuration.mcp_server.name}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {configuration.mcp_server.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {configuration.mcp_server.categories?.map((category) => (
              <Badge key={category} variant="secondary">
                {category}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Configuration Details */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Configuration ID
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm">{configuration.id}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleCopy(configuration.id, "config-id")}
                  >
                    {copiedField === "config-id" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Organization ID
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm">
                    {configuration.organization_id}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      handleCopy(configuration.organization_id, "org-id")
                    }
                  >
                    {copiedField === "org-id" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  MCP Server ID
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <code className="text-sm">{configuration.mcp_server_id}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() =>
                      handleCopy(configuration.mcp_server_id, "server-id")
                    }
                  >
                    {copiedField === "server-id" ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Authentication Type
                </label>
                <p className="text-sm mt-1">{configuration.auth_type}</p>
              </div>

              {configuration.linked_account_id && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Linked Account ID
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm">
                      {configuration.linked_account_id}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        handleCopy(
                          configuration.linked_account_id!,
                          "linked-account",
                        )
                      }
                    >
                      {copiedField === "linked-account" ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Created At
                </label>
                <p className="text-sm mt-1">
                  {new Date(configuration.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Updated At
                </label>
                <p className="text-sm mt-1">
                  {new Date(configuration.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teams Access */}
      {configuration.allowed_teams &&
        configuration.allowed_teams.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Team Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {configuration.allowed_teams.map((team) => (
                  <div key={team.team_id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{team.name}</p>
                        {team.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {team.description}
                          </p>
                        )}
                      </div>
                      <code className="text-xs text-muted-foreground">
                        ID: {team.team_id}
                      </code>
                    </div>
                  </div>
                ))}
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
            <p className="text-sm text-muted-foreground">
              This configuration has access to all available tools from the MCP
              server.
            </p>
          ) : configuration.enabled_tools &&
            configuration.enabled_tools.length > 0 ? (
            <div className="border rounded-lg">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">
                      Tool Name
                    </th>
                    <th className="text-left p-3 text-sm font-medium">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {configuration.enabled_tools.map((tool) => (
                    <tr key={tool.id} className="border-b last:border-0">
                      <td className="p-3">
                        <code className="text-sm">{tool.name}</code>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {tool.description || "No description available"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No specific tools are enabled for this configuration.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Environment Variables */}
      {configuration.env_vars &&
        Object.keys(configuration.env_vars).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(configuration.env_vars).map(([key, value]) => (
                  <div key={key} className="border rounded-lg p-3">
                    <code className="text-sm font-medium">{key}</code>
                    <p className="text-sm text-muted-foreground mt-1 font-mono">
                      {typeof value === "string" && value.includes("***")
                        ? value
                        : "••••••••"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

      {/* Tool Configuration */}
      {configuration.tool_config &&
        Object.keys(configuration.tool_config).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Tool Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted p-4 rounded-lg overflow-x-auto">
                <code>
                  {JSON.stringify(configuration.tool_config, null, 2)}
                </code>
              </pre>
            </CardContent>
          </Card>
        )}
    </div>
  );
}
