"use client";

import { useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Plus, ArrowUpDown } from "lucide-react";
import { AddAccountDialog } from "@/features/connected-accounts/components/add-account-dialog";
import {
  useConnectedAccounts,
  useDeleteConnectedAccount,
} from "@/features/connected-accounts/hooks/use-connected-account";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-server-configurations";
import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";
import { formatToLocalTime } from "@/utils/time";
import { toast } from "sonner";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
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
import { ConnectedAccountOwnership } from "@/features/mcp/types/mcp.types";
import { getOwnershipLabel } from "@/utils/configuration-labels";

const columnHelper = createColumnHelper<ConnectedAccount>();

export default function ConnectedAccountsPage() {
  const searchParams = useSearchParams();
  const { data: accounts, isLoading } = useConnectedAccounts();
  const { data: mcpConfigurationsResponse } = useMCPServerConfigurations({
    limit: 100,
  });
  const { mutateAsync: deleteAccount } = useDeleteConnectedAccount();

  // Check for OAuth errors in query params
  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error === "oauth_failed") {
      toast.error(`OAuth authentication failed: ${message || "Unknown error"}`);
      // Clean up the URL
      window.history.replaceState({}, "", "/connected-accounts");
    }
  }, [searchParams]);

  // Create a map of MCP configuration IDs to server info
  const mcpConfigMap = useMemo(() => {
    if (!mcpConfigurationsResponse?.data) return {};
    return mcpConfigurationsResponse.data.reduce(
      (acc, config) => {
        acc[config.id] = {
          name: config.mcp_server?.name || config.id,
          logo: config.mcp_server?.logo || null,
          configName: config.name || config.id,
        };
        return acc;
      },
      {} as Record<
        string,
        { name: string; logo: string | null; configName: string }
      >,
    );
  }, [mcpConfigurationsResponse]);

  const handleDelete = useCallback(
    async (account: ConnectedAccount) => {
      try {
        await deleteAccount({ connectedAccountId: account.id });
        toast.success("Account deleted successfully");
      } catch (error) {
        console.error("Failed to delete account:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Failed to delete account";
        toast.error(errorMessage);
      }
    },
    [deleteAccount],
  );

  const columns: ColumnDef<ConnectedAccount>[] = useMemo(() => {
    return [
      columnHelper.accessor("user", {
        id: "user",
        header: () => "ACCOUNT USER",
        cell: (info) => {
          const user = info.getValue();
          return <div className="text-sm">{user?.name || "-"}</div>;
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("ownership", {
        id: "ownership_type",
        header: () => "ACCOUNT TYPE",
        cell: (info) => {
          const ownership = info.getValue() as ConnectedAccountOwnership;
          if (!ownership) return null;

          return (
            <Badge variant="outline">{getOwnershipLabel(ownership)}</Badge>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("mcp_server_configuration_id", {
        id: "configured_mcp_server",
        header: () => "MCP SERVER",
        cell: (info) => {
          const configId = info.getValue();
          const config = mcpConfigMap[configId];
          return (
            <div className="flex items-center gap-2">
              {config?.logo && (
                <div className="relative h-5 w-5 shrink-0 overflow-hidden">
                  <Image
                    src={config.logo}
                    alt={`${config.name} logo`}
                    fill
                    className="object-contain rounded-sm"
                  />
                </div>
              )}
              <div className="flex items-center gap-1">
                <span className="font-medium">{config?.name || "Unknown"}</span>
                <span className="text-muted-foreground">(</span>
                <Link
                  href={`/mcp-configuration/${configId}`}
                  className="text-primary hover:underline"
                >
                  {config?.configName || "Unknown"}
                </Link>
                <span className="text-muted-foreground">)</span>
              </div>
            </div>
          );
        },
        enableGlobalFilter: true,
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
          return <div className="text-sm">{formatToLocalTime(dateString)}</div>;
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
            className="flex items-center gap-1 hover:text-foreground/80 transition-colors"
          >
            <span>UPDATED</span>
            <ArrowUpDown className="h-4 w-4" />
          </button>
        ),
        cell: (info) => {
          const dateString = info.getValue();
          return <div className="text-sm">{formatToLocalTime(dateString)}</div>;
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: () => <div className="flex justify-end">ACTIONS</div>,
        cell: (info) => {
          const account = info.getValue();
          const config = mcpConfigMap[account.mcp_server_configuration_id];
          return (
            <div className="flex items-center justify-end">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the connected account for{" "}
                      {config?.name || "this MCP server"}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => handleDelete(account)}
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          );
        },
        enableGlobalFilter: false,
      }),
    ] as ColumnDef<ConnectedAccount>[];
  }, [handleDelete, mcpConfigMap]);

  if (isLoading) {
    return (
      <div>
        <div className="px-4 py-3 border-b">
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and configure your connected accounts
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
          <h1 className="text-2xl font-bold">Connected Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage and configure your connected accounts
          </p>
        </div>
        <AddAccountDialog />
      </div>

      <div className="p-4 space-y-4">
        {accounts && accounts.length > 0 ? (
          <EnhancedDataTable
            columns={columns}
            data={accounts}
            defaultSorting={[{ id: "created_at", desc: true }]}
            searchBarProps={{
              placeholder: "Search accounts...",
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
                  <Plus className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">
                  No connected accounts yet
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Connect your first account to start managing integrations with
                  MCP servers
                </p>
                <AddAccountDialog />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
