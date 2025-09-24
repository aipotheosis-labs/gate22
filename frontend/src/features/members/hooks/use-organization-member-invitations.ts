import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useMetaInfo } from "@/components/context/metainfo";
import {
  cancelOrganizationInvitation,
  inviteToOrganization,
  listOrganizationInvitations,
} from "@/features/settings/api/organization";
import { QUERY_KEYS } from "@/features/settings/constants";
import {
  OrganizationInvitationDetail,
  OrganizationInvitationStatus,
} from "@/features/invitations/types/invitation.types";

interface UseOrganizationInvitationsOptions {
  status?: OrganizationInvitationStatus;
}

export function useOrganizationMemberInvitations(
  options: UseOrganizationInvitationsOptions = {},
) {
  const { accessToken, activeOrg } = useMetaInfo();
  const queryClient = useQueryClient();
  const statusKey = options.status ?? "all";

  const enabled = Boolean(accessToken && activeOrg?.orgId);

  const invitationsQuery = useQuery<OrganizationInvitationDetail[]>({
    queryKey: QUERY_KEYS.ORGANIZATION_INVITATIONS(
      activeOrg?.orgId || "",
      statusKey,
    ),
    queryFn: async () => {
      if (!accessToken || !activeOrg?.orgId) {
        throw new Error("Organization context unavailable");
      }
      return listOrganizationInvitations(
        accessToken,
        activeOrg.orgId,
        options.status,
      );
    },
    enabled,
  });

  const invalidateInvitations = useMemo(() => {
    return () => {
      if (!activeOrg?.orgId) return;
      queryClient.invalidateQueries({
        queryKey: ["org-invitations", activeOrg.orgId],
      });
    };
  }, [activeOrg?.orgId, queryClient]);

  const memberInvitationMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: string }) => {
      if (!accessToken || !activeOrg?.orgId) {
        throw new Error("Organization context unavailable");
      }
      return inviteToOrganization(accessToken, activeOrg.orgId, email, role);
    },
    onSuccess: (invitation, variables) => {
      invalidateInvitations();
      toast.success(`Invitation sent to ${variables.email}`);
      return invitation;
    },
    onError: (error) => {
      console.error("Failed to invite member:", error);
      toast.error("Failed to send invitation. Please try again.");
    },
  });

  const cancelInvitationMutation = useMutation({
    mutationFn: async (invitationId: string) => {
      if (!accessToken || !activeOrg?.orgId) {
        throw new Error("Organization context unavailable");
      }
      return cancelOrganizationInvitation(
        accessToken,
        activeOrg.orgId,
        invitationId,
      );
    },
    onSuccess: (invitation) => {
      invalidateInvitations();
      toast.success(`Invitation for ${invitation.email} canceled`);
    },
    onError: (error) => {
      console.error("Failed to cancel invitation:", error);
      toast.error("Failed to cancel invitation. Please try again.");
    },
  });

  return {
    invitations: invitationsQuery.data,
    isLoading: invitationsQuery.isLoading,
    isError: invitationsQuery.isError,
    error: invitationsQuery.error,
    refetch: invitationsQuery.refetch,
    createMemberInvitation: memberInvitationMutation.mutate,
    createMemberInvitationAsync: memberInvitationMutation.mutateAsync,
    isInviting: memberInvitationMutation.isPending,
    cancelInvitation: cancelInvitationMutation.mutate,
    cancelInvitationAsync: cancelInvitationMutation.mutateAsync,
    isCancelling: cancelInvitationMutation.isPending,
  };
}
