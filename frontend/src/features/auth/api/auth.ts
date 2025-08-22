import { UserClass, OrgMemberInfoClass } from "@/components/context/metainfo";
import { getApiBaseUrl } from "@/lib/api-client";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: UserClass;
  org: OrgMemberInfoClass;
}

export async function login({
  email,
  password,
}: LoginRequest): Promise<LoginResponse> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Login failed");
  }

  return response.json();
}

export async function getCurrentUser(
  accessToken: string,
): Promise<{ user: UserClass; org: OrgMemberInfoClass }> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to fetch user info");
  }

  return response.json();
}

export async function logout(accessToken: string): Promise<void> {
  const baseUrl = getApiBaseUrl();
  await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}
