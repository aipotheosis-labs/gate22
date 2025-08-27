export const SETTINGS_ROUTES = {
  ORGANIZATION: '/settings/organization',
  TEAMS: '/settings/teams',
  NEW_TEAM: '/settings/teams/new',
  TEAM_DETAIL: (teamId: string) => `/settings/teams/${teamId}`,
  MEMBERS: '/settings/members',
} as const;

export const QUERY_KEYS = {
  TEAMS: (orgId: string) => ['teams', orgId] as const,
  TEAM: (orgId: string, teamId: string) => ['team', orgId, teamId] as const,
  TEAM_MEMBERS: (orgId: string, teamId: string) => ['team-members', orgId, teamId] as const,
  ORGANIZATION: (orgId: string) => ['organization', orgId] as const,
  MEMBERS: (orgId: string) => ['members', orgId] as const,
} as const;

export const UI_TEXT = {
  TEAM: {
    CREATE_SUCCESS: (name: string) => `Team "${name}" created successfully`,
    CREATE_ERROR: 'Failed to create team',
    REMOVE_MEMBER_SUCCESS: 'Member removed successfully',
    REMOVE_MEMBER_ERROR: 'Failed to remove member',
    NO_NAME_ERROR: 'Please enter a team name',
    NO_ORG_ERROR: 'No organization selected',
  },
  ORGANIZATION: {
    UPDATE_SUCCESS: 'Organization settings updated successfully',
    UPDATE_ERROR: 'Failed to update organization settings',
  },
} as const;