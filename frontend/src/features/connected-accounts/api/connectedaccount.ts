import { ConnectedAccount } from "@/features/connected-accounts/types/connectedaccount.types";
import { getApiBaseUrl } from "@/lib/api-client";
import { CONTROL_PLANE_PATH } from "@/config/api.constants";

export async function getAllConnectedAccounts(
  accessToken: string,
): Promise<ConnectedAccount[]> {
  const baseUrl = getApiBaseUrl();
  // Fetch with a large limit to get all accounts
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/connected-accounts?limit=100`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch all connected accounts: ${response.status} ${response.statusText}`,
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
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/connected-accounts`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(request),
    },
  );

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

export async function getAppConnectedAccounts(
  appName: string,
): Promise<ConnectedAccount[]> {
  const params = new URLSearchParams();
  params.append("app_name", appName);

  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/connected-accounts?${params.toString()}`,
    {
      method: "GET",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch connected accounts: ${response.status} ${response.statusText}`,
    );
  }

  const connectedAccounts = await response.json();
  return connectedAccounts;
}

export async function createAPIConnectedAccount(
  appName: string,
  connectedAccountOwnerId: string,
  connectedAPIKey: string,
): Promise<ConnectedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/linked-accounts/api-key`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_name: appName,
        linked_account_owner_id: connectedAccountOwnerId,
        api_key: connectedAPIKey,
      }),
    },
  );

  if (!response.ok) {
    let errorMsg = `Failed to create connected account: ${response.status} ${response.statusText}`;
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

  const connectedAccount = await response.json();
  return connectedAccount;
}

export async function createNoAuthConnectedAccount(
  appName: string,
  connectedAccountOwnerId: string,
): Promise<ConnectedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/linked-accounts/no-auth`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        app_name: appName,
        linked_account_owner_id: connectedAccountOwnerId,
      }),
    },
  );

  if (!response.ok) {
    let errorMsg = `Failed to create no auth connected account: ${response.status} ${response.statusText}`;
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

  const connectedAccount = await response.json();
  return connectedAccount;
}

export async function getOauth2LinkURL(
  appName: string,
  connectedAccountOwnerId: string,
  afterOAuth2LinkRedirectURL?: string,
): Promise<string> {
  const params = new URLSearchParams();
  params.append("app_name", appName);
  params.append("linked_account_owner_id", connectedAccountOwnerId);
  if (afterOAuth2LinkRedirectURL) {
    params.append("after_oauth2_link_redirect_url", afterOAuth2LinkRedirectURL);
  }

  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/linked-accounts/oauth2?${params.toString()}`,
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

export async function deleteConnectedAccount(
  connectedAccountId: string,
  accessToken: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/connected-accounts/${connectedAccountId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to delete connected account: ${response.status} ${response.statusText}`,
    );
  }
}

export async function updateConnectedAccount(
  connectedAccountId: string,
  enabled: boolean,
): Promise<ConnectedAccount> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/linked-accounts/${connectedAccountId}`,
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
      `Failed to update connected account: ${response.status} ${response.statusText}`,
    );
  }

  const updatedConnectedAccount = await response.json();
  return updatedConnectedAccount;
}
