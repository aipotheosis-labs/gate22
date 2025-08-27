"use client";

import { useState } from "react";
import { useMetaInfo } from "@/components/context/metainfo";
import { addTeamMember } from "@/features/teams/api/team";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronDown, UserPlus, Users } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AddTeamMemberDialogProps {
  teamId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface OrganizationMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export function AddTeamMemberDialog({
  teamId,
  open,
  onOpenChange,
  onSuccess,
}: AddTeamMemberDialogProps) {
  const { accessToken, activeOrg } = useMetaInfo();
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [comboboxOpen, setComboboxOpen] = useState(false);

  // Fetch organization members
  const { data: orgMembers, isLoading } = useQuery({
    queryKey: ["organization-members", activeOrg.orgId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/v1/organizations/${activeOrg.orgId}/members`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch organization members");
      }
      return response.json() as Promise<OrganizationMember[]>;
    },
    enabled: open && !!accessToken && !!activeOrg.orgId,
  });

  // Fetch current team members to filter them out
  const { data: teamMembers } = useQuery({
    queryKey: ["team-members", activeOrg.orgId, teamId],
    queryFn: async () => {
      const baseUrl = getApiBaseUrl();
      const response = await fetch(
        `${baseUrl}/v1/organizations/${activeOrg.orgId}/teams/${teamId}/members`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch team members");
      }
      return response.json() as Promise<{ user_id: string }[]>;
    },
    enabled: open && !!accessToken && !!activeOrg.orgId && !!teamId,
  });

  const addMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      addTeamMember(accessToken, activeOrg.orgId, teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["team-members", activeOrg.orgId, teamId],
      });
      toast.success("Member added successfully");
      setSelectedUserId("");
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error("Failed to add member:", error);
      toast.error("Failed to add member to team");
    },
  });

  const handleAddMember = () => {
    if (!selectedUserId) {
      toast.error("Please select a member to add");
      return;
    }
    addMemberMutation.mutate(selectedUserId);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Filter out team members
  const availableMembers =
    orgMembers?.filter((member) => {
      const isNotInTeam = !teamMembers?.some(
        (tm) => tm.user_id === member.user_id,
      );
      return isNotInTeam;
    }) || [];

  const selectedMember = availableMembers.find(
    (m) => m.user_id === selectedUserId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Search and select a member from your organization to add to this
            team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-select">Select Member</Label>
            <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="member-select"
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboboxOpen}
                  className="w-full justify-between font-normal"
                  disabled={isLoading || availableMembers.length === 0}
                >
                  {selectedMember ? (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-xs">
                          {getInitials(selectedMember.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedMember.name}</span>
                      <span className="text-muted-foreground text-sm">
                        ({selectedMember.email})
                      </span>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">
                      {isLoading
                        ? "Loading members..."
                        : "Choose a member to add..."}
                    </span>
                  )}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[400px] p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Search by name or email..."
                    className="h-9"
                  />
                  <CommandList>
                    {availableMembers.length === 0 ? (
                      <CommandEmpty>
                        <div className="flex flex-col items-center py-4">
                          <Users className="h-8 w-8 mb-2 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">
                            No available members to add
                          </p>
                        </div>
                      </CommandEmpty>
                    ) : (
                      <>
                        <CommandEmpty>No member found.</CommandEmpty>
                        <CommandGroup>
                          {availableMembers.map((member) => (
                            <CommandItem
                              key={member.user_id}
                              value={member.user_id}
                              keywords={[member.name, member.email]}
                              onSelect={(currentValue) => {
                                setSelectedUserId(
                                  currentValue === selectedUserId
                                    ? ""
                                    : currentValue,
                                );
                                setComboboxOpen(false);
                              }}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <Avatar className="h-7 w-7">
                                  <AvatarFallback className="text-xs">
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
                              </div>
                              <Check
                                className={cn(
                                  "ml-auto h-4 w-4",
                                  selectedUserId === member.user_id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {selectedMember && (
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-md">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">
                  Ready to add: {selectedMember.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedMember.email}
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedUserId("");
              onOpenChange(false);
            }}
            disabled={addMemberMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddMember}
            disabled={!selectedUserId || addMemberMutation.isPending}
          >
            {addMemberMutation.isPending ? "Adding..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
