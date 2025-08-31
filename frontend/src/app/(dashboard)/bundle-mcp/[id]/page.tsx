"use client";

import { useParams, useRouter } from "next/navigation";
import { useMCPServerBundle } from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Package, Shield, Wrench, Calendar, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function BundleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bundleId = params.id as string;

  const { data: bundle, isLoading, error } = useMCPServerBundle(bundleId);

  if (isLoading) {
    return (
      <div className="w-full p-4">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid gap-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }

  if (error || !bundle) {
    return (
      <div className="w-full p-4">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Bundle</CardTitle>
            <CardDescription>
              {error?.message || "Bundle not found"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push("/bundle-mcp")} variant="secondary">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Bundles
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.push("/bundle-mcp")}
            variant="ghost"
            size="icon"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-2xl font-semibold">{bundle.name}</h1>
            </div>
            {bundle.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {bundle.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Bundle Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(bundle.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Bundle ID</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {bundle.id}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>MCP Server Configurations</CardTitle>
            <CardDescription>
              {bundle.mcp_server_configurations.length} configuration{bundle.mcp_server_configurations.length !== 1 ? "s" : ""} in this bundle
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {bundle.mcp_server_configurations.map((config) => (
                <Card key={config.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">
                          {config.mcp_server.name}
                        </CardTitle>
                        {config.mcp_server.description && (
                          <CardDescription className="text-xs">
                            {config.mcp_server.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          <Shield className="mr-1 h-3 w-3" />
                          {config.auth_type}
                        </Badge>
                        {config.all_tools_enabled && (
                          <Badge variant="default" className="text-xs">
                            <Wrench className="mr-1 h-3 w-3" />
                            All Tools
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Configuration ID: <span className="font-mono">{config.id}</span></p>
                      <p>
                        Added: {new Date(config.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}