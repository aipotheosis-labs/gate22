"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  getAllConnectedAccounts,
  createAPIConnectedAccount,
  createNoAuthConnectedAccount,
  deleteConnectedAccount,
  updateConnectedAccount,
  getOauth2LinkURL,
  createOAuth2ConnectedAccount,
  CreateOAuth2ConnectedAccountRequest,
  OAuth2ConnectedAccountResponse,
} from "@/features/connected-accounts/api/connectedaccount";
import { useMetaInfo } from "@/components/context/metainfo";
import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";
import { toast } from "sonner";

export const connectedAccountKeys = {
  all: () => ["connectedaccounts"] as const,
};

export const useConnectedAccounts = () => {
  const { accessToken } = useMetaInfo();

  return useQuery<ConnectedAccount[], Error>({
    queryKey: connectedAccountKeys.all(),
    queryFn: () => getAllConnectedAccounts(accessToken!),
    enabled: !!accessToken,
  });
};

export const useAppConnectedAccounts = (appName?: string | null) => {
  const base = useConnectedAccounts();
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

type CreateAPIConnectedAccountParams = {
  appName: string;
  connectedAccountOwnerId: string;
  connectedAPIKey: string;
};

export const useCreateAPIConnectedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<ConnectedAccount, Error, CreateAPIConnectedAccountParams>({
    mutationFn: (params) =>
      createAPIConnectedAccount(
        params.appName,
        params.connectedAccountOwnerId,
        params.connectedAPIKey,
        apiKey,
      ),

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectedAccountKeys.all(),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type CreateNoAuthConnectedAccountParams = {
  appName: string;
  connectedAccountOwnerId: string;
};

export const useCreateNoAuthConnectedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<ConnectedAccount, Error, CreateNoAuthConnectedAccountParams>({
    mutationFn: (params) =>
      createNoAuthConnectedAccount(
        params.appName,
        params.connectedAccountOwnerId,
        apiKey,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectedAccountKeys.all(),
      }),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
type GetOauth2LinkURLParams = {
  appName: string;
  connectedAccountOwnerId: string;
  afterOAuth2LinkRedirectURL?: string;
};

export const useGetOauth2LinkURL = () => {
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<string, Error, GetOauth2LinkURLParams>({
    mutationFn: (params) =>
      getOauth2LinkURL(
        params.appName,
        params.connectedAccountOwnerId,
        apiKey,
        params.afterOAuth2LinkRedirectURL,
      ),
    onError: (error) => {
      toast.error(error.message);
    },
  });
};

type DeleteConnectedAccountParams = {
  connectedAccountId: string;
};

export const useDeleteConnectedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();

  return useMutation<void, Error, DeleteConnectedAccountParams>({
    mutationFn: (params) =>
      deleteConnectedAccount(params.connectedAccountId, accessToken!),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectedAccountKeys.all(),
      }),
  });
};

type UpdateConnectedAccountParams = {
  connectedAccountId: string;
  enabled: boolean;
};

export const useUpdateConnectedAccount = () => {
  const queryClient = useQueryClient();
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useMutation<ConnectedAccount, Error, UpdateConnectedAccountParams>({
    mutationFn: (params) =>
      updateConnectedAccount(params.connectedAccountId, apiKey, params.enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: connectedAccountKeys.all(),
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
        queryKey: connectedAccountKeys.all(),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
