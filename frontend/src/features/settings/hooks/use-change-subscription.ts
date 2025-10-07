import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMetaInfo } from "@/components/context/metainfo";
import { subscriptionApi } from "../api/subscription";
import { ChangeSubscriptionRequest } from "../types/subscription.types";
import { QUERY_KEYS } from "../constants";
import { toast } from "sonner";

export function useChangeSubscription() {
  const queryClient = useQueryClient();
  const { activeOrg, accessToken } = useMetaInfo();

  const changeSubscriptionMutation = useMutation({
    mutationFn: (data: ChangeSubscriptionRequest) => {
      if (!activeOrg?.orgId) {
        throw new Error("No organization selected");
      }
      return subscriptionApi.changeSubscription(activeOrg.orgId, data, accessToken);
    },
    onSuccess: (response) => {
      if (response.url) {
        // Redirect to Stripe checkout
        window.location.href = response.url;
      } else {
        // Refresh subscription status
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.SUBSCRIPTION_STATUS(activeOrg?.orgId || ""),
        });
        toast.success("Subscription updated successfully");
      }
    },
    onError: (error) => {
      console.error("Error changing subscription:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to change subscription. Please try again.",
      );
    },
  });

  return {
    changeSubscription: changeSubscriptionMutation.mutate,
    isChanging: changeSubscriptionMutation.isPending,
  };
}
