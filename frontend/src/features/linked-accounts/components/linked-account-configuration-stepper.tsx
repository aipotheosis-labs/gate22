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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2, AlertCircle, ChevronRight, ChevronLeft } from "lucide-react";
import { LinkedAccount } from "../types/linkedaccount.types";
import { toast } from "sonner";
import { listTeams } from "@/features/teams/api/team";
import { useMetaInfo } from "@/components/context/metainfo";
import { Team } from "@/features/teams/types/team.types";

interface LinkedAccountConfigurationStepperProps {
  isOpen: boolean;
  onClose: () => void;
  account?: LinkedAccount;
}

// Define the stepper
const { useStepper, steps } = defineStepper(
  { id: "connection", label: "Connection" },
  { id: "permissions", label: "Permissions" },
  { id: "authentication", label: "Authentication" },
);

export function LinkedAccountConfigurationStepper({
  isOpen,
  onClose,
  account,
}: LinkedAccountConfigurationStepperProps) {
  const stepper = useStepper();
  const [appName, setAppName] = useState(account?.app_name || "");
  const [accountOwnerId, setAccountOwnerId] = useState(
    account?.linked_account_owner_id || "",
  );
  const [securityScheme, setSecurityScheme] = useState(
    account?.security_scheme || "oauth2",
  );
  const [allPermissionsEnabled, setAllPermissionsEnabled] = useState(true);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(),
  );
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [authCredentials, setAuthCredentials] = useState({
    clientId: "",
    clientSecret: "",
    apiKey: "",
    username: "",
    password: "",
  });

  const { accessToken, activeOrg } = useMetaInfo();

  // Mock permissions - in real app, these would come from the API
  const availablePermissions = [
    { id: "read", name: "Read", description: "Read access to account data" },
    { id: "write", name: "Write", description: "Write access to account data" },
    {
      id: "delete",
      name: "Delete",
      description: "Delete access to account data",
    },
    { id: "admin", name: "Admin", description: "Full administrative access" },
  ];

  useEffect(() => {
    if (isOpen && stepper.current.id === "permissions") {
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
  }, [isOpen, stepper.current.id, accessToken, activeOrg.orgId, stepper]);

  const handlePermissionToggle = (permissionId: string) => {
    const newSelectedPermissions = new Set(selectedPermissions);
    if (newSelectedPermissions.has(permissionId)) {
      newSelectedPermissions.delete(permissionId);
    } else {
      newSelectedPermissions.add(permissionId);
    }
    setSelectedPermissions(newSelectedPermissions);
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
    const configurationData = {
      app_name: appName,
      linked_account_owner_id: accountOwnerId,
      security_scheme: securityScheme,
      all_permissions_enabled: allPermissionsEnabled,
      enabled_permissions: allPermissionsEnabled
        ? []
        : Array.from(selectedPermissions),
      allowed_teams: Array.from(selectedTeams),
      credentials: authCredentials,
    };

    try {
      // In real app, this would call the API
      console.log("Submitting configuration:", configurationData);
      toast.success("Linked account configured successfully");
      onClose();
    } catch {
      toast.error("Failed to configure linked account");
    }
  };

  const isStepValid = (stepId: string) => {
    switch (stepId) {
      case "connection":
        return appName.trim() !== "" && accountOwnerId.trim() !== "";
      case "permissions":
        return allPermissionsEnabled || selectedPermissions.size > 0;
      case "authentication":
        if (securityScheme === "oauth2") {
          return (
            authCredentials.clientId.trim() !== "" &&
            authCredentials.clientSecret.trim() !== ""
          );
        } else if (securityScheme === "apikey") {
          return authCredentials.apiKey.trim() !== "";
        } else if (securityScheme === "basic") {
          return (
            authCredentials.username.trim() !== "" &&
            authCredentials.password.trim() !== ""
          );
        }
        return true;
      default:
        return false;
    }
  };

  const canProceed = isStepValid(stepper.current.id);
  const currentStepIndex = steps.findIndex((s) => s.id === stepper.current.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[60vw] max-w-[60vw] w-[60vw] h-[85vh] p-0 flex flex-col">
        <div className="flex flex-col h-full overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0">
            <DialogTitle>
              {account ? `Configure ${account.app_name}` : "Add Linked Account"}
            </DialogTitle>
            <DialogDescription>
              Set up your account connection and permissions
            </DialogDescription>
          </DialogHeader>

          {/* Main Content */}
          <div className="flex-1 px-6 pb-6 min-h-0">
            <Card className="h-full flex flex-col overflow-hidden">
              <CardHeader className="px-6 py-3 flex-shrink-0 border-b">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-foreground/70 font-medium mb-0.5">
                      Step {currentStepIndex + 1} of {steps.length}
                    </div>
                    <div className="text-base text-foreground">
                      {stepper.current.id === "connection" &&
                        "Configure your account connection"}
                      {stepper.current.id === "permissions" &&
                        "Set permissions and team access"}
                      {stepper.current.id === "authentication" &&
                        "Provide authentication credentials"}
                    </div>
                  </div>
                </div>
              </CardHeader>

              <ScrollArea className="flex-1 min-h-0">
                <CardContent className="pt-6 pb-4">
                  {stepper.current.id === "connection" && (
                    <div className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="app-name">Application Name</Label>
                        <Input
                          id="app-name"
                          placeholder="e.g., GitHub, Slack, Jira"
                          value={appName}
                          onChange={(e) => setAppName(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          The name of the application you&apos;re connecting
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="account-owner">Account Owner ID</Label>
                        <Input
                          id="account-owner"
                          placeholder="e.g., user@example.com"
                          value={accountOwnerId}
                          onChange={(e) => setAccountOwnerId(e.target.value)}
                        />
                        <p className="text-sm text-muted-foreground">
                          Unique identifier for the account owner
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Security Scheme</Label>
                        <RadioGroup
                          value={securityScheme}
                          onValueChange={setSecurityScheme}
                          className="space-y-3"
                        >
                          <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="oauth2" id="oauth2" />
                            <div className="flex-1">
                              <Label
                                htmlFor="oauth2"
                                className="font-medium cursor-pointer"
                              >
                                OAuth 2.0
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Connect using OAuth 2.0 flow with client
                                credentials
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="apikey" id="apikey" />
                            <div className="flex-1">
                              <Label
                                htmlFor="apikey"
                                className="font-medium cursor-pointer"
                              >
                                API Key
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Authenticate using an API key
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                            <RadioGroupItem value="basic" id="basic" />
                            <div className="flex-1">
                              <Label
                                htmlFor="basic"
                                className="font-medium cursor-pointer"
                              >
                                Basic Auth
                              </Label>
                              <p className="text-sm text-muted-foreground mt-1">
                                Authenticate using username and password
                              </p>
                            </div>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  )}

                  {stepper.current.id === "permissions" && (
                    <div className="space-y-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <Label
                              htmlFor="all-permissions"
                              className="text-base font-medium"
                            >
                              Enable all permissions
                            </Label>
                            <p className="text-sm text-muted-foreground mt-1">
                              Grant all available permissions for this account
                            </p>
                          </div>
                          <Checkbox
                            id="all-permissions"
                            checked={allPermissionsEnabled}
                            onCheckedChange={(checked) =>
                              setAllPermissionsEnabled(!!checked)
                            }
                          />
                        </div>

                        {!allPermissionsEnabled && (
                          <div className="space-y-3">
                            <Label className="text-sm font-medium">
                              Select specific permissions:
                            </Label>
                            <div className="grid gap-3">
                              {availablePermissions.map((permission) => (
                                <div
                                  key={permission.id}
                                  className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                                >
                                  <Checkbox
                                    id={permission.id}
                                    checked={selectedPermissions.has(
                                      permission.id,
                                    )}
                                    onCheckedChange={() =>
                                      handlePermissionToggle(permission.id)
                                    }
                                    className="mt-1"
                                  />
                                  <div className="flex-1 space-y-1">
                                    <Label
                                      htmlFor={permission.id}
                                      className="font-medium cursor-pointer"
                                    >
                                      {permission.name}
                                    </Label>
                                    <p className="text-sm text-muted-foreground">
                                      {permission.description}
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <Label className="text-sm font-medium">
                          Team Access (Optional):
                        </Label>
                        {teamsLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" />
                            <span className="text-muted-foreground">
                              Loading teams...
                            </span>
                          </div>
                        ) : teams.length === 0 ? (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              No teams found. Create teams in your organization
                              settings first.
                            </AlertDescription>
                          </Alert>
                        ) : (
                          <div className="grid gap-3">
                            {teams.map((team) => (
                              <div
                                key={team.team_id}
                                className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                              >
                                <Checkbox
                                  id={team.team_id}
                                  checked={selectedTeams.has(team.team_id)}
                                  onCheckedChange={() =>
                                    handleTeamToggle(team.team_id)
                                  }
                                  className="mt-1"
                                />
                                <div className="flex-1 space-y-1">
                                  <Label
                                    htmlFor={team.team_id}
                                    className="font-medium cursor-pointer"
                                  >
                                    {team.name}
                                  </Label>
                                  {team.description && (
                                    <p className="text-sm text-muted-foreground">
                                      {team.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {stepper.current.id === "authentication" && (
                    <div className="space-y-6">
                      {securityScheme === "oauth2" && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="client-id">Client ID</Label>
                            <Input
                              id="client-id"
                              type="text"
                              placeholder="Enter your OAuth client ID"
                              value={authCredentials.clientId}
                              onChange={(e) =>
                                setAuthCredentials({
                                  ...authCredentials,
                                  clientId: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="client-secret">Client Secret</Label>
                            <Input
                              id="client-secret"
                              type="password"
                              placeholder="Enter your OAuth client secret"
                              value={authCredentials.clientSecret}
                              onChange={(e) =>
                                setAuthCredentials({
                                  ...authCredentials,
                                  clientSecret: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}

                      {securityScheme === "apikey" && (
                        <div className="space-y-2">
                          <Label htmlFor="api-key">API Key</Label>
                          <Input
                            id="api-key"
                            type="password"
                            placeholder="Enter your API key"
                            value={authCredentials.apiKey}
                            onChange={(e) =>
                              setAuthCredentials({
                                ...authCredentials,
                                apiKey: e.target.value,
                              })
                            }
                          />
                          <p className="text-sm text-muted-foreground">
                            Your API key will be securely stored and encrypted
                          </p>
                        </div>
                      )}

                      {securityScheme === "basic" && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                              id="username"
                              type="text"
                              placeholder="Enter your username"
                              value={authCredentials.username}
                              onChange={(e) =>
                                setAuthCredentials({
                                  ...authCredentials,
                                  username: e.target.value,
                                })
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="password">Password</Label>
                            <Input
                              id="password"
                              type="password"
                              placeholder="Enter your password"
                              value={authCredentials.password}
                              onChange={(e) =>
                                setAuthCredentials({
                                  ...authCredentials,
                                  password: e.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      )}

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          Your credentials will be encrypted and stored
                          securely. We never share your authentication details.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </CardContent>
              </ScrollArea>

              {/* Footer with navigation buttons */}
              <div className="bg-muted/30 flex-shrink-0">
                <div className="flex justify-between items-center px-6 py-3">
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
                    {stepper.isFirst ? "Cancel" : "Previous"}
                  </Button>

                  <div className="flex gap-2">
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
                        disabled={!canProceed}
                      >
                        Complete Configuration
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
