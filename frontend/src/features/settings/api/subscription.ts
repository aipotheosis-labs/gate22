import { createAuthenticatedRequest } from "@/lib/api-client";
import {
  SubscriptionStatus,
  ChangeSubscriptionRequest,
  ChangeSubscriptionResponse,
  Plan,
} from "../types/subscription.types";

export const subscriptionApi = {
  getSubscriptionStatus: async (
    organizationId: string,
    token?: string,
  ): Promise<SubscriptionStatus> => {
    const api = createAuthenticatedRequest(token);
    return api.get<SubscriptionStatus>(
      `/subscriptions/organizations/${organizationId}/subscription-status`,
    );
  },

  changeSubscription: async (
    organizationId: string,
    data: ChangeSubscriptionRequest,
    token?: string,
  ): Promise<ChangeSubscriptionResponse> => {
    const api = createAuthenticatedRequest(token);
    return api.post<ChangeSubscriptionResponse>(
      `/subscriptions/organizations/${organizationId}/change-subscription`,
      data,
    );
  },

  getPlans: async (token?: string): Promise<Plan[]> => {
    const api = createAuthenticatedRequest(token);
    return api.get<Plan[]>("/subscriptions/plans");
  },
};
