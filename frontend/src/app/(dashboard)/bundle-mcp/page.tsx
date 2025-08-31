"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BsQuestionCircle } from "react-icons/bs";
import { MdAdd } from "react-icons/md";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCallback, useMemo } from "react";
import { DataTable } from "@/components/data-table/data-table";
import { DataTableAdvancedToolbar } from "@/components/data-table/data-table-advanced-toolbar";
import { DataTableFilterList } from "@/components/data-table/data-table-filter-list";
import { DataTableSortList } from "@/components/data-table/data-table-sort-list";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { useDataTable } from "@/hooks/use-data-table";
import { MCPServerBundle } from "@/features/bundle-mcp/types/bundle-mcp.types";
import { toast } from "sonner";
import { CreateBundleForm } from "@/features/bundle-mcp/components/create-bundle-form";
import {
  useCreateMCPServerBundle,
  useDeleteMCPServerBundle,
  useMCPServerBundles,
} from "@/features/bundle-mcp/hooks/use-bundle-mcp";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-servers";
import { IdDisplay } from "@/components/ui-extensions/id-display";
import { Trash2, Text, Calendar } from "lucide-react";
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
import type { ColumnDef } from "@tanstack/react-table";

export default function BundleMCPPage() {
  const { data: bundles = [], isLoading: isBundlesLoading } =
    useMCPServerBundles();
  const { data: configurationsData, isLoading: isConfigsLoading } =
    useMCPServerConfigurations();
  const configurations = configurationsData?.data || [];

  const { mutateAsync: createBundleMutation } = useCreateMCPServerBundle();
  const { mutateAsync: deleteBundleMutation } = useDeleteMCPServerBundle();

  const handleDeleteBundle = useCallback(
    async (bundleId: string) => {
      try {
        await deleteBundleMutation(bundleId);
      } catch (error) {
        console.error("Error deleting bundle:", error);
        toast.error("Failed to delete bundle");
      }
    },
    [deleteBundleMutation],
  );

  const columns = useMemo<ColumnDef<MCPServerBundle>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Bundle Name" />
        ),
        cell: ({ row }) => <IdDisplay id={row.getValue("name")} dim={false} />,
        meta: {
          label: "Bundle Name",
          placeholder: "Search by name...",
          variant: "text",
          icon: Text,
        },
        enableColumnFilter: true,
        enableSorting: true,
      },
      {
        id: "created_at",
        accessorKey: "created_at",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Created" />
        ),
        cell: ({ row }) =>
          new Date(row.getValue("created_at")).toLocaleDateString(),
        meta: {
          label: "Created Date",
          variant: "date",
          icon: Calendar,
        },
        enableColumnFilter: true,
        enableSorting: true,
      },
      {
        id: "actions",
        header: () => "Actions",
        cell: ({ row }) => {
          const bundle = row.original;
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Bundle</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the bundle &quot;
                    {bundle.name}
                    &quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteBundle(bundle.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    [handleDeleteBundle],
  );

  const { table } = useDataTable({
    data: bundles as MCPServerBundle[],
    columns,
    pageCount: Math.ceil(bundles.length / 10),
    initialState: {
      sorting: [{ id: "created_at", desc: true }],
      pagination: { pageIndex: 0, pageSize: 10 },
    },
    getRowId: (row) => row.id,
    enableAdvancedFilter: true,
  });

  return (
    <div className="w-full">
      <div className="flex items-center justify-between m-4">
        <div>
          <h1 className="text-2xl font-semibold">Bundle MCP</h1>
          <p className="text-sm text-muted-foreground">
            Manage your MCP server bundles and configurations
          </p>
        </div>
        <CreateBundleForm
          title="Create MCP Bundle"
          availableConfigurations={configurations.map((config) => ({
            id: config.id,
            name: config.mcp_server.name,
          }))}
          onSubmit={async (values) => {
            try {
              await createBundleMutation(values);
            } catch (error) {
              console.error("Error creating bundle:", error);
              toast.error("Failed to create bundle");
            }
          }}
        >
          <Button variant="default" disabled={isConfigsLoading}>
            <MdAdd />
            Create Bundle
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer ml-1">
                  <BsQuestionCircle className="h-4 w-4 text-primary-foreground/70" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  Create a new MCP server bundle with selected configurations.
                </p>
              </TooltipContent>
            </Tooltip>
          </Button>
        </CreateBundleForm>
      </div>
      <Separator />

      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm">
              Each bundle groups multiple MCP server configurations for easier
              management.
            </p>
          </div>
        </div>

        {!isBundlesLoading && bundles && bundles.length > 0 && (
          <DataTable table={table}>
            <DataTableAdvancedToolbar table={table}>
              <DataTableFilterList table={table} />
              <DataTableSortList table={table} />
            </DataTableAdvancedToolbar>
          </DataTable>
        )}
      </div>
    </div>
  );
}
