import { getApiBaseUrl } from "./api-client";

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

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getAccessToken(
    act_as?: IssueTokenRequest["act_as"],
  ): Promise<string | null> {
    // If we have a token in memory, return it
    if (this.accessToken) {
      return this.accessToken;
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

      const response = await fetch(`${baseUrl}/v1/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Include cookies for refresh token
        body: JSON.stringify({ act_as }),
      });

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