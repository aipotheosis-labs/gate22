"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import {
  MCPServerPublic,
  MCPServerConfigurationCreate,
  AuthType,
} from "../types/mcp.types";
import { useCreateMCPServerConfiguration } from "../hooks/use-mcp-servers";
import { toast } from "sonner";
import { listTeams } from "@/features/teams/api/team";
import { useMetaInfo } from "@/components/context/metainfo";
import { Team } from "@/features/teams/types/team.types";

interface MCPServerConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  server: MCPServerPublic;
}

export function MCPServerConfigurationModal({
  isOpen,
  onClose,
  server,
}: MCPServerConfigurationModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [selectedAuthType, setSelectedAuthType] = useState<AuthType>(
    server.supported_auth_types[0] || AuthType.NO_AUTH,
  );
  const [allToolsEnabled, setAllToolsEnabled] = useState(true);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const { accessToken, activeOrg } = useMetaInfo();
  const createConfiguration = useCreateMCPServerConfiguration();

  useEffect(() => {
    if (isOpen) {
      setTeamsLoading(true);
      listTeams(accessToken, activeOrg.orgId)
        .then((fetchedTeams) => {
          setTeams(fetchedTeams);
        })
        .catch(() => {
          toast.error("Failed to load teams");
        })
        .finally(() => {
          setTeamsLoading(false);
        });
    }
  }, [isOpen, accessToken, activeOrg.orgId]);

  const handleToolToggle = (toolId: string) => {
    const newSelectedTools = new Set(selectedTools);
    if (newSelectedTools.has(toolId)) {
      newSelectedTools.delete(toolId);
    } else {
      newSelectedTools.add(toolId);
    }
    setSelectedTools(newSelectedTools);
  };

  const handleTeamToggle = (teamId: string) => {
    const newSelectedTeams = new Set(selectedTeams);
    if (newSelectedTeams.has(teamId)) {
      newSelectedTeams.delete(teamId);
    } else {
      newSelectedTeams.add(teamId);
    }
    setSelectedTeams(newSelectedTeams);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a configuration name");
      return;
    }

    const configurationData: MCPServerConfigurationCreate = {
      mcp_server_id: server.id,
      name: name.trim(),
      description: description.trim() || undefined,
      auth_type: selectedAuthType,
      all_tools_enabled: allToolsEnabled,
      enabled_tools: allToolsEnabled ? [] : Array.from(selectedTools),
      allowed_teams: Array.from(selectedTeams),
    };

    try {
      await createConfiguration.mutateAsync(configurationData);
      toast.success("MCP server configured successfully");
      onClose();
    } catch {
      toast.error("Failed to configure MCP server");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[60vw] max-w-[60vw] w-[60vw] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Configure {server.name}</DialogTitle>
          <DialogDescription>
            Set up authentication and permissions for this MCP server
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Configuration Name and Description */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="config-name">Configuration Name *</Label>
                <Input
                  id="config-name"
                  placeholder="Enter a name for this configuration"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="config-description">Description</Label>
                <Textarea
                  id="config-description"
                  placeholder="Optional description for this configuration"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <Separator />

            {/* Authentication Type Selection */}
            <div className="space-y-3">
              <Label>Authentication Type</Label>
              <RadioGroup
                value={selectedAuthType}
                onValueChange={(value) =>
                  setSelectedAuthType(value as AuthType)
                }
              >
                {server.supported_auth_types.map((authType) => (
                  <div key={authType} className="flex items-center space-x-2">
                    <RadioGroupItem value={authType} id={authType} />
                    <Label htmlFor={authType} className="font-normal">
                      {authType}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>

            <Separator />

            {/* Tools Configuration */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Tools Access</Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="all-tools"
                    checked={allToolsEnabled}
                    onCheckedChange={(checked) => setAllToolsEnabled(!!checked)}
                  />
                  <Label htmlFor="all-tools" className="font-normal">
                    Enable all tools
                  </Label>
                </div>
              </div>

              {!allToolsEnabled && server.tools && server.tools.length > 0 && (
                <div className="space-y-2 pl-4">
                  <p className="text-sm text-muted-foreground">
                    Select specific tools to enable:
                  </p>
                  <div className="space-y-2">
                    {server.tools.map((tool) => (
                      <div key={tool.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={tool.id}
                          checked={selectedTools.has(tool.id)}
                          onCheckedChange={() => handleToolToggle(tool.id)}
                        />
                        <div className="space-y-1">
                          <Label htmlFor={tool.id} className="font-normal">
                            {tool.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!allToolsEnabled && selectedTools.size === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Warning: No tools are selected. The configuration will have
                    no enabled tools.
                  </AlertDescription>
                </Alert>
              )}
            </div>

            <Separator />

            {/* Teams Configuration */}
            <div className="space-y-3">
              <Label>Team Access</Label>
              <p className="text-sm text-muted-foreground">
                Select teams that can access this MCP server (leave empty for
                all teams)
              </p>

              {teamsLoading ? (
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">
                    Loading teams...
                  </span>
                </div>
              ) : teams.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No teams found. Create teams in your organization settings
                    first.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div
                      key={team.team_id}
                      className="flex items-start space-x-2"
                    >
                      <Checkbox
                        id={team.team_id}
                        checked={selectedTeams.has(team.team_id)}
                        onCheckedChange={() => handleTeamToggle(team.team_id)}
                      />
                      <div className="space-y-1">
                        <Label
                          htmlFor={team.team_id}
                          className="font-normal cursor-pointer"
                        >
                          {team.name}
                        </Label>
                        {team.description && (
                          <p className="text-xs text-muted-foreground">
                            {team.description}
                          </p>
                        )}
                        {team.member_count !== undefined && (
                          <p className="text-xs text-muted-foreground">
                            {team.member_count} member
                            {team.member_count !== 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {selectedTeams.size > 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {selectedTeams.size} team
                    {selectedTeams.size !== 1 ? "s" : ""} selected. Only members
                    of these teams will have access to this MCP server.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createConfiguration.isPending}
          >
            {createConfiguration.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Configure Server
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
