import { OrganizationUser } from "@/features/settings/types/organization.types";
import { getApiBaseUrl } from "@/lib/api-client";

export async function listOrganizationUsers(
  accessToken: string,
  orgId: string,
): Promise<OrganizationUser[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/users`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-ACI-ORG-ID": orgId,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch organization users");
  }

  return response.json();
}

export async function inviteToOrganization(
  accessToken: string,
  orgId: string,
  email: string,
  role: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/invite-user`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-ACI-ORG-ID": orgId,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, role }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to invite user to organization");
  }
}

export async function removeUser(
  accessToken: string,
  orgId: string,
  userId: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/users/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "X-ACI-ORG-ID": orgId,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to remove user from organization");
  }
}
