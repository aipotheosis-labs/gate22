"use client";

import { useParams, useRouter } from "next/navigation";
import { useMCPServerBundle } from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { getMcpBaseUrl } from "@/lib/api-client";
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
} from "lucide-react";
import Image from "next/image";
import { useState, useMemo } from "react";
import { toast } from "sonner";

export default function BundleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const bundleId = params.id as string;
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const { data: bundle, isLoading, error } = useMCPServerBundle(bundleId);

  // Generate MCP URL using configured base URL
  const mcpUrl = useMemo(() => {
    if (bundle) {
      const baseUrl = getMcpBaseUrl();
      return `${baseUrl}/mcp?bundle_id=${bundle.id}`;
    }
    return "";
  }, [bundle]);

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
              <CardTitle className="text-2xl font-bold">
                {bundle.name}
              </CardTitle>
              {bundle.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {bundle.description}
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* MCP URL - Primary Focus */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              MCP URL
            </label>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-sm font-mono px-3 py-2 rounded border bg-muted/20">
                {mcpUrl}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(mcpUrl, "mcp-url")}
                className="flex-shrink-0"
              >
                {copiedField === "mcp-url" ? (
                  <>
                    <Check className="h-4 w-4 mr-2 text-green-600" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Additional Details */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Bundle ID</span>
              <div className="flex items-center gap-2">
                <code className="font-mono text-xs">{bundle.id}</code>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleCopy(bundle.id, "bundle-id")}
                >
                  {copiedField === "bundle-id" ? (
                    <Check className="h-3 w-3 text-green-600" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-muted-foreground">Created</span>
              <span>{new Date(bundle.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">Last Updated</span>
              <span>{new Date(bundle.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MCP Server Configurations */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">MCP Server Configurations</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="divide-y">
            {bundle.mcp_server_configurations.map((config) => (
              <div
                key={config.id}
                className="py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  {config.mcp_server.logo ? (
                    <Image
                      src={config.mcp_server.logo}
                      alt={config.mcp_server.name}
                      width={24}
                      height={24}
                      className="rounded"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center">
                      <Package className="h-3 w-3 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium">
                      {config.name || config.mcp_server.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {config.mcp_server.name}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/mcp-configuration/${config.id}`)}
                >
                  View →
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
