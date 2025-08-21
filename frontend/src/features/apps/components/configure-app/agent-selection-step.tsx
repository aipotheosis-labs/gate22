import { Agent } from "@/features/agents/types/agent.types";
import { useAgentColumns } from "@/features/apps/components/useAgentColumns";
import { EnhancedDataTable } from "@/components/ui-extensions/enhanced-data-table/data-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DialogFooter } from "@/components/ui/dialog";
import { RowSelectionState } from "@tanstack/react-table";
import * as z from "zod";
import { useUpdateAgent, useAgents } from "@/features/agents/hooks/use-agent";
import { toast } from "sonner";
import { useEffect, useState } from "react";

// Form schema for agent selection
export const agentSelectFormSchema = z.object({
  agents: z.array(z.string()).optional(),
});

export type AgentSelectFormValues = z.infer<typeof agentSelectFormSchema>;

interface AgentSelectionStepProps {
  onNext: () => void;
  appName: string;
  isDialogOpen: boolean;
}

export function AgentSelectionStep({
  onNext,
  appName,
  isDialogOpen,
}: AgentSelectionStepProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<RowSelectionState>(
    {},
  );
  const { data: agents = [] } = useAgents();
  const columns = useAgentColumns();
  const { mutateAsync: updateAgentMutation, isPending: isUpdatingAgent } =
    useUpdateAgent();

  useEffect(() => {
    if (isDialogOpen && agents) {
      const initialSelection: RowSelectionState = {};
      agents.forEach((agent: Agent) => {
        if (agent.id) {
          initialSelection[agent.id] = true;
        }
      });
      setSelectedAgentIds(initialSelection);
    }
  }, [isDialogOpen, agents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const selectedAgents = Object.keys(selectedAgentIds).filter(
      (id) => selectedAgentIds[id],
    );


    const agentsWithoutCurrentApp = agents.filter((agent: Agent) => {
      if (!agent.allowed_apps || agent.allowed_apps.length === 0) {
        return false;
      }
      return !agent.allowed_apps.includes(appName);
    });

    // Update selected agents to add the app
    const agentsToAddApp = selectedAgents.filter((agentId) => {
      const agent = agents.find((a: Agent) => a.id === agentId);
      return (
        agent &&
        agent.allowed_apps &&
        agent.allowed_apps.length > 0 &&
        !agent.allowed_apps.includes(appName)
      );
    });

    // Update unselected agents to remove the app
    const agentsToRemoveApp = agentsWithoutCurrentApp
      .filter((agent) => !selectedAgents.includes(agent.id))
      .filter((agent) => agent.allowed_apps?.includes(appName))
      .map((agent) => agent.id);

    try {
      // Add app to selected agents
      for (const agentId of agentsToAddApp) {
        const agent = agents.find((a: Agent) => a.id === agentId);
        if (agent) {
          const updatedApps = [...(agent.allowed_apps || []), appName];
          await updateAgentMutation({
            id: agentId,
            data: { allowed_apps: updatedApps },
          });
        }
      }

      // Remove app from unselected agents
      for (const agentId of agentsToRemoveApp) {
        const agent = agents.find((a: Agent) => a.id === agentId);
        if (agent && agent.allowed_apps) {
          const updatedApps = agent.allowed_apps.filter(
            (app) => app !== appName,
          );
          await updateAgentMutation({
            id: agentId,
            data: { allowed_apps: updatedApps },
          });
        }
      }

      if (agentsToAddApp.length > 0 || agentsToRemoveApp.length > 0) {
        toast.success("Agent permissions updated successfully");
      }

      onNext();
    } catch (error) {
      console.error("Error updating agents:", error);
      toast.error("Failed to update agent permissions");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Configuring access for:
          </span>
          <Badge variant="secondary">{appName}</Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          Select which agents should have access to this application.
        </div>

        {agents.length > 0 && (
          <EnhancedDataTable
            columns={columns}
            data={agents}
            defaultSorting={[{ id: "name", desc: false }]}
            searchBarProps={{ placeholder: "Search agents..." }}
            rowSelectionProps={{
              rowSelection: selectedAgentIds,
              onRowSelectionChange: setSelectedAgentIds,
              getRowId: (row) => row.id,
            }}
          />
        )}
      </div>

      <DialogFooter>
        <Button type="submit" disabled={isUpdatingAgent}>
          {isUpdatingAgent ? "Updating..." : "Save and Continue"}
        </Button>
      </DialogFooter>
    </form>
  );
}