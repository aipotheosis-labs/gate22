"use client";

import { useState } from "react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
import { createTeam, addTeamMember } from "@/features/teams/api/team";
import { listOrganizationUsers } from "@/features/settings/api/organization";
import { Team } from "@/features/teams/types/team.types";
import { OrganizationUser } from "@/features/settings/types/organization.types";
import {
  Check,
  UserPlus,
  Users,
  ChevronRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateTeamWithMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (team: Team) => void;
}

type Step = "create-team" | "add-members";

export function CreateTeamWithMembersDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateTeamWithMembersDialogProps) {
  const { accessToken, activeOrg } = useMetaInfo();
  const [currentStep, setCurrentStep] = useState<Step>("create-team");
  const [isLoading, setIsLoading] = useState(false);
  const [createdTeam, setCreatedTeam] = useState<Team | null>(null);

  // Team creation form data
  const [teamFormData, setTeamFormData] = useState({
    name: "",
    description: "",
  });

  // Member selection
  const [orgMembers, setOrgMembers] = useState<OrganizationUser[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(
    new Set(),
  );
  const [membersLoading, setMembersLoading] = useState(false);

  // Load organization members when moving to add-members step
  const loadOrganizationMembers = async () => {
    setMembersLoading(true);
    try {
      const members = await listOrganizationUsers(accessToken, activeOrg.orgId);
      setOrgMembers(members);
    } catch {
      toast.error("Failed to load organization members");
    } finally {
      setMembersLoading(false);
    }
  };

  // Handle team creation
  const handleCreateTeam = async () => {
    if (!teamFormData.name.trim()) {
      toast.error("Team name is required");
      return;
    }

    setIsLoading(true);
    try {
      const newTeam = await createTeam(
        accessToken,
        activeOrg.orgId,
        teamFormData,
      );
      setCreatedTeam(newTeam);
      toast.success(`Team "${teamFormData.name}" created successfully`);

      // Move to member addition step
      setCurrentStep("add-members");
      await loadOrganizationMembers();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create team";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding members to the team
  const handleAddMembers = async () => {
    if (!createdTeam) return;

    if (selectedMembers.size === 0) {
      // Skip member addition and complete
      handleComplete();
      return;
    }

    setIsLoading(true);
    const errors: string[] = [];

    // Add each selected member to the team
    for (const userId of selectedMembers) {
      try {
        await addTeamMember(
          accessToken,
          activeOrg.orgId,
          createdTeam.team_id,
          userId,
        );
      } catch {
        const member = orgMembers.find((m) => m.user_id === userId);
        errors.push(member?.name || userId);
      }
    }

    setIsLoading(false);

    if (errors.length > 0) {
      toast.error(`Failed to add some members: ${errors.join(", ")}`);
    } else if (selectedMembers.size > 0) {
      toast.success(
        `Added ${selectedMembers.size} member${selectedMembers.size > 1 ? "s" : ""} to the team`,
      );
    }

    handleComplete();
  };

  // Complete the process
  const handleComplete = () => {
    if (createdTeam) {
      onSuccess?.(createdTeam);
    }
    handleClose();
  };

  // Reset and close dialog
  const handleClose = () => {
    if (!isLoading) {
      setCurrentStep("create-team");
      setTeamFormData({ name: "", description: "" });
      setSelectedMembers(new Set());
      setCreatedTeam(null);
      setOrgMembers([]);
      onOpenChange(false);
    }
  };

  // Toggle member selection
  const toggleMemberSelection = (userId: string) => {
    const newSelection = new Set(selectedMembers);
    if (newSelection.has(userId)) {
      newSelection.delete(userId);
    } else {
      newSelection.add(userId);
    }
    setSelectedMembers(newSelection);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[525px]">
        {currentStep === "create-team" ? (
          <>
            <DialogHeader>
              <DialogTitle>Create New Team</DialogTitle>
              <DialogDescription>
                Create a new team to organize members and manage access to
                resources.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Team Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  placeholder="Engineering, Marketing, Design..."
                  value={teamFormData.name}
                  onChange={(e) =>
                    setTeamFormData({ ...teamFormData, name: e.target.value })
                  }
                  disabled={isLoading}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the purpose of this team..."
                  value={teamFormData.description}
                  onChange={(e) =>
                    setTeamFormData({
                      ...teamFormData,
                      description: e.target.value,
                    })
                  }
                  disabled={isLoading}
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateTeam}
                disabled={isLoading || !teamFormData.name.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create & Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Add Team Members</DialogTitle>
              <DialogDescription>
                Select members from your organization to add to{" "}
                {createdTeam?.name}. You can skip this step and add members
                later.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {membersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  <span className="text-sm text-muted-foreground">
                    Loading members...
                  </span>
                </div>
              ) : orgMembers.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No other members found in your organization. You can invite
                    members later.
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Select Members</Label>
                    <Command className="border rounded-md">
                      <CommandInput
                        placeholder="Search members by name or email..."
                        className="h-9"
                      />
                      <CommandList>
                        <CommandEmpty>No members found.</CommandEmpty>
                        <CommandGroup>
                          <ScrollArea className="h-[200px]">
                            {orgMembers.map((member) => (
                              <CommandItem
                                key={member.user_id}
                                value={member.user_id}
                                keywords={[member.name, member.email]}
                                onSelect={() =>
                                  toggleMemberSelection(member.user_id)
                                }
                                className="cursor-pointer"
                              >
                                <div className="flex items-center gap-3 flex-1">
                                  <Avatar className="h-7 w-7">
                                    <AvatarFallback className="bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-xs font-medium">
                                      {getInitials(member.name)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex flex-col">
                                    <span className="text-sm font-medium">
                                      {member.name}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {member.email}
                                    </span>
                                  </div>
                                  {member.role && (
                                    <Badge
                                      variant="secondary"
                                      className="ml-auto"
                                    >
                                      {member.role}
                                    </Badge>
                                  )}
                                </div>
                                <Check
                                  className={cn(
                                    "ml-2 h-4 w-4",
                                    selectedMembers.has(member.user_id)
                                      ? "opacity-100"
                                      : "opacity-0",
                                  )}
                                />
                              </CommandItem>
                            ))}
                          </ScrollArea>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>

                  {selectedMembers.size > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>
                        {selectedMembers.size} member
                        {selectedMembers.size !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            <DialogFooter className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleComplete}
                disabled={isLoading}
              >
                Skip
              </Button>
              <Button onClick={handleAddMembers} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding Members...
                  </>
                ) : selectedMembers.size > 0 ? (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add {selectedMembers.size} Member
                    {selectedMembers.size !== 1 ? "s" : ""}
                  </>
                ) : (
                  "Complete"
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
