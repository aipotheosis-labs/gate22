import { App } from "@/features/apps/types/app.types";
import { getApiBaseUrl } from "@/lib/api-client";

export async function getAllApps(apiKey: string): Promise<App[]> {
  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/apps`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch app: ${response.status} ${response.statusText}`,
    );
  }

  const apps = await response.json();
  return apps;
}

export async function getApps(
  appNames: string[],
  apiKey: string,
): Promise<App[]> {
  const params = new URLSearchParams();
  appNames.forEach((name) => {
    params.append("app_names", name);
  });

  const baseUrl = getApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/apps?${params.toString()}`, {
    method: "GET",
    headers: {
      "X-API-KEY": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch app`);
  }

  const apps = await response.json();
  return apps;
}

export async function getApp(
  appName: string,
  apiKey: string,
): Promise<App | null> {
  const apps = await getApps([appName], apiKey);
  return apps.length > 0 ? apps[0] : null;
}
