"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMetaInfo } from "@/components/context/metainfo";
import { toast } from "sonner";
import { Agent } from "@/features/agents/types/agent.types";
import { useApiQuery, createAuthenticatedRequest } from "@/lib/api-client";

type CreateAgentParams = {
  name: string;
  description: string;
  allowed_apps?: string[];
  custom_instructions?: Record<string, string>;
};

export const agentKeys = {
  all: ["agents"] as const,
  detail: (agentId: string) => ["agents", agentId] as const,
};

export const useAgents = () => {
  const { accessToken } = useMetaInfo();
  
  return useApiQuery<Agent[]>(
    agentKeys.all,
    '/v1/agents',
    accessToken,
    {
      enabled: !!accessToken,
    }
  );
};

export const useCreateAgent = () => {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation<Agent, Error, CreateAgentParams>({
    mutationFn: async (params) => {
      const api = createAuthenticatedRequest(accessToken);
      return api.post<Agent>('/v1/agents', params);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      toast.success("Agent created successfully");
    },
    onError: () => toast.error("Failed to create agent"),
  });
};

type UpdateAgentParams = {
  id: string;
  data: Partial<Omit<CreateAgentParams, "name" | "description">> & {
    name?: string;
    description?: string;
  };
};

export const useUpdateAgent = () => {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation<Agent, Error, UpdateAgentParams>({
    mutationFn: async ({ id, data }) => {
      const api = createAuthenticatedRequest(accessToken);
      return api.patch<Agent>(`/v1/agents/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      toast.success("Agent updated successfully");
    },
    onError: () => toast.error("Failed to update agent"),
  });
};

export const useDeleteAgent = () => {
  const { accessToken } = useMetaInfo();
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (agentId) => {
      const api = createAuthenticatedRequest(accessToken);
      return api.delete<void>(`/v1/agents/${agentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: agentKeys.all });
      toast.success("Agent deleted successfully");
    },
    onError: () => toast.error("Failed to delete agent"),
  });
};