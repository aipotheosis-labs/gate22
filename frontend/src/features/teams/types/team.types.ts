export interface TeamMember {
  user_id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  joined_at: string;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  member_count: number;
  owner_id: string;
}

export interface CreateTeamRequest {
  name: string;
  description?: string;
}

export interface InviteTeamMemberRequest {
  email: string;
}
