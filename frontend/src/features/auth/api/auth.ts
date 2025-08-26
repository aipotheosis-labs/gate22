import { getApiBaseUrl } from "@/lib/api-client";

// Request/Response types
export interface EmailLoginRequest {
  auth_flow: "email";
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
      auth_flow: "email",
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
  act_as?: IssueTokenRequest["act_as"]
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
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch user profile");
  }

  return response.json();
}

export async function getGoogleAuthUrl(operation: "register" | "login", redirect_uri?: string): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const params = redirect_uri ? `?redirect_uri=${encodeURIComponent(redirect_uri)}` : "";
  const response = await fetch(`${baseUrl}/v1/auth/${operation}/google/authorize${params}`, {
    redirect: "manual",
  });

  if (response.type === "opaqueredirect" || response.status === 302) {
    const location = response.headers.get("location");
    if (location) {
      return location;
    }
  }

  const text = await response.text();
  return text;
}