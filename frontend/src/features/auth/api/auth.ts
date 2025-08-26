import { getApiBaseUrl } from "@/lib/api-client";

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
export async function register(data: EmailRegistrationRequest): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/auth/register/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Registration failed");
  }
}

export async function login(email: string, password: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/auth/login/email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({
      email,
      password,
    } as EmailLoginRequest),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Login failed");
  }
}

export async function issueToken(
  act_as?: IssueTokenRequest["act_as"],
): Promise<TokenResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/auth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Include cookies
    body: JSON.stringify({ act_as }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to issue token");
  }

  return response.json();
}

export async function logout(): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/v1/auth/logout`, {
    method: "POST",
    credentials: "include", // Include cookies
  });
}

export async function getProfile(token: string): Promise<UserInfo> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/users/me/profile`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch user profile");
  }

  return response.json();
}

// Google OAuth helper functions
export function getGoogleLoginUrl(): string {
  const baseUrl = getApiBaseUrl();
  const callbackUrl = `${window.location.origin}/callback?provider=google`;
  const redirectUri = encodeURIComponent(callbackUrl);
  return `${baseUrl}/v1/auth/login/google/authorize?redirect_uri=${redirectUri}`;
}

export function getGoogleRegisterUrl(): string {
  const baseUrl = getApiBaseUrl();
  const callbackUrl = `${window.location.origin}/callback?provider=google`;
  const redirectUri = encodeURIComponent(callbackUrl);
  return `${baseUrl}/v1/auth/register/google/authorize?redirect_uri=${redirectUri}`;
}
