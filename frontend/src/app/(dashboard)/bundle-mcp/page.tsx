"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Package, ArrowUpDown, Copy, Check } from "lucide-react";
import { BundleMCPStepperForm } from "@/features/bundle-mcp/components/bundle-mcp-stepper-form";
import {
  useCreateMCPServerBundle,
  useDeleteMCPServerBundle,
  useMCPServerBundles,
} from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-servers";
import { useConnectedAccounts } from "@/features/connected-accounts/hooks/use-connected-account";
import { MCPServerBundle } from "@/features/bundle-mcp/types/bundle-mcp.types";
import { formatToLocalTime } from "@/utils/time";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { PermissionGuard } from "@/components/rbac/permission-guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { getMcpBaseUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";
import { OrganizationRole } from "@/features/settings/types/organization.types";
import { Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const columnHelper = createColumnHelper<MCPServerBundle>();

export default function BundleMCPPage() {
  const router = useRouter();
  const [copiedBundleId, setCopiedBundleId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const { activeOrg, activeRole } = useMetaInfo();
  const isAdmin = activeOrg?.userRole === OrganizationRole.Admin;
  const isAdminViewingAsAdmin =
    isAdmin && activeRole === OrganizationRole.Admin;
  const {
    data: bundles = [],
    isLoading: isBundlesLoading,
    canCreate,
  } = useMCPServerBundles();
  const { data: configurationsData, isLoading: isConfigsLoading } =
    useMCPServerConfigurations({ limit: 100 });
  const configurations = configurationsData?.data || [];
  const { data: connectedAccounts = [], isLoading: isAccountsLoading } = useConnectedAccounts();

  const { mutateAsync: createBundleMutation } = useCreateMCPServerBundle();
  const { mutateAsync: deleteBundleMutation } = useDeleteMCPServerBundle();

  const handleDeleteBundle = useCallback(
    async (bundleId: string) => {
      try {
        await deleteBundleMutation({ bundleId });
      } catch (error) {
        console.error("Failed to delete bundle:", error);
      }
    },
    [deleteBundleMutation],
  );

  const handleCopyUrl = useCallback((bundleId: string) => {
    const baseUrl = getMcpBaseUrl();
    const url = `${baseUrl}/mcp?bundle_id=${bundleId}`;
    navigator.clipboard.writeText(url);
    setCopiedBundleId(bundleId);
    toast.success("URL copied to clipboard");
    setTimeout(() => setCopiedBundleId(null), 2000);
  }, []);

  const columns: ColumnDef<MCPServerBundle>[] = useMemo(() => {
    return [
      columnHelper.accessor("name", {
        id: "name",
        header: () => "NAME",
        cell: (info) => {
          const name = info.getValue();
          return (
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div className="font-medium">{name}</div>
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("user", {
        id: "user",
        header: () => "USER",
        cell: (info) => {
          const user = info.getValue();
          return <div className="text-sm">{user?.name || "-"}</div>;
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("id", {
        id: "mcp_url",
        header: () => "MCP URL",
        cell: (info) => {
          const id = info.getValue();
          const baseUrl = getMcpBaseUrl();
          const url = `${baseUrl}/mcp?bundle_id=${id}`;
          // Show shortened version: ...?bundle_id={id}
          const displayUrl = `...?bundle_id=${id}`;
          return (
            <div className="flex items-center gap-1">
              <div
                className="font-mono text-xs truncate max-w-[200px]"
                title={url}
              >
                {displayUrl}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopyUrl(id)}
                className="h-6 w-6 p-0 shrink-0"
                title="Copy full MCP URL"
              >
                {copiedBundleId === id ? (
                  <Check className="h-3 w-3 text-green-600" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("mcp_server_configurations", {
        id: "configurations",
        header: () => "CONFIGURATIONS",
        cell: (info) => {
          const configurations = info.getValue();
          const count = configurations?.length || 0;
          return (
            <Badge variant="secondary">
              {count} configuration{count !== 1 ? "s" : ""}
            </Badge>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("created_at", {
        id: "created_at",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground/80 transition-colors"
          >
            <span>CREATED</span>
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: (info) => {
          const dateString = info.getValue();
          return (
            <div className="text-sm">
              {dateString ? formatToLocalTime(dateString) : "-"}
            </div>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: () => <div className="flex justify-end">ACTIONS</div>,
        cell: (info) => {
          const bundle = info.getValue();
          return (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/bundle-mcp/${bundle.id}`)}
              >
                Detail
              </Button>

              <PermissionGuard
                permission={[
                  PERMISSIONS.BUNDLE_DELETE_OWN,
                  PERMISSIONS.BUNDLE_DELETE_ALL,
                ]}
                mode="any"
              >
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Bundle?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently
                        delete the bundle &quot;{bundle.name}&quot;.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => handleDeleteBundle(bundle.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </PermissionGuard>
            </div>
          );
        },
        enableGlobalFilter: false,
      }),
    ] as ColumnDef<MCPServerBundle>[];
  }, [handleDeleteBundle, handleCopyUrl, copiedBundleId, router]);

  if (isBundlesLoading) {
    return (
      <div>
        <div className="px-4 py-3 border-b">
          <h1 className="text-2xl font-bold">MCP Bundles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your MCP server bundles and configurations
          </p>
        </div>
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Bundles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your MCP server bundles and configurations
          </p>
        </div>
        <PermissionGuard permission={PERMISSIONS.BUNDLE_CREATE}>
          <Button
            variant="default"
            disabled={isConfigsLoading || !canCreate}
            onClick={() => setShowCreateDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Bundle
          </Button>
        </PermissionGuard>
      </div>

      <div className="p-4 space-y-4">
        {isAdminViewingAsAdmin && (
          <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/50">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              Switch to member view to create your own bundle
            </AlertDescription>
          </Alert>
        )}
        {bundles && bundles.length > 0 ? (
          <EnhancedDataTable
            columns={columns}
            data={bundles}
            defaultSorting={[{ id: "created_at", desc: true }]}
            searchBarProps={{
              placeholder: "Search bundles...",
            }}
            paginationOptions={{
              initialPageIndex: 0,
              initialPageSize: 15,
            }}
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="text-center space-y-3">
                <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <Package className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">No bundles yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Create your first bundle to group MCP server configurations
                  for easier management
                </p>
                <PermissionGuard permission={PERMISSIONS.BUNDLE_CREATE}>
                  <Button
                    variant="default"
                    disabled={isConfigsLoading || !canCreate}
                    onClick={() => setShowCreateDialog(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Create Bundle
                  </Button>
                </PermissionGuard>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Bundle Creation Stepper Dialog */}
      <BundleMCPStepperForm
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        availableConfigurations={configurations}
        connectedAccounts={connectedAccounts}
        onSubmit={async (values) => {
          await createBundleMutation(values);
          setShowCreateDialog(false);
        }}
      />
    </div>
  );
}
