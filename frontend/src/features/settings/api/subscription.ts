import { createAuthenticatedRequest } from "@/lib/api-client";
import { SubscriptionStatus } from "../types/subscription.types";

export const subscriptionApi = {
  getSubscriptionStatus: async (
    organizationId: string,
    token?: string,
    userRole?: string,
  ): Promise<SubscriptionStatus> => {
    const api = createAuthenticatedRequest(token, organizationId, userRole);
    return api.get<SubscriptionStatus>(
      `/subscriptions/organizations/${organizationId}/subscription-status`,
    );
  },
};
