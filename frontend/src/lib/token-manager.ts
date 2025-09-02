import { getApiBaseUrl } from "./api-client";
import { roleManager } from "./role-manager";
import { OrganizationRole } from "@/features/settings/types/organization.types";
import { CONTROL_PLANE_PATH } from "@/config/api.constants";

interface TokenResponse {
  token: string;
}

interface IssueTokenRequest {
  act_as?: {
    organization_id: string;
    role: string;
  };
}

class TokenManager {
  private static instance: TokenManager;
  private accessToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private currentActAs: IssueTokenRequest["act_as"] | undefined = undefined;

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getAccessToken(
    organizationId?: string,
    userActualRole?: OrganizationRole,
  ): Promise<string | null> {
    // Determine act_as based on RoleManager
    let act_as: IssueTokenRequest["act_as"] | undefined;

    if (organizationId && userActualRole === OrganizationRole.Admin) {
      const activeRole = roleManager.getActiveRole(organizationId);
      if (activeRole && activeRole.role === OrganizationRole.Member) {
        // Admin is acting as member
        act_as = {
          organization_id: organizationId,
          role: OrganizationRole.Member,
        };
      }
      // If activeRole is null or admin, don't pass act_as (use default)
    }

    // Check if we need to refresh due to role change
    const actAsChanged =
      JSON.stringify(act_as) !== JSON.stringify(this.currentActAs);

    // If we have a token and act_as hasn't changed, return it
    if (this.accessToken && !actAsChanged) {
      return this.accessToken;
    }

    // If act_as changed, clear the token to force refresh
    if (actAsChanged) {
      this.clearToken();
      this.currentActAs = act_as;
    }

    // If already refreshing, wait for the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Otherwise, refresh the token
    return this.refreshAccessToken(act_as);
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  clearToken(): void {
    this.accessToken = null;
    this.refreshPromise = null;
    this.currentActAs = undefined;
  }

  private async refreshAccessToken(
    act_as?: IssueTokenRequest["act_as"],
  ): Promise<string | null> {
    this.refreshPromise = this.doRefreshToken(act_as);

    try {
      const token = await this.refreshPromise;
      return token;
    } finally {
      this.refreshPromise = null;
    }
  }

  private async doRefreshToken(
    act_as?: IssueTokenRequest["act_as"],
  ): Promise<string | null> {
    const baseUrl = getApiBaseUrl();

    try {
      console.log("Refreshing access token");

      const response = await fetch(
        `${baseUrl}${CONTROL_PLANE_PATH}/auth/token`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include", // Include cookies for refresh token
          body: JSON.stringify({ act_as }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.log(`Token refresh failed (${response.status}): ${errorText}`);

        // Clear token on auth failure
        if (response.status === 401) {
          this.clearToken();
          return null;
        }

        throw new Error(`Failed to refresh token: ${response.status}`);
      }

      const data: TokenResponse = await response.json();
      console.log("Token refresh successful");
      this.setAccessToken(data.token);
      return data.token;
    } catch (error) {
      console.error("Token refresh error:", error);
      // For network errors, re-throw
      if (error instanceof Error && !error.message.includes("401")) {
        throw error;
      }
      // For auth errors, return null
      this.clearToken();
      return null;
    }
  }
}

export const tokenManager = TokenManager.getInstance();
