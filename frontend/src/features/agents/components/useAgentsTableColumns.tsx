"use client";

import { useMemo } from "react";
import { IdDisplay } from "@/features/apps/components/id-display";
import { createColumnHelper, type ColumnDef } from "@tanstack/react-table";
import { Agent } from "@/features/agents/types/agent.types";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, Trash2 } from "lucide-react";
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

const columnHelper = createColumnHelper<Agent>();

export const useAgentsTableColumns = (
  onDelete: (agentId: string) => Promise<void>
): ColumnDef<Agent>[] => {
  return useMemo(() => {
    const columns = [
      columnHelper.accessor("name", {
        header: ({ column }) => (
          <div className="text-left">
            <Button
              variant="ghost"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                column.toggleSorting(column.getIsSorted() === "asc");
              }}
              className="w-full justify-start px-0"
              type="button"
            >
              Agent Name
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        ),
        cell: (info) => <IdDisplay id={info.getValue()} dim={false} />,
        enableGlobalFilter: true,
        id: "name",
      }),
      columnHelper.accessor("description", {
        header: () => "Description",
        cell: (info) => <div className="max-w-[500px]">{info.getValue()}</div>,
        enableGlobalFilter: true,
      }),
      columnHelper.accessor("allowed_apps", {
        header: () => "Allowed Apps",
        cell: (info) => {
          const apps = info.getValue();
          return (
            <div className="max-w-[300px]">
              {apps && apps.length > 0 ? apps.join(", ") : "All apps"}
            </div>
          );
        },
      }),
      columnHelper.accessor("created_at", {
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              column.toggleSorting(column.getIsSorted() === "asc");
            }}
            className="w-full justify-start px-0"
            type="button"
          >
            Created
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        ),
        cell: (info) => new Date(info.getValue()).toLocaleDateString(),
      }),
      columnHelper.display({
        id: "actions",
        header: () => "Actions",
        cell: ({ row }) => {
          const agent = row.original;
          return (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Agent</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete the agent &quot;{agent.name}&quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(agent.id)}>
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          );
        },
      }),
    ];

    return columns as ColumnDef<Agent>[];
  }, [onDelete]);
};