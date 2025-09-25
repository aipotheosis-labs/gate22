"use client";

import { useParams, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Wrench,
  Loader2,
  Plus,
  HelpCircle,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import Image from "next/image";
import {
  useMCPServer,
  useSyncMCPServerTools,
  useOperationalMCPServerConfigurations,
} from "@/features/mcp/hooks/use-mcp-servers";
import { useState, useEffect } from "react";
import { MCPServerConfigurationStepper } from "@/features/mcp/components/mcp-server-configuration-stepper";
import { ToolsTable } from "@/features/mcp/components/tools-table";
import { OperationalAccountDialog } from "@/features/mcp/components/operational-account-dialog";
import { SyncResultsDialog } from "@/features/mcp/components/sync-results-dialog";
import { PermissionGuard } from "@/components/rbac/permission-guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getAuthTypeLabel, getAuthTypeDetailedInfo } from "@/utils/auth-labels";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";
import { ToolsSyncResult } from "@/features/mcp/types/mcp.types";

export default function MCPServerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const serverId = params.id as string;
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isOperationalDialogOpen, setIsOperationalDialogOpen] = useState(false);
  const [syncResults, setSyncResults] = useState<ToolsSyncResult | null>(null);
  const [isSyncResultsOpen, setIsSyncResultsOpen] = useState(false);
  const [, setForceUpdate] = useState(0);

  // Get organization context and permissions
  const { activeOrg } = useMetaInfo();

  // Fetch server data using the new hook
  const { data: server, isLoading, error } = useMCPServer(serverId);

  // Fetch operational configurations for this server
  const { data: operationalConfigs, refetch: refetchOperationalConfigs } =
    useOperationalMCPServerConfigurations();

  // Sync mutation
  const syncMutation = useSyncMCPServerTools();

  // Check if there's an operational account for this server
  const operationalConfig = operationalConfigs?.data?.find(
    (config) => config.mcp_server_id === serverId,
  );
  const hasOperationalAccount =
    operationalConfig?.has_operational_connected_account || false;

  // Check if enough time has passed since last sync
  // Current cooldown is 1 minute
  const canSyncByTime =
    !server?.last_synced_at ||
    new Date().getTime() - new Date(server.last_synced_at).getTime() >=
      60 * 1000;

  // Update timer every minute when sync is on cooldown
  useEffect(() => {
    if (!server?.last_synced_at || canSyncByTime) return;

    const interval = setInterval(() => {
      // Force re-render to update the countdown
      setForceUpdate((prev) => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [server?.last_synced_at, canSyncByTime]);

  const handleSync = () => {
    syncMutation.mutate(serverId, {
      onSuccess: (results) => {
        setSyncResults(results);
        setIsSyncResultsOpen(true);

        const totalChanges =
          results.tools_created.length +
          results.tools_deleted.length +
          results.tools_updated.length;

        if (totalChanges === 0) {
          toast.success("Tools are already up to date");
        } else {
          toast.success(
            `Tools synced successfully - ${totalChanges} changes made`,
          );
        }
      },
      onError: (error) => {
        console.error("Sync failed:", error);
        toast.error("Failed to sync tools. Please try again.");
      },
    });
  };

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
    <div className="p-6 max-w-7xl mx-auto">
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
            {server.supported_auth_types &&
              server.supported_auth_types.length > 0 && (
                <div className="flex gap-1.5 mt-2">
                  {server.supported_auth_types.map((authType) => (
                    <div key={authType} className="flex items-center gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {getAuthTypeLabel(authType)}
                      </Badge>
                      {getAuthTypeDetailedInfo(authType) && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label={`About ${getAuthTypeLabel(authType)}`}
                              className="inline-flex p-0 m-0"
                            >
                              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-help" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-xs">
                            <p>{getAuthTypeDetailedInfo(authType)}</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                  ))}
                </div>
              )}
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

      {/* Operational Account - Only show for servers belonging to active organization */}
      {server.organization_id === activeOrg?.orgId && (
        <>
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                <h2 className="text-lg font-semibold">Operational Account</h2>
              </div>
              <PermissionGuard
                permission={PERMISSIONS.CONNECTED_ACCOUNT_CREATE_OPERATIONAL}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsOperationalDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {hasOperationalAccount ? "Update Account" : "Setup Account"}
                </Button>
              </PermissionGuard>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Operational Account is a service account used for fetching MCP
                server information and listening to any server changes.
              </p>
            </div>
            <div className="flex items-center gap-2 my-4">
              {hasOperationalAccount ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    Operational account is configured
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-muted-foreground">
                    No operational account configured
                  </span>
                </>
              )}
            </div>
          </div>

          <Separator className="mb-4" />
        </>
      )}

      {/* Tools */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            <h2 className="text-lg font-semibold">
              Available Tools ({server.tools?.length || 0})
            </h2>
          </div>
          {server.organization_id === activeOrg?.orgId && (
            <PermissionGuard permission={PERMISSIONS.CUSTOM_MCP_SERVER_SYNC}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSync}
                      disabled={
                        syncMutation.isPending ||
                        !hasOperationalAccount ||
                        !canSyncByTime
                      }
                    >
                      {syncMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : !canSyncByTime ? (
                        <Clock className="h-4 w-4 mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      {server.last_synced_at ? "Re-sync now" : "Sync now"}
                    </Button>
                  </div>
                </TooltipTrigger>
                {(!hasOperationalAccount || !canSyncByTime) && (
                  <TooltipContent>
                    {!hasOperationalAccount ? (
                      <p>
                        Setup an operational account first to enable syncing
                      </p>
                    ) : !canSyncByTime ? (
                      <p>
                        Please wait a while before syncing again. You can
                        re-sync the tools once every minute.
                      </p>
                    ) : null}
                  </TooltipContent>
                )}
              </Tooltip>
            </PermissionGuard>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          Last synced:{" "}
          {server.last_synced_at
            ? new Date(server.last_synced_at).toLocaleString()
            : "Never"}
        </p>

        <ToolsTable
          tools={server.tools || []}
          emptyMessage="No tools available for this server"
        />
      </div>

      {/* Configuration Stepper */}
      {server && (
        <MCPServerConfigurationStepper
          isOpen={isConfigModalOpen}
          onClose={() => setIsConfigModalOpen(false)}
          server={server}
        />
      )}

      {/* Operational Account Dialog - Only for servers belonging to active organization */}
      {server && server.organization_id === activeOrg?.orgId && (
        <OperationalAccountDialog
          open={isOperationalDialogOpen}
          onOpenChange={setIsOperationalDialogOpen}
          server={{
            id: server.id,
            name: server.name,
            auth_type: server.supported_auth_types?.[0], // Use first supported auth type
          }}
          operationalConfigId={operationalConfig?.id}
          onSuccess={() => {
            // Refresh operational configs to update the status and enable sync button
            refetchOperationalConfigs();
          }}
        />
      )}

      {/* Sync Results Dialog */}
      <SyncResultsDialog
        open={isSyncResultsOpen}
        onOpenChange={setIsSyncResultsOpen}
        results={syncResults}
        serverName={server?.name || ""}
      />
    </div>
  );
}
