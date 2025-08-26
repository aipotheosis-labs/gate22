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
  private tokenExpiryTime: number | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;

    if (token) {
      // Parse JWT to get expiration time
      try {
        const payload = this.parseJwt(token);
        if (payload.exp) {
          // Set expiry time (convert from seconds to milliseconds)
          this.tokenExpiryTime = payload.exp * 1000;

          // Schedule refresh 1 minute before expiry
          this.scheduleTokenRefresh();
        }
      } catch (error) {
        console.error("Failed to parse JWT token:", error);
      }
    } else {
      this.clearRefreshTimer();
      this.tokenExpiryTime = null;
    }
  }

  private parseJwt(token: string): { exp?: number } {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload);
  }

  private scheduleTokenRefresh(): void {
    this.clearRefreshTimer();

    if (this.tokenExpiryTime) {
      const now = Date.now();
      // Refresh 1 minute before expiry
      const refreshTime = this.tokenExpiryTime - 60000;
      const delay = refreshTime - now;

      if (delay > 0) {
        this.refreshTimer = setTimeout(() => {
          this.refreshAccessToken();
        }, delay);
      }
    }
  }

  private clearRefreshTimer(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async refreshAccessToken(
    act_as?: IssueTokenRequest["act_as"],
  ): Promise<string | null> {
    // If already refreshing, wait for the existing promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

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

    // Retry logic for token refresh (useful after OAuth redirect)
    const maxRetries = 5; // Increased retries for cookie issues
    const retryDelay = 500; // Increased delay

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Token refresh attempt ${attempt}/${maxRetries}`);

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
          console.log(
            `Token refresh failed (${response.status}): ${errorText}`,
          );

          // If refresh token is invalid or missing (401), this is expected for non-authenticated users
          if (response.status === 401) {
            // Check if this might be a cookie timing issue (common after OAuth redirect)
            const isCookieTiming = errorText.includes("Missing refresh token");

            // On last attempt, clear token and return null
            if (attempt === maxRetries) {
              console.error("Final attempt failed, clearing token");
              this.clearToken();
              return null;
            }

            // For cookie timing issues, wait longer
            const delay = isCookieTiming ? retryDelay * 2 : retryDelay;
            console.log(`Waiting ${delay}ms before retry...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
            continue;
          }
          throw new Error(`Failed to refresh token: ${response.status}`);
        }

        const data: TokenResponse = await response.json();
        console.log("Token refresh successful");
        this.setAccessToken(data.token);
        return data.token;
      } catch (error) {
        console.error(`Token refresh error on attempt ${attempt}:`, error);

        // On last attempt, handle the error
        if (attempt === maxRetries) {
          // Clear token on refresh failure
          this.clearToken();
          // For network errors, re-throw
          if (error instanceof Error && !error.message.includes("401")) {
            throw error;
          }
          // For auth errors, return null
          return null;
        }
        // Otherwise, wait and retry with exponential backoff
        const delay = retryDelay * Math.min(attempt, 3);
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return null;
  }

  clearToken(): void {
    this.accessToken = null;
    this.tokenExpiryTime = null;
    this.clearRefreshTimer();
    this.refreshPromise = null;
  }

  isTokenExpired(): boolean {
    if (!this.tokenExpiryTime) {
      return true;
    }

    // Check if token expires in the next 30 seconds
    return Date.now() >= this.tokenExpiryTime - 30000;
  }

  async ensureValidToken(
    act_as?: IssueTokenRequest["act_as"],
  ): Promise<string | null> {
    if (!this.accessToken || this.isTokenExpired()) {
      return this.refreshAccessToken(act_as);
    }
    return this.accessToken;
  }
}

export const tokenManager = TokenManager.getInstance();
