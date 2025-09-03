"use client";

import { useMemo, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Image from "next/image";
import { Trash2, Settings, Eye, ArrowUpDown } from "lucide-react";
import { formatToLocalTime } from "@/utils/time";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useMCPServerConfigurations,
  useDeleteMCPServerConfiguration,
} from "@/features/mcp/hooks/use-mcp-servers";
import { MCPServerConfigurationPublicBasic } from "@/features/mcp/types/mcp.types";
import { PermissionGuard } from "@/components/rbac/permission-guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { usePermission } from "@/hooks/use-permissions";
import { Shield } from "lucide-react";

const columnHelper = createColumnHelper<MCPServerConfigurationPublicBasic>();

export default function MCPConfigurationPage() {
  const router = useRouter();
  const canViewConfigurations = usePermission(
    PERMISSIONS.MCP_CONFIGURATION_PAGE_VIEW,
  );
  const { data: configurationsResponse, isLoading } =
    useMCPServerConfigurations({ limit: 100 });
  const deleteConfiguration = useDeleteMCPServerConfiguration();

  // Redirect members who don't have permission
  useEffect(() => {
    if (!isLoading && !canViewConfigurations) {
      router.push("/mcp-servers");
      toast.error("You don't have permission to view configurations");
    }
  }, [isLoading, canViewConfigurations, router]);

  const handleDelete = useCallback(
    async (configurationId: string, serverName: string) => {
      try {
        await deleteConfiguration.mutateAsync(configurationId);
        toast.success(`Configuration for ${serverName} deleted successfully`);
      } catch (error) {
        console.error("Failed to delete configuration:", error);
        toast.error("Failed to delete configuration");
      }
    },
    [deleteConfiguration],
  );

  const columns: ColumnDef<MCPServerConfigurationPublicBasic>[] =
    useMemo(() => {
      return [
        columnHelper.accessor("id", {
          id: "configuration_id",
          header: () => (
            <div className="flex items-center justify-start">
              <span className="text-left font-normal">CONFIGURATION ID</span>
            </div>
          ),
          cell: (info) => {
            const id = info.getValue();
            return (
              <div className="font-mono text-xs text-muted-foreground">
                {id}
              </div>
            );
          },
          enableGlobalFilter: true,
        }),

        columnHelper.accessor("name", {
          id: "configuration_name",
          header: () => (
            <div className="flex items-center justify-start">
              <span className="text-left font-normal">CONFIGURATION NAME</span>
            </div>
          ),
          cell: (info) => {
            const name = info.getValue();
            const description = info.row.original.description;
            return (
              <div className="flex flex-col">
                <div className="font-medium">{name}</div>
                {description && (
                  <div className="text-xs text-muted-foreground">
                    {description}
                  </div>
                )}
              </div>
            );
          },
          enableGlobalFilter: true,
        }),

        columnHelper.accessor((row) => row.mcp_server?.name, {
          id: "mcp_server_name",
          header: () => (
            <div className="flex items-center justify-start">
              <span className="text-left font-normal">MCP SERVER</span>
            </div>
          ),
          cell: (info) => {
            const name = info.getValue();
            const logo = info.row.original.mcp_server?.logo;
            return (
              <div className="flex items-center gap-2">
                {logo && (
                  <div className="relative h-5 w-5 shrink-0 overflow-hidden">
                    <Image
                      src={logo}
                      alt={`${name} logo`}
                      fill
                      className="object-contain rounded-sm"
                    />
                  </div>
                )}
                <div className="font-medium">{name}</div>
              </div>
            );
          },
          enableGlobalFilter: true,
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
                {dateString ? formatToLocalTime(dateString) : "-"}
              </div>
            );
          },
          enableGlobalFilter: false,
        }),

        columnHelper.accessor((row) => row, {
          id: "actions",
          header: "",
          cell: (info) => {
            const configuration = info.getValue();
            return (
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/mcp-configuration/${configuration.id}`)
                        }
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>View Configuration</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <PermissionGuard
                  permission={PERMISSIONS.MCP_CONFIGURATION_DELETE}
                >
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
                        <AlertDialogTitle>
                          Delete Configuration
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete the configuration for{" "}
                          {configuration.mcp_server.name}? This action cannot be
                          undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() =>
                            handleDelete(
                              configuration.id,
                              configuration.mcp_server.name,
                            )
                          }
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
      ] as ColumnDef<MCPServerConfigurationPublicBasic>[];
    }, [handleDelete, router]);

  // Show permission denied message for members
  if (!canViewConfigurations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground max-w-md">
          You don&apos;t have permission to manage MCP server configurations.
          Please contact your administrator for access.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 py-3 border-b">
        <h1 className="text-2xl font-bold">MCP Configurations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization&apos;s MCP server configurations
        </p>
      </div>

      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
              <p className="text-sm text-muted-foreground">
                Loading configurations...
              </p>
            </div>
          </div>
        ) : !configurationsResponse ||
          configurationsResponse.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center">
            <Settings className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No configurations yet
            </h3>
            <p className="text-muted-foreground mb-4 max-w-md">
              Get started by creating your first MCP server configuration. This
              will allow your organization to use MCP tools and integrations.
            </p>
          </div>
        ) : (
          <EnhancedDataTable
            columns={columns}
            data={configurationsResponse.data}
            defaultSorting={[{ id: "created_at", desc: true }]}
            searchBarProps={{
              placeholder: "Search configurations...",
            }}
            paginationOptions={{
              initialPageIndex: 0,
              initialPageSize: 15,
            }}
          />
        )}
      </div>
    </div>
  );
}
