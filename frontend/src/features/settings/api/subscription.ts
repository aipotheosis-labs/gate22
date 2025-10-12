import { createAuthenticatedRequest } from "@/lib/api-client";
import {
  SubscriptionStatus,
  ChangeSubscriptionRequest,
  ChangeSeatCountRequest,
  ChangePlanRequest,
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

  changeSeatCount: async (
    organizationId: string,
    data: ChangeSeatCountRequest,
    token?: string,
  ): Promise<ChangeSubscriptionResponse> => {
    const api = createAuthenticatedRequest(token);
    return api.post<ChangeSubscriptionResponse>(
      `/subscriptions/organizations/${organizationId}/subscription-seat-change`,
      data,
    );
  },

  changePlan: async (
    organizationId: string,
    data: ChangePlanRequest,
    token?: string,
  ): Promise<ChangeSubscriptionResponse> => {
    const api = createAuthenticatedRequest(token);
    return api.post<ChangeSubscriptionResponse>(
      `/subscriptions/organizations/${organizationId}/subscription-plan-change`,
      data,
    );
  },

  getPlans: async (token?: string): Promise<Plan[]> => {
    const api = createAuthenticatedRequest(token);
    return api.get<Plan[]>("/subscriptions/plans");
  },

  cancelSubscription: async (organizationId: string, token?: string): Promise<void> => {
    const api = createAuthenticatedRequest(token);
    return api.post<void>(`/subscriptions/organizations/${organizationId}/cancel-subscription`);
  },
};
