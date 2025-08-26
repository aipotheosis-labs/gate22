export function getApiKey(accessToken: string): string {
  // In the simplified version without projects, we directly use the access token
  // as the API key for all requests
  if (!accessToken) {
    throw new Error("No API key available");
  }
  return accessToken;
}
