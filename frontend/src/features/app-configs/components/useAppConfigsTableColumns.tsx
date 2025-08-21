import { useMemo } from "react";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { type AppConfig } from "@/features/app-configs/types/appconfig.types";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { GoTrash } from "react-icons/go";
import { App } from "@/features/apps/types/app.types";
import Image from "next/image";
import { IdDisplay } from "@/features/apps/components/id-display";
import { useUpdateAppConfig, useDeleteAppConfig } from "@/features/app-configs/hooks/use-app-config";
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
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";
const columnHelper = createColumnHelper<AppConfig>();

interface AppConfigsTableColumnsProps {
  linkedAccountsCountMap: Record<string, number>;
  appsMap: Record<string, App>;
}

export const useAppConfigsTableColumns = ({
  linkedAccountsCountMap,
  appsMap,
}: AppConfigsTableColumnsProps): ColumnDef<AppConfig>[] => {
  const updateAppConfigMutation = useUpdateAppConfig();
  const deleteAppConfigMutation = useDeleteAppConfig();

  return useMemo(() => {
    return [
      columnHelper.accessor("app_name", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={() =>
                column.toggleSorting(column.getIsSorted() === "asc")
              }
              className="w-full justify-start px-0"
            >
              APP NAME
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => {
          const appName = info.getValue();
          return (
            <div className="flex items-center gap-3">
              <div className="relative h-5 w-5 shrink-0 overflow-hidden">
                {appsMap[appName]?.logo && (
                  <Image
                    src={appsMap[appName].logo}
                    alt={`${appName} logo`}
                    fill
                    className="object-contain"
                  />
                )}
              </div>
              <IdDisplay id={appName} dim={false} />
            </div>
          );
        },
        enableGlobalFilter: true,
      }),

      columnHelper.accessor((row) => appsMap[row.app_name]?.categories || [], {
        id: "categoriesDisplay",
        header: "CATEGORIES",
        cell: (info) => {
          const categories = info.getValue();
          return (
            <div className="flex flex-wrap gap-2 overflow-hidden">
              {categories.map((category: string) => (
                <span
                  key={category}
                  className="rounded-md bg-muted px-3 py-1 text-sm font-medium text-muted-foreground border border-border"
                >
                  {category}
                </span>
              ))}
            </div>
          );
        },
        enableColumnFilter: true,
        filterFn: "arrIncludes",
      }),

      columnHelper.accessor(
        (row) => linkedAccountsCountMap[row.app_name] || 0,
        {
          id: "linkedAccounts",
          header: ({ column }) => (
            <div className="text-left">
              <Button
                variant="ghost"
                onClick={() =>
                  column.toggleSorting(column.getIsSorted() === "asc")
                }
                className="w-full justify-start px-0"
              >
                LINKED ACCOUNTS
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </div>
          ),
          cell: (info) => info.getValue(),
          enableGlobalFilter: false,
        },
      ),

      columnHelper.accessor("enabled", {
        header: "ENABLED",
        cell: (info) => {
          const config = info.row.original;
          return (
            <Switch
              checked={info.getValue()}
              onCheckedChange={async (checked) => {
                try {
                  await updateAppConfigMutation.mutateAsync({
                    app_name: config.app_name,
                    enabled: checked,
                  });
                  toast.success(
                    `${config.app_name} configurations ${checked ? "enabled" : "disabled"}`
                  );
                } catch (error) {
                  console.error("Failed to update app config:", error);
                  toast.error("Failed to update app configuration");
                }
              }}
            />
          );
        },
        enableGlobalFilter: false,
      }),

      columnHelper.accessor((row) => row, {
        id: "actions",
        header: "",
        cell: (info) => {
          const config = info.getValue();
          return (
            <div className="space-x-2 flex">
              <Link href={`/appconfigs/${config.app_name}`}>
                <Button variant="outline" size="sm">
                  Open
                </Button>
              </Link>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-red-600">
                    <GoTrash />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Deletion?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      the app configuration for &quot;
                      {config.app_name}&quot; and remove all the linked accounts
                      for this app.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={async () => {
                        try {
                          await deleteAppConfigMutation.mutateAsync(
                            config.app_name,
                          );
                          toast.success(
                            "App configuration deleted successfully",
                          );
                        } catch (error) {
                          console.error(error);
                          toast.error("Failed to delete app configuration");
                        }
                      }}
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
    ] as ColumnDef<AppConfig>[];
  }, [
    linkedAccountsCountMap,
    appsMap,
    updateAppConfigMutation,
    deleteAppConfigMutation,
  ]);
};
