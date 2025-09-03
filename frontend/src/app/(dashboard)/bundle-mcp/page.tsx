"use client";

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Trash2, Plus, Package, Eye, ArrowUpDown } from "lucide-react";
import { CreateBundleForm } from "@/features/bundle-mcp/components/create-bundle-form";
import {
  useCreateMCPServerBundle,
  useDeleteMCPServerBundle,
  useMCPServerBundles,
} from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-servers";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const columnHelper = createColumnHelper<MCPServerBundle>();

export default function BundleMCPPage() {
  const router = useRouter();
  const {
    data: bundles = [],
    isLoading: isBundlesLoading,
    canCreate,
  } = useMCPServerBundles();
  const { data: configurationsData, isLoading: isConfigsLoading } =
    useMCPServerConfigurations({ limit: 100 });
  const configurations = configurationsData?.data || [];

  const { mutateAsync: createBundleMutation } = useCreateMCPServerBundle();
  const { mutateAsync: deleteBundleMutation } = useDeleteMCPServerBundle();

  const handleDeleteBundle = useCallback(
    async (bundleId: string, bundleOwnerId: string) => {
      try {
        await deleteBundleMutation({ bundleId, bundleOwnerId });
      } catch (error) {
        console.error("Failed to delete bundle:", error);
      }
    },
    [deleteBundleMutation],
  );

  const columns: ColumnDef<MCPServerBundle>[] = useMemo(() => {
    return [
      columnHelper.accessor("name", {
        id: "name",
        header: () => (
          <div className="flex items-center justify-start">
            <span className="text-left font-normal">NAME</span>
          </div>
        ),
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

      columnHelper.accessor("id", {
        id: "bundle_id",
        header: () => (
          <div className="flex items-center justify-start">
            <span className="text-left font-normal">BUNDLE ID</span>
          </div>
        ),
        cell: (info) => {
          const id = info.getValue();
          return (
            <div className="font-mono text-xs text-muted-foreground">{id}</div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("mcp_server_configurations", {
        id: "configurations",
        header: () => (
          <div className="flex items-center justify-start">
            <span className="text-left font-normal">CONFIGURATIONS</span>
          </div>
        ),
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
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="p-0 h-auto text-left font-normal bg-transparent hover:bg-transparent focus:ring-0"
            >
              CREATED
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const dateString = info.getValue();
          return (
            <div className="text-sm text-muted-foreground">
              {formatToLocalTime(dateString)}
            </div>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: "",
        cell: (info) => {
          const bundle = info.getValue();
          return (
            <div className="flex items-center justify-end gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/bundle-mcp/${bundle.id}`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>View Bundle</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <PermissionGuard permission={PERMISSIONS.BUNDLE_DELETE_OWN}>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
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
                        onClick={() =>
                          handleDeleteBundle(bundle.id, bundle.user_id)
                        }
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
  }, [handleDeleteBundle, router]);

  if (isBundlesLoading) {
    return (
      <div>
        <div className="px-4 py-3 border-b">
          <h1 className="text-2xl font-bold">Bundle MCP</h1>
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
          <h1 className="text-2xl font-bold">Bundle MCP</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your MCP server bundles and configurations
          </p>
        </div>
        <PermissionGuard permission={PERMISSIONS.BUNDLE_CREATE}>
          <CreateBundleForm
            title="Create MCP Bundle"
            availableConfigurations={configurations.map((config) => ({
              id: config.id,
              name: config.name,
              icon: config.mcp_server?.logo || undefined,
            }))}
            onSubmit={async (values) => {
              await createBundleMutation(values);
            }}
          >
            <Button variant="default" disabled={isConfigsLoading || !canCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Create Bundle
            </Button>
          </CreateBundleForm>
        </PermissionGuard>
      </div>

      <div className="p-4 space-y-4">
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
                  <CreateBundleForm
                    title="Create MCP Bundle"
                    availableConfigurations={configurations.map((config) => ({
                      id: config.id,
                      name: config.name,
                      icon: config.mcp_server?.logo || undefined,
                    }))}
                    onSubmit={async (values) => {
                      await createBundleMutation(values);
                    }}
                  >
                    <Button
                      variant="default"
                      disabled={isConfigsLoading || !canCreate}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create Bundle
                    </Button>
                  </CreateBundleForm>
                </PermissionGuard>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
