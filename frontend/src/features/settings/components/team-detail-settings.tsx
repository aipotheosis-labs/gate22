"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useMetaInfo } from "@/components/context/metainfo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listTeamMembers, removeTeamMember, getTeam } from "@/features/teams/api/team";
import { AddTeamMemberDialog } from "@/features/teams/components/add-team-member-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  UserMinus,
  UserPlus,
  Settings,
  Shield,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { TeamMember } from "@/features/teams/types/team.types";

interface TeamDetailSettingsProps {
  teamId: string;
}

export function TeamDetailSettings({ teamId }: TeamDetailSettingsProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, activeOrg } = useMetaInfo();
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);

  const { data: team, isLoading: teamLoading } = useQuery({
    queryKey: ["team", activeOrg?.orgId, teamId],
    queryFn: () => getTeam(accessToken, activeOrg.orgId, teamId),
    enabled: !!accessToken && !!activeOrg?.orgId && !!teamId,
  });

  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ["team-members", activeOrg?.orgId, teamId],
    queryFn: () => listTeamMembers(accessToken, activeOrg.orgId, teamId),
    enabled: !!accessToken && !!activeOrg?.orgId && !!teamId,
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) => 
      removeTeamMember(accessToken, activeOrg.orgId, teamId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members", activeOrg?.orgId, teamId] });
      toast.success("Member removed successfully");
      setRemovingMemberId(null);
    },
    onError: (error) => {
      console.error("Failed to remove member:", error);
      toast.error("Failed to remove member");
      setRemovingMemberId(null);
    },
  });

  const getInitials = useMemo(() => (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, []);

  const handleRemoveMember = (userId: string) => {
    setRemovingMemberId(userId);
    removeMemberMutation.mutate(userId);
  };

  const renderLoadingState = () => (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <Skeleton className="h-8 w-32 mb-4" />
        <Skeleton className="h-10 w-64 mb-2" />
        <Skeleton className="h-6 w-96" />
      </div>
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div>
                    <Skeleton className="h-6 w-32 mb-2" />
                    <Skeleton className="h-4 w-48 mb-1" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
                <Skeleton className="h-8 w-8" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderMemberCard = (member: TeamMember) => (
    <div
      key={member.user_id}
      className="flex items-center justify-between p-4 rounded-lg border"
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium">{member.name}</p>
            <Badge variant="secondary">
              <Shield className="h-3 w-3 mr-1" />
              {member.role}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {member.email}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Joined {new Date(member.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0"
            disabled={removingMemberId === member.user_id}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem>
            <Settings className="h-4 w-4 mr-2" />
            Permissions
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => handleRemoveMember(member.user_id)}
            disabled={removingMemberId === member.user_id}
          >
            <UserMinus className="h-4 w-4 mr-2" />
            {removingMemberId === member.user_id ? "Removing..." : "Remove from Team"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  if (teamLoading || membersLoading) {
    return renderLoadingState();
  }

  return (
    <div className="container max-w-6xl py-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/settings/teams")}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Teams
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{team?.name}</h1>
            {team?.description && (
              <p className="text-muted-foreground mt-2">{team.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Team Settings
            </Button>
            <Button onClick={() => setShowAddMemberDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Add Members
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Team Members</CardTitle>
          <CardDescription>
            {members?.length || 0} {members?.length === 1 ? "member" : "members"} in
            this team
          </CardDescription>
        </CardHeader>
        <CardContent>
          {members && members.length > 0 ? (
            <div className="space-y-4">
              {members.map(renderMemberCard)}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <UserPlus className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No members in this team yet</p>
              <p className="text-xs mt-1">
                Click &ldquo;Add Members&rdquo; to add team members
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <AddTeamMemberDialog
        teamId={teamId}
        open={showAddMemberDialog}
        onOpenChange={setShowAddMemberDialog}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["team-members", activeOrg?.orgId, teamId] });
        }}
      />
    </div>
  );
}