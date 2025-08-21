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
} from "@/features/linked-accounts/api/linkedaccount";
import { useMetaInfo } from "@/components/context/metainfo";
import { getApiKey } from "@/lib/api-utils";
import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
import { toast } from "sonner";

export const linkedAccountKeys = {
  all: () => ["linkedaccounts"] as const,
};

export const useLinkedAccounts = () => {
  const { accessToken } = useMetaInfo();
  const apiKey = getApiKey(accessToken);

  return useQuery<LinkedAccount[], Error>({
    queryKey: linkedAccountKeys.all(),
    queryFn: () => getAllLinkedAccounts(apiKey),
  });
};

export const useAppLinkedAccounts = (appName?: string | null) => {
  const base = useLinkedAccounts();
  return {
    ...base,
    data: useMemo(
      () =>
        appName && base.data
          ? base.data.filter((a) => a.app_name === appName)
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
  const apiKey = getApiKey(accessToken);

  return useMutation<void, Error, DeleteLinkedAccountParams>({
    mutationFn: (params) => deleteLinkedAccount(params.linkedAccountId, apiKey),
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
