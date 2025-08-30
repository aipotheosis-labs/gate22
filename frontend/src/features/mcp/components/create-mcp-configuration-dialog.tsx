"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import {
  useMCPServers,
  useMCPServer,
  useCreateMCPServerConfiguration,
} from "../hooks/use-mcp-servers";
import { useTeams } from "@/features/teams/hooks/use-teams";
import { AuthType, MCPServerConfigurationCreate } from "../types/mcp.types";

export function CreateMCPConfigurationDialog() {
  const [open, setOpen] = useState(false);
  const [selectedServerId, setSelectedServerId] = useState<string>("");
  const [selectedAuthType, setSelectedAuthType] = useState<AuthType>(
    AuthType.NO_AUTH,
  );
  const [allToolsEnabled, setAllToolsEnabled] = useState(true);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  const { data: serversResponse } = useMCPServers();
  const { data: selectedServer } = useMCPServer(selectedServerId);
  const { data: teams } = useTeams();
  const createConfiguration = useCreateMCPServerConfiguration();

  const handleSubmit = async () => {
    if (!selectedServerId) {
      toast.error("Please select an MCP server");
      return;
    }

    if (!selectedAuthType) {
      toast.error("Please select an authentication type");
      return;
    }

    const configData: MCPServerConfigurationCreate = {
      mcp_server_id: selectedServerId,
      auth_type: selectedAuthType,
      all_tools_enabled: allToolsEnabled,
      enabled_tools: allToolsEnabled ? [] : selectedTools,
      allowed_teams: selectedTeams,
    };

    try {
      await createConfiguration.mutateAsync(configData);
      toast.success("MCP configuration created successfully");
      setOpen(false);
      resetForm();
    } catch (error) {
      console.error("Failed to create configuration:", error);
      toast.error("Failed to create MCP configuration");
    }
  };

  const resetForm = () => {
    setSelectedServerId("");
    setSelectedAuthType(AuthType.NO_AUTH);
    setAllToolsEnabled(true);
    setSelectedTools([]);
    setSelectedTeams([]);
  };

  const handleToolToggle = (toolId: string) => {
    setSelectedTools((prev) =>
      prev.includes(toolId)
        ? prev.filter((id) => id !== toolId)
        : [...prev, toolId],
    );
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams((prev) =>
      prev.includes(teamId)
        ? prev.filter((id) => id !== teamId)
        : [...prev, teamId],
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Configuration
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Create MCP Server Configuration</DialogTitle>
          <DialogDescription>
            Configure an MCP server for your organization
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Server Selection */}
          <div className="space-y-2">
            <Label htmlFor="server">MCP Server</Label>
            <Select
              value={selectedServerId}
              onValueChange={setSelectedServerId}
            >
              <SelectTrigger id="server">
                <SelectValue placeholder="Select an MCP server" />
              </SelectTrigger>
              <SelectContent>
                {serversResponse?.data.map((server) => (
                  <SelectItem key={server.id} value={server.id}>
                    <div className="flex items-center gap-2">
                      <span>{server.name}</span>
                      <span className="text-muted-foreground text-sm">
                        ({server.description})
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auth Type Selection */}
          {selectedServer && (
            <div className="space-y-2">
              <Label htmlFor="authType">Authentication Type</Label>
              <Select
                value={selectedAuthType}
                onValueChange={(value) =>
                  setSelectedAuthType(value as AuthType)
                }
              >
                <SelectTrigger id="authType">
                  <SelectValue placeholder="Select authentication type" />
                </SelectTrigger>
                <SelectContent>
                  {selectedServer.supported_auth_types.map((authType) => (
                    <SelectItem key={authType} value={authType}>
                      {authType}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Tools Configuration */}
          {selectedServer && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Tools Configuration</Label>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="all-tools" className="text-sm">
                    Enable all tools
                  </Label>
                  <Switch
                    id="all-tools"
                    checked={allToolsEnabled}
                    onCheckedChange={setAllToolsEnabled}
                  />
                </div>
              </div>

              {!allToolsEnabled && selectedServer.tools.length > 0 && (
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-2">
                    {selectedServer.tools.map((tool) => (
                      <div key={tool.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={tool.id}
                          checked={selectedTools.includes(tool.id)}
                          onCheckedChange={() => handleToolToggle(tool.id)}
                        />
                        <div className="space-y-1">
                          <Label
                            htmlFor={tool.id}
                            className="text-sm font-normal cursor-pointer"
                          >
                            {tool.name}
                          </Label>
                          {tool.description && (
                            <p className="text-xs text-muted-foreground">
                              {tool.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Teams Selection */}
          {teams && teams.length > 0 && (
            <div className="space-y-2">
              <Label>Allowed Teams</Label>
              <ScrollArea className="h-32 border rounded-md p-3">
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.team_id}
                      className="flex items-center space-x-2"
                    >
                      <Checkbox
                        id={team.team_id}
                        checked={selectedTeams.includes(team.team_id)}
                        onCheckedChange={() => handleTeamToggle(team.team_id)}
                      />
                      <Label
                        htmlFor={team.team_id}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {team.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setOpen(false);
              resetForm();
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              !selectedServerId ||
              !selectedAuthType ||
              createConfiguration.isPending
            }
          >
            {createConfiguration.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Create Configuration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
