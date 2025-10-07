import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMetaInfo } from "@/components/context/metainfo";
import { subscriptionApi } from "../api/subscription";
import { QUERY_KEYS } from "../constants";
import { toast } from "sonner";

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  const { activeOrg, accessToken } = useMetaInfo();

  const cancelSubscriptionMutation = useMutation({
    mutationFn: () => {
      if (!activeOrg?.orgId) {
        throw new Error("No organization selected");
      }
      return subscriptionApi.cancelSubscription(activeOrg.orgId, accessToken);
    },
    onSuccess: () => {
      // Refresh subscription status
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.SUBSCRIPTION_STATUS(activeOrg?.orgId || ""),
      });
      toast.success(
        "Subscription cancelled successfully. It will remain active until the end of your billing period.",
      );
    },
    onError: (error) => {
      console.error("Error cancelling subscription:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel subscription. Please try again.",
      );
    },
  });

  return {
    cancelSubscription: cancelSubscriptionMutation.mutate,
    isCancelling: cancelSubscriptionMutation.isPending,
  };
}
