"use client";

import { useParams, useRouter } from "next/navigation";
import { useMCPServerBundle } from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Package,
  Calendar,
  Clock,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

export default function BundleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bundleId = params.id as string;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: bundle, isLoading, error } = useMCPServerBundle(bundleId);

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

  if (error || !bundle) {
    return (
      <div className="container max-w-5xl mx-auto p-6">
        <Button
          variant="outline"
          onClick={() => router.push("/bundle-mcp")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bundles
        </Button>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>Failed to load bundle details</p>
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
        <Button variant="outline" onClick={() => router.push("/bundle-mcp")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Bundles
        </Button>
        <Badge variant="outline" className="text-sm">
          <Package className="h-3 w-3 mr-1" />
          Active Bundle
        </Badge>
      </div>

      {/* Bundle Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Package className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <CardTitle className="text-xl">{bundle.name}</CardTitle>
              {bundle.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {bundle.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Bundle ID
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm">{bundle.id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCopy(bundle.id, "bundle-id")}
                >
                  {copiedField === "bundle-id" ? (
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
                <code className="text-sm">{bundle.organization_id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCopy(bundle.organization_id, "org-id")}
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
                User ID
              </label>
              <div className="flex items-center gap-2 mt-1">
                <code className="text-sm">{bundle.user_id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleCopy(bundle.user_id, "user-id")}
                >
                  {copiedField === "user-id" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Configurations
              </label>
              <p className="text-sm mt-1">
                {bundle.mcp_server_configurations.length} MCP server
                {bundle.mcp_server_configurations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="border-t pt-4 mt-4 grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <Calendar className="inline h-3 w-3 mr-1" />
                Created At
              </label>
              <p className="text-sm mt-1">
                {new Date(bundle.created_at).toLocaleString()}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                <Clock className="inline h-3 w-3 mr-1" />
                Updated At
              </label>
              <p className="text-sm mt-1">
                {new Date(bundle.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MCP Server Configurations */}
      <Card>
        <CardHeader>
          <CardTitle>MCP Server Configurations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bundle.mcp_server_configurations.map((config) => (
              <Card key={config.id} className="border">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {config.mcp_server.logo && (
                        <Image
                          src={config.mcp_server.logo}
                          alt={config.mcp_server.name}
                          width={32}
                          height={32}
                          className="rounded"
                        />
                      )}
                      <div>
                        <h3 className="font-medium">
                          {config.mcp_server.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          Configuration ID: {config.id}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="default"
                      onClick={() =>
                        router.push(`/mcp-configuration/${config.id}`)
                      }
                    >
                      View Configuration
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
