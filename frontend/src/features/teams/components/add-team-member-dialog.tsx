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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, Search, UserPlus } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-client";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

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
        }
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
        }
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
      queryClient.invalidateQueries({ queryKey: ["team-members", activeOrg.orgId, teamId] });
      toast.success("Member added successfully");
      setSelectedUserId(null);
      setSearchQuery("");
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

  // Filter out team members and apply search
  const availableMembers = orgMembers?.filter((member) => {
    const isNotInTeam = !teamMembers?.some((tm) => tm.user_id === member.user_id);
    const matchesSearch = 
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase());
    return isNotInTeam && matchesSearch;
  }) || [];

  const selectedMember = availableMembers.find((m) => m.user_id === selectedUserId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>
            Select a member from your organization to add to this team
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search Organization Members</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Loading organization members...
            </div>
          ) : (
            <div className="border rounded-md max-h-60 overflow-y-auto">
              <Command>
                <CommandList>
                  {availableMembers.length === 0 ? (
                    <CommandEmpty>
                      {searchQuery
                        ? "No members found matching your search"
                        : "No available members to add"}
                    </CommandEmpty>
                  ) : (
                    <CommandGroup>
                      {availableMembers.map((member) => (
                        <CommandItem
                          key={member.user_id}
                          value={member.user_id}
                          onSelect={() => setSelectedUserId(member.user_id)}
                          className="flex items-center justify-between cursor-pointer"
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
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
                          {selectedUserId === member.user_id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                </CommandList>
              </Command>
            </div>
          )}

          {selectedMember && (
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-md">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Selected: {selectedMember.name}</p>
                <p className="text-xs text-muted-foreground">{selectedMember.email}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedUserId(null);
              setSearchQuery("");
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