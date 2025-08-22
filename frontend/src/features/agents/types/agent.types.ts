export interface Agent {
  id: string;
  name: string;
  description: string;
  allowed_apps: string[];
  custom_instructions: Record<string, string>;
  created_at: string;
  updated_at: string;
  api_keys: APIKey[];
}

export interface APIKey {
  id: string;
  key: string;
  agent_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}
