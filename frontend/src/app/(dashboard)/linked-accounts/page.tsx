"use client";

import { useMemo, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";
import { Trash2, Plus, ArrowUpDown } from "lucide-react";
import { AddAccountDialog } from "@/features/linked-accounts/components/add-account-dialog";
import {
  useLinkedAccounts,
  useDeleteLinkedAccount,
} from "@/features/linked-accounts/hooks/use-linked-account";
import { useMCPServerConfigurations } from "@/features/mcp/hooks/use-mcp-server-configurations";
import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
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

const columnHelper = createColumnHelper<LinkedAccount>();

export default function LinkedAccountsPage() {
  const searchParams = useSearchParams();
  const { data: accounts, isLoading } = useLinkedAccounts();
  const { data: mcpConfigurationsResponse } = useMCPServerConfigurations();
  const { mutateAsync: deleteAccount } = useDeleteLinkedAccount();

  // Check for OAuth errors in query params
  useEffect(() => {
    const error = searchParams.get("error");
    const message = searchParams.get("message");

    if (error === "oauth_failed") {
      toast.error(`OAuth authentication failed: ${message || "Unknown error"}`);
      // Clean up the URL
      window.history.replaceState({}, "", "/linked-accounts");
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
        };
        return acc;
      },
      {} as Record<string, { name: string; logo: string | null }>,
    );
  }, [mcpConfigurationsResponse]);

  const handleDelete = useCallback(
    async (account: LinkedAccount) => {
      try {
        await deleteAccount({ linkedAccountId: account.id });
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

  const columns: ColumnDef<LinkedAccount>[] = useMemo(() => {
    return [
      columnHelper.accessor("id", {
        id: "account_id",
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="p-0 h-auto text-left font-normal bg-transparent hover:bg-transparent focus:ring-0"
            >
              LINKED ACCOUNT ID
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
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

      columnHelper.accessor("mcp_server_configuration_id", {
        id: "configuration_id",
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="p-0 h-auto text-left font-normal bg-transparent hover:bg-transparent focus:ring-0"
            >
              CONFIGURATION ID
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const configId = info.getValue();
          return (
            <div className="font-mono text-xs text-muted-foreground">
              {configId}
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor("mcp_server_configuration_id", {
        id: "mcp_server",
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="p-0 h-auto text-left font-normal bg-transparent hover:bg-transparent focus:ring-0"
            >
              MCP SERVER
              <ArrowUpDown className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ),
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
              <div className="font-medium">{config?.name || "Unknown"}</div>
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
              {formatToLocalTime(dateString)}
            </div>
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor("updated_at", {
        id: "updated_at",
        header: ({ column }) => (
          <div className="flex items-center justify-start">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="p-0 h-auto text-left font-normal bg-transparent hover:bg-transparent focus:ring-0"
            >
              LAST UPDATED
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
          const account = info.getValue();
          const config = mcpConfigMap[account.mcp_server_configuration_id];
          return (
            <div className="flex items-center justify-end">
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
                    <AlertDialogTitle>Delete Account?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the linked account for {config?.name || "this MCP server"}
                      .
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
    ] as ColumnDef<LinkedAccount>[];
  }, [handleDelete, mcpConfigMap]);

  if (isLoading) {
    return (
      <div>
        <div className="px-4 py-3 border-b">
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
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
          <h1 className="text-2xl font-bold">Linked Accounts</h1>
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
                  No linked accounts yet
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
