"use client";

import { useParams, useRouter } from "next/navigation";
import { mcpIntegrations } from "@/data/mcp-integrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Shield, Wrench } from "lucide-react";
import Image from "next/image";

export default function MCPServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverName = decodeURIComponent(params.name as string);

  const server = mcpIntegrations.find((mcp) => mcp.name === serverName);

  if (!server) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-2">Server Not Found</h2>
          <p className="text-muted-foreground mb-4">
            The MCP server &quot;{serverName}&quot; could not be found.
          </p>
          <Button onClick={() => router.push("/mcp-servers")}>
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
        variant="ghost"
        size="sm"
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
              src={server.iconUrl}
              alt={`${server.name} logo`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{server.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>by {server.provider}</span>
              {server.authType && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Shield className="h-3 w-3" />
                    <span>{server.authType}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <Button>Configure Server</Button>
      </div>

      {/* Description */}
      <p className="text-muted-foreground mb-6">{server.description}</p>

      <Separator className="mb-8" />

      {/* Categories */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">Categories</h2>
        <div className="flex flex-wrap gap-2">
          {server.categories.map((category) => (
            <Badge key={category} variant="secondary" className="text-sm">
              {category}
            </Badge>
          ))}
        </div>
      </div>

      <Separator className="mb-8" />

      {/* Tools */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="h-5 w-5" />
          <h2 className="text-lg font-semibold">
            Available Tools ({server.tools.count})
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
              {server.tools.examples.map((tool, index) => (
                <tr
                  key={index}
                  className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <td className="p-2 font-medium text-sm">{tool}</td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {server.tools.descriptions &&
                    server.tools.descriptions[index]
                      ? server.tools.descriptions[index]
                      : "No description available"}
                  </td>
                  <td className="p-2 text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-xs"
                    >
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
