import { LinkedAccount } from "@/features/linked-accounts/types/linkedaccount.types";
import { getApiBaseUrl } from "@/lib/api-client";

export async function getAllLinkedAccounts(
  accessToken: string,
): Promise<LinkedAccount[]> {
  const baseUrl = getApiBaseUrl();
  // Fetch with a large limit to get all accounts
  const response = await fetch(`${baseUrl}/v1/connected-accounts?limit=100`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch all linked accounts: ${response.status} ${response.statusText}`,
    );
  }

  const paginatedResponse = await response.json();
  // The backend returns a paginated response with data array
  return paginatedResponse.data || [];
}

export interface CreateOAuth2ConnectedAccountRequest {
  mcp_server_configuration_id: string;
  redirect_url_after_account_creation?: string;
}

export interface OAuth2ConnectedAccountResponse {
  authorization_url: string;
}

export async function createOAuth2ConnectedAccount(
  request: CreateOAuth2ConnectedAccountRequest,
  accessToken: string,
): Promise<OAuth2ConnectedAccountResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/connected-accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    let errorMsg = `Failed to create connected account: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.detail) {
        errorMsg = errorData.detail;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }
    throw new Error(errorMsg);
  }

  const result = await response.json();
  return result;
}

export async function getAppLinkedAccounts(
  appName: string,
): Promise<LinkedAccount[]> {
  const params = new URLSearchParams();
  params.append("app_name", appName);

  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/connected-accounts?${params.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch linked accounts: ${response.status} ${response.statusText}`,
    );
  }

  const linkedAccounts = await response.json();
  return linkedAccounts;
}

export async function createAPILinkedAccount(
  appName: string,
  linkedAccountOwnerId: string,
  linkedAPIKey: string,
): Promise<LinkedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/linked-accounts/api-key`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_name: appName,
      linked_account_owner_id: linkedAccountOwnerId,
      api_key: linkedAPIKey,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Failed to create linked account: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }
    throw new Error(errorMsg);
  }

  const linkedAccount = await response.json();
  return linkedAccount;
}

export async function createNoAuthLinkedAccount(
  appName: string,
  linkedAccountOwnerId: string,
): Promise<LinkedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/linked-accounts/no-auth`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      app_name: appName,
      linked_account_owner_id: linkedAccountOwnerId,
    }),
  });

  if (!response.ok) {
    let errorMsg = `Failed to create no auth linked account: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }
    throw new Error(errorMsg);
  }

  const linkedAccount = await response.json();
  return linkedAccount;
}

export async function getOauth2LinkURL(
  appName: string,
  linkedAccountOwnerId: string,
  afterOAuth2LinkRedirectURL?: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.append("app_name", appName);
  params.append("linked_account_owner_id", linkedAccountOwnerId);
  if (afterOAuth2LinkRedirectURL) {
    params.append("after_oauth2_link_redirect_url", afterOAuth2LinkRedirectURL);
  }

  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/linked-accounts/oauth2?${params.toString()}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    let errorMsg = `Failed to get OAuth2 link URL: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData && errorData.error) {
        errorMsg = errorData.error;
      }
    } catch (e) {
      console.error("Error parsing error response:", e);
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();
  if (!data.url || typeof data.url !== "string") {
    throw new Error("Invalid response: missing or invalid URL");
  }
  return data.url;
}

export async function deleteLinkedAccount(
  linkedAccountId: string,
  accessToken: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/connected-accounts/${linkedAccountId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete linked account: ${response.status} ${response.statusText}`,
    );
  }
}

export async function updateLinkedAccount(
  linkedAccountId: string,
  enabled: boolean,
): Promise<LinkedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/linked-accounts/${linkedAccountId}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        enabled,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to update linked account: ${response.status} ${response.statusText}`,
    );
  }

  const updatedLinkedAccount = await response.json();
  return updatedLinkedAccount;
}
