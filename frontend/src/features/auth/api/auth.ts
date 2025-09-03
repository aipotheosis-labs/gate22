import { getApiBaseUrl } from "@/lib/api-client";
import { toast } from "sonner";
import { CONTROL_PLANE_PATH } from "@/config/api.constants";

// Request/Response types
export interface EmailLoginRequest {
  email: string;
  password: string;
}

export interface EmailRegistrationRequest {
  name: string;
  email: string;
  password: string;
}

export interface TokenResponse {
  token: string;
}

export interface UserInfo {
  user_id: string;
  name: string;
  email: string;
  organizations: Array<{
    organization_id: string;
    organization_name: string;
    role: string;
  }>;
}

export interface IssueTokenRequest {
  act_as?: {
    organization_id: string;
    role: string;
  };
}

// Auth functions
export async function register(
  data: EmailRegistrationRequest,
): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/auth/register/email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
      body: JSON.stringify(data),
    },
  );

  if (!response.ok) {
    try {
      const errorData = await response.json();
      // Handle different error response formats
      const errorMessage =
        errorData.detail || errorData.message || errorData.error;

      // Provide user-friendly messages for common errors
      if (typeof errorMessage === "string") {
        // Map backend error codes to user-friendly messages
        if (
          errorMessage === "email_already_exists" ||
          errorMessage === "user_already_exists"
        ) {
          toast.error(
            "This email is already registered. Please try logging in instead.",
          );
          return false;
        }
        // Fallback for old error messages (backwards compatibility)
        if (errorMessage.toLowerCase().includes("email already")) {
          toast.error(
            "This email is already registered. Please try logging in instead.",
          );
          return false;
        }
        toast.error(errorMessage);
        return false;
      }
      toast.error("Registration failed. Please try again.");
      return false;
    } catch {
      toast.error("Registration failed. Please try again.");
      return false;
    }
  }

  toast.success("Registration successful!");
  return true;
}

export async function login(email: string, password: string): Promise<boolean> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/auth/login/email`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies
      body: JSON.stringify({
        email,
        password,
      } as EmailLoginRequest),
    },
  );

  if (!response.ok) {
    try {
      const errorData = await response.json();
      // Handle different error response formats
      const errorMessage =
        errorData.detail || errorData.message || errorData.error;

      // Provide user-friendly messages for common errors
      if (typeof errorMessage === "string") {
        if (
          errorMessage.toLowerCase().includes("invalid") ||
          errorMessage.toLowerCase().includes("incorrect")
        ) {
          toast.error("Invalid email or password. Please try again.");
          return false;
        }
        if (
          errorMessage === "user_not_found" ||
          errorMessage.toLowerCase().includes("not found")
        ) {
          toast.error(
            "No account found with this email. Please sign up first.",
          );
          return false;
        }
        toast.error(errorMessage);
        return false;
      }
      toast.error("Login failed. Please try again.");
      return false;
    } catch {
      toast.error("Login failed. Please try again.");
      return false;
    }
  }

  toast.success("Login successful!");
  return true;
}

export async function issueToken(
  act_as?: IssueTokenRequest["act_as"],
): Promise<TokenResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}${CONTROL_PLANE_PATH}/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({ act_as }),
  });

  if (!response.ok) {
    try {
      const errorData = await response.json();
      const errorMessage =
        errorData.detail || errorData.message || errorData.error;

      if (typeof errorMessage === "string") {
        throw new Error(errorMessage);
      }
      throw new Error("Failed to issue token. Please try again.");
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Failed to issue token. Please try again.");
    }
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}${CONTROL_PLANE_PATH}/auth/logout`, {
    method: "POST",
    credentials: "include", // Include cookies
  });
}

export async function getProfile(token: string): Promise<UserInfo> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}${CONTROL_PLANE_PATH}/users/me/profile`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    try {
      const errorData = await response.json();
      const errorMessage =
        errorData.detail || errorData.message || errorData.error;

      if (typeof errorMessage === "string") {
        throw new Error(errorMessage);
      }
      throw new Error("Failed to fetch user profile. Please try again.");
    } catch (e) {
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("Failed to fetch user profile. Please try again.");
    }
  }

  return response.json();
}

// Google OAuth helper functions
export function getGoogleLoginUrl(): string {
  const baseUrl = getApiBaseUrl();
  const callbackUrl = `${window.location.origin}/callback?provider=google`;
  const redirectUri = encodeURIComponent(callbackUrl);
  return `${baseUrl}${CONTROL_PLANE_PATH}/auth/login/google/authorize?redirect_uri=${redirectUri}`;
}

export function getGoogleRegisterUrl(): string {
  const baseUrl = getApiBaseUrl();
  const callbackUrl = `${window.location.origin}/callback?provider=google`;
  const redirectUri = encodeURIComponent(callbackUrl);
  return `${baseUrl}${CONTROL_PLANE_PATH}/auth/register/google/authorize?redirect_uri=${redirectUri}`;
}
