"use client";

import { useState, useEffect } from "react";
import { defineStepper } from "@stepperize/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
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

interface MCPServerConfigurationStepperProps {
  isOpen: boolean;
  onClose: () => void;
  server: MCPServerPublic;
}

// Define the stepper outside the component
const { useStepper, steps } = defineStepper(
  { id: "tools", label: "Tools" },
  { id: "teams", label: "Teams" },
  { id: "account", label: "Authentication" },
);

// Helper functions for auth type display
const getAuthTypeLabel = (authType: string): string => {
  switch (authType) {
    case "NONE":
      return "No Authentication";
    case "API_KEY":
      return "API Key";
    case "OAUTH":
      return "OAuth 2.0";
    case "BASIC":
      return "Basic Auth";
    default:
      return authType;
  }
};

const getAuthTypeDescription = (authType: string): string => {
  switch (authType) {
    case "NONE":
      return "No authentication required";
    case "API_KEY":
      return "Use an API key for authentication";
    case "OAUTH":
      return "Authenticate via OAuth 2.0 flow";
    case "BASIC":
      return "Username and password authentication";
    default:
      return "";
  }
};

export function MCPServerConfigurationStepper({
  isOpen,
  onClose,
  server,
}: MCPServerConfigurationStepperProps) {
  const stepper = useStepper();
  const [selectedAuthType, setSelectedAuthType] = useState<AuthType>(
    server?.supported_auth_types?.[0] || AuthType.NONE,
  );
  const [allToolsEnabled, setAllToolsEnabled] = useState(true);
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);

  const { accessToken, activeOrg } = useMetaInfo();
  const createConfiguration = useCreateMCPServerConfiguration();

  // Reset state when dialog opens
  useEffect(() => {
    if (isOpen) {
      stepper.reset();
      setSelectedTools(new Set());
      setSelectedTeams(new Set());
      setAllToolsEnabled(true);
      setSelectedAuthType(server?.supported_auth_types?.[0] || AuthType.NONE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && stepper.current.id === "teams") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, stepper.current.id, accessToken, activeOrg.orgId]);

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
    // Final validation
    if (selectedTeams.size === 0) {
      toast.error("Please select at least one team");
      stepper.goTo("teams"); // Go to teams step
      return;
    }

    const configurationData: MCPServerConfigurationCreate = {
      mcp_server_id: server.id,
      auth_type: selectedAuthType,
      all_tools_enabled: allToolsEnabled,
      enabled_tools: allToolsEnabled ? [] : Array.from(selectedTools),
      allowed_teams: Array.from(selectedTeams),
    };

    try {
      await createConfiguration.mutateAsync(configurationData);
      toast.success("MCP server configured successfully");
      onClose();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to configure MCP server";
      toast.error(errorMessage);
    }
  };

  const isStepValid = (stepId: string) => {
    switch (stepId) {
      case "tools":
        return allToolsEnabled || selectedTools.size > 0;
      case "teams":
        return selectedTeams.size > 0; // Must select at least one team
      case "account":
        return (
          !server?.supported_auth_types ||
          server.supported_auth_types.length === 0 ||
          selectedAuthType !== undefined
        );
      default:
        return false;
    }
  };

  const canProceed = isStepValid(stepper.current.id);
  const currentStepIndex = steps.findIndex((s) => s.id === stepper.current.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[80vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
          <DialogTitle>Configure {server?.name}</DialogTitle>
          <DialogDescription>
            Set up access and authentication for this MCP server
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <ScrollArea className="flex-1 px-6">
          <div className="space-y-6 pb-4">
            {stepper.current.id === "tools" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Select Tools</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose which tools should be available
                  </p>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <Label
                      htmlFor="all-tools"
                      className="text-sm font-medium cursor-pointer"
                    >
                      Enable all tools
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Grant access to all {server?.tools?.length || 0} available
                      tools
                    </p>
                  </div>
                  <Checkbox
                    id="all-tools"
                    checked={allToolsEnabled}
                    onCheckedChange={(checked) => setAllToolsEnabled(!!checked)}
                  />
                </div>

                {!allToolsEnabled &&
                  server?.tools &&
                  server.tools.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Select specific tools:
                      </Label>
                      <div className="grid gap-1.5 max-h-[250px] overflow-y-auto pr-2">
                        {server?.tools?.map((tool) => (
                          <label
                            key={tool.id}
                            className="flex items-start space-x-2 p-2 border rounded hover:bg-accent/50 transition-colors cursor-pointer"
                          >
                            <Checkbox
                              id={tool.id}
                              checked={selectedTools.has(tool.id)}
                              onCheckedChange={() => handleToolToggle(tool.id)}
                              className="mt-0.5"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">
                                {tool.name}
                              </div>
                              {tool.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {tool.description}
                                </p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                {!allToolsEnabled && selectedTools.size === 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      Please select at least one tool or enable all tools
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            {stepper.current.id === "teams" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Assign Teams</h3>
                  <p className="text-xs text-muted-foreground">
                    Select which teams can access this server
                  </p>
                </div>

                {teamsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    <span className="text-sm text-muted-foreground">
                      Loading teams...
                    </span>
                  </div>
                ) : teams.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      No teams found. Create teams in your organization settings
                      first.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground">
                        Available teams
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        {selectedTeams.size} selected
                      </span>
                    </div>
                    <div className="grid gap-1.5 max-h-[300px] overflow-y-auto pr-2">
                      {teams.map((team) => (
                        <label
                          key={team.team_id}
                          className="flex items-start space-x-2 p-2 border rounded hover:bg-accent/50 transition-colors cursor-pointer"
                        >
                          <Checkbox
                            id={team.team_id}
                            checked={selectedTeams.has(team.team_id)}
                            onCheckedChange={() =>
                              handleTeamToggle(team.team_id)
                            }
                            className="mt-0.5"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium">
                                {team.name}
                              </span>
                              {team.member_count !== undefined && (
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {team.member_count} member
                                  {team.member_count !== 1 ? "s" : ""}
                                </span>
                              )}
                            </div>
                            {team.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {team.description}
                              </p>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTeams.size === 0 &&
                  !teamsLoading &&
                  teams.length > 0 && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        Please select at least one team to proceed
                      </AlertDescription>
                    </Alert>
                  )}
              </div>
            )}

            {stepper.current.id === "account" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">Authentication</h3>
                  <p className="text-xs text-muted-foreground">
                    Choose how users will authenticate
                  </p>
                </div>

                {!server?.supported_auth_types ||
                server.supported_auth_types.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      No authentication methods available for this server.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <RadioGroup
                    value={selectedAuthType}
                    onValueChange={(value) =>
                      setSelectedAuthType(value as AuthType)
                    }
                    className="space-y-1.5"
                  >
                    {server.supported_auth_types.map((authType) => (
                      <label
                        key={authType}
                        htmlFor={authType}
                        className="flex items-center space-x-2 p-2 border rounded hover:bg-accent/50 transition-colors cursor-pointer"
                      >
                        <RadioGroupItem value={authType} id={authType} />
                        <div className="flex-1">
                          <div className="text-sm font-medium">
                            {getAuthTypeLabel(authType)}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getAuthTypeDescription(authType)}
                          </p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer with navigation */}
        <div className="border-t px-6 py-3 flex-shrink-0">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (stepper.isFirst) {
                  onClose();
                } else {
                  stepper.prev();
                }
              }}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              {stepper.isFirst ? "Cancel" : "Back"}
            </Button>

            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              {!stepper.isLast ? (
                <Button
                  size="sm"
                  onClick={() => stepper.next()}
                  disabled={!canProceed}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createConfiguration.isPending || !canProceed}
                >
                  {createConfiguration.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Complete
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
