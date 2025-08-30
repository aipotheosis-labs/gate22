"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getAllLinkedAccounts,
  createAPILinkedAccount,
  createNoAuthLinkedAccount,
  deleteLinkedAccount,
  updateLinkedAccount,
  getOauth2LinkURL,
  createOAuth2ConnectedAccount,
  CreateOAuth2ConnectedAccountRequest,
  OAuth2ConnectedAccountResponse,
} from "@/features/linked-accounts/api/linkedaccount";
import { useMetaInfo } from "@/components/context/metainfo";
import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
import { toast } from "sonner";

export const linkedAccountKeys = {
  all: () => ["linkedaccounts"] as const,
};

export const useLinkedAccounts = () => {
  const { accessToken } = useMetaInfo();

  return useQuery<LinkedAccount[], Error>({
    queryKey: linkedAccountKeys.all(),
    queryFn: () => getAllLinkedAccounts(accessToken!),
    enabled: !!accessToken,
  });
};

export const useAppLinkedAccounts = (appName?: string | null) => {
  const base = useLinkedAccounts();
  return {
    ...base,
    data: useMemo(
      () =>
        appName && base.data
          ? base.data.filter(
              (a) => a.mcp_server_configuration?.mcp_server?.name === appName,
            )
          : [],
      [base.data, appName],
    ),
  };
};

type CreateAPILinkedAccountParams = {
  appName: string;
  linkedAccountOwnerId: string;
  linkedAPIKey: string;
};

export const useCreateAPILinkedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<LinkedAccount, Error, CreateAPILinkedAccountParams>({
    mutationFn: (params) =>
      createAPILinkedAccount(
        params.appName,
        params.linkedAccountOwnerId,
        params.linkedAPIKey,
        apiKey,
      ),

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type CreateNoAuthLinkedAccountParams = {
  appName: string;
  linkedAccountOwnerId: string;
};

export const useCreateNoAuthLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<LinkedAccount, Error, CreateNoAuthLinkedAccountParams>({
    mutationFn: (params) =>
      createNoAuthLinkedAccount(
        params.appName,
        params.linkedAccountOwnerId,
        apiKey,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
type GetOauth2LinkURLParams = {
  appName: string;
  linkedAccountOwnerId: string;
  afterOAuth2LinkRedirectURL?: string;
};

export const useGetOauth2LinkURL = () => {
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<string, Error, GetOauth2LinkURLParams>({
    mutationFn: (params) =>
      getOauth2LinkURL(
        params.appName,
        params.linkedAccountOwnerId,
        apiKey,
        params.afterOAuth2LinkRedirectURL,
      ),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type DeleteLinkedAccountParams = {
  linkedAccountId: string;
};

export const useDeleteLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();

  return useMutation<void, Error, DeleteLinkedAccountParams>({
    mutationFn: (params) =>
      deleteLinkedAccount(params.linkedAccountId, accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(),
      }),
  });
};

type UpdateLinkedAccountParams = {
  linkedAccountId: string;
  enabled: boolean;
};

export const useUpdateLinkedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<LinkedAccount, Error, UpdateLinkedAccountParams>({
    mutationFn: (params) =>
      updateLinkedAccount(params.linkedAccountId, apiKey, params.enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(),
      }),
  });
};

type CreateOAuth2ConnectedAccountParams = {
  mcpServerConfigurationId: string;
  redirectUrl?: string;
};

export const useCreateOAuth2ConnectedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();

  return useMutation<
    OAuth2ConnectedAccountResponse,
    Error,
    CreateOAuth2ConnectedAccountParams
  >({
    mutationFn: (params) => {
      const request: CreateOAuth2ConnectedAccountRequest = {
        mcp_server_configuration_id: params.mcpServerConfigurationId,
        redirect_url_after_account_creation: params.redirectUrl,
      };
      return createOAuth2ConnectedAccount(request, accessToken!);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: linkedAccountKeys.all(),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
