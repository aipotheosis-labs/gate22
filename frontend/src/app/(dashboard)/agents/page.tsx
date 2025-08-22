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
import { Agent } from "@/features/agents/types/agent.types";
import { toast } from "sonner";
import { useAppConfigs } from "@/features/app-configs/hooks/use-app-config";
import { CreateAgentForm } from "@/features/agents/components/create-agent-form";
import {
  useCreateAgent,
  useDeleteAgent,
  useAgents,
} from "@/features/agents/hooks/use-agent";
import { IdDisplay } from "@/features/apps/components/id-display";
import { Trash2, Text, Calendar, Shield, Hash } from "lucide-react";
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

export default function AgentsPage() {
  const { data: agents = [], isLoading: isAgentsLoading } = useAgents();
  const { data: appConfigs = [], isPending: isConfigsPending } =
    useAppConfigs();

  const { mutateAsync: createAgentMutation } = useCreateAgent();
  const { mutateAsync: deleteAgentMutation } = useDeleteAgent();

  const handleDeleteAgent = useCallback(
    async (agentId: string) => {
      try {
        if (agents.length <= 1) {
          toast.error(
            "Failed to delete agent. You must keep at least one agent.",
          );
          return;
        }

        await deleteAgentMutation(agentId);
      } catch (error) {
        console.error("Error deleting agent:", error);
        toast.error("Failed to delete agent");
      }
    },
    [agents, deleteAgentMutation],
  );

  const columns = useMemo<ColumnDef<Agent>[]>(
    () => [
      {
        id: "name",
        accessorKey: "name",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Agent Name" />
        ),
        cell: ({ row }) => <IdDisplay id={row.getValue("name")} dim={false} />,
        meta: {
          label: "Agent Name",
          placeholder: "Search by name...",
          variant: "text",
          icon: Text,
        },
        enableColumnFilter: true,
        enableSorting: true,
      },
      {
        id: "description",
        accessorKey: "description",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <div className="max-w-[500px]">{row.getValue("description")}</div>
        ),
        meta: {
          label: "Description",
          placeholder: "Search descriptions...",
          variant: "text",
          icon: Hash,
        },
        enableColumnFilter: true,
      },
      {
        id: "allowed_apps",
        accessorKey: "allowed_apps",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Allowed Apps" />
        ),
        cell: ({ row }) => {
          const apps = row.getValue("allowed_apps") as string[] | undefined;
          return (
            <div className="max-w-[300px]">
              {apps && apps.length > 0 ? apps.join(", ") : "All apps"}
            </div>
          );
        },
        meta: {
          label: "Allowed Apps",
          variant: "multiSelect",
          options: appConfigs.map((config) => ({
            label: config.app_name,
            value: config.app_name,
          })),
          icon: Shield,
        },
        enableColumnFilter: true,
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
                    Are you sure you want to delete the agent &quot;{agent.name}
                    &quot;? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteAgent(agent.id)}
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
    [appConfigs, handleDeleteAgent],
  );

  const { table } = useDataTable({
    data: agents as Agent[],
    columns,
    pageCount: Math.ceil(agents.length / 10),
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
          <h1 className="text-2xl font-semibold">Agents</h1>
          <p className="text-sm text-muted-foreground">
            Manage your agents and their API keys
          </p>
        </div>
        <CreateAgentForm
          title="Create Agent"
          validAppNames={appConfigs.map((appConfig) => appConfig.app_name)}
          onSubmit={async (values) => {
            try {
              await createAgentMutation(values);
            } catch (error) {
              console.error("Error creating agent:", error);
              toast.error("Failed to create agent");
            }
          }}
        >
          <Button variant="default" disabled={isConfigsPending}>
            <MdAdd />
            Create Agent
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-pointer ml-1">
                  <BsQuestionCircle className="h-4 w-4 text-primary-foreground/70" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">
                  Create a new agent API key to access applications configured.
                </p>
              </TooltipContent>
            </Tooltip>
          </Button>
        </CreateAgentForm>
      </div>
      <Separator />

      <div className="p-4">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <p className="text-sm">
              Each agent has a unique API key that can be used to access a
              different set of tools/apps.
            </p>
          </div>
        </div>

        {!isAgentsLoading && agents && agents.length > 0 && (
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
