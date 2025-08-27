export interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Team {
  team_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

