import { Team, TeamMember, CreateTeamRequest } from "../types/team.types";
import { getApiBaseUrl } from "@/lib/api-client";

export async function listTeams(
  accessToken: string,
  orgId: string,
): Promise<Team[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/organizations/${orgId}/teams`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch teams");
  }

  return response.json();
}

export async function getTeam(
  accessToken: string,
  orgId: string,
  teamId: string,
): Promise<Team> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/${orgId}/teams/${teamId}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch team");
  }

  return response.json();
}

export async function createTeam(
  accessToken: string,
  orgId: string,
  data: CreateTeamRequest,
): Promise<Team> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/organizations/${orgId}/teams`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error("Failed to create team");
  }

  return response.json();
}

export async function deleteTeam(
  accessToken: string,
  orgId: string,
  teamId: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/${orgId}/teams/${teamId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to delete team");
  }
}

export async function listTeamMembers(
  accessToken: string,
  orgId: string,
  teamId: string,
): Promise<TeamMember[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/${orgId}/teams/${teamId}/members`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to fetch team members");
  }

  return response.json();
}

export async function addTeamMember(
  accessToken: string,
  orgId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/${orgId}/teams/${teamId}/members/${userId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to add team member");
  }
}

export async function removeTeamMember(
  accessToken: string,
  orgId: string,
  teamId: string,
  userId: string,
): Promise<void> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(
    `${baseUrl}/v1/organizations/${orgId}/teams/${teamId}/members/${userId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );

  if (!response.ok) {
    throw new Error("Failed to remove team member");
  }
}
