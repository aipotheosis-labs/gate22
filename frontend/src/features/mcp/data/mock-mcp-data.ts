import {
  AuthType,
  MCPServerPublic,
  MCPToolPublic,
  MCPServerConfigurationPublic,
  MCPServerConfigurationPublicBasic,
} from "../types/mcp.types";

export const mockMCPTools: Record<string, MCPToolPublic[]> = {
  github: [
    {
      id: "tool-1",
      name: "repos",
      description: "Manage repositories, branches, and commits",
      mcp_server_id: "server-github",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-2",
      name: "pull_requests",
      description: "Create, review, and merge pull requests",
      mcp_server_id: "server-github",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-3",
      name: "issues",
      description: "Track and manage project issues",
      mcp_server_id: "server-github",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-4",
      name: "actions",
      description: "Monitor and control GitHub Actions workflows",
      mcp_server_id: "server-github",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ],
  notion: [
    {
      id: "tool-5",
      name: "search",
      description: "Search across all workspace content",
      mcp_server_id: "server-notion",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-6",
      name: "fetch",
      description: "Retrieve page and database content",
      mcp_server_id: "server-notion",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-7",
      name: "create-pages",
      description: "Create new pages with rich content",
      mcp_server_id: "server-notion",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-8",
      name: "update-page",
      description: "Modify existing page properties and blocks",
      mcp_server_id: "server-notion",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ],
  sentry: [
    {
      id: "tool-9",
      name: "Organizations",
      description: "Manage Sentry organizations",
      mcp_server_id: "server-sentry",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-10",
      name: "Projects",
      description: "Manage Sentry projects",
      mcp_server_id: "server-sentry",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "tool-11",
      name: "Issues",
      description: "Track and manage error issues",
      mcp_server_id: "server-sentry",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ],
};

export const mockMCPServers: MCPServerPublic[] = [
  {
    id: "server-github",
    name: "GITHUB",
    url: "https://api.github.com/mcp",
    description:
      "Official hosted MCP for GitHub; supports OAuth or PAT; capabilities organized into 15 toolsets",
    logo: "https://cdn.simpleicons.org/github",
    categories: ["Development", "Version Control"],
    supported_auth_types: [AuthType.OAUTH, AuthType.API_KEY],
    tools: mockMCPTools.github,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "server-notion",
    name: "NOTION",
    url: "https://api.notion.com/mcp",
    description:
      "Notion-hosted remote MCP with OAuth; lets AI search, read, create & update workspace content",
    logo: "https://cdn.simpleicons.org/notion",
    categories: ["Productivity", "Documentation"],
    supported_auth_types: [AuthType.OAUTH],
    tools: mockMCPTools.notion,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "server-sentry",
    name: "SENTRY",
    url: "https://sentry.io/api/mcp",
    description:
      "Sentry-hosted remote MCP (OAuth), with issue context, search, & Seer integration",
    logo: "https://cdn.simpleicons.org/sentry",
    categories: ["Monitoring", "Error Tracking"],
    supported_auth_types: [AuthType.OAUTH],
    tools: mockMCPTools.sentry,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "server-linear",
    name: "LINEAR",
    url: "https://api.linear.app/mcp",
    description:
      "Linear-hosted remote MCP (OAuth 2.1) via SSE/HTTP; find/create/update issues, projects, comments",
    logo: "https://cdn.simpleicons.org/linear",
    categories: ["Project Management", "Issue Tracking"],
    supported_auth_types: [AuthType.OAUTH],
    tools: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "server-intercom",
    name: "INTERCOM",
    url: "https://api.intercom.io/mcp",
    description:
      "Intercom-hosted remote MCP (HTTP & legacy SSE); OAuth or bearer token; US workspaces currently",
    logo: "https://cdn.simpleicons.org/intercom",
    categories: ["Customer Support", "Communication"],
    supported_auth_types: [AuthType.OAUTH, AuthType.API_KEY],
    tools: [],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

export const mockMCPServerConfigurations: MCPServerConfigurationPublic[] = [
  {
    id: "config-1",
    mcp_server_id: "server-github",
    organization_id: "org-1",
    auth_type: AuthType.OAUTH,
    all_tools_enabled: true,
    enabled_tools: [],
    allowed_teams: [
      {
        team_id: "team-1",
        name: "Engineering",
        description: "Engineering team",
        created_at: "2025-01-01T00:00:00Z",
      },
      {
        team_id: "team-2",
        name: "DevOps",
        description: "DevOps team",
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    mcp_server: {
      id: "server-github",
      name: "GITHUB",
      url: "https://api.github.com/mcp",
      description:
        "Official hosted MCP for GitHub; supports OAuth or PAT; capabilities organized into 15 toolsets",
      logo: "https://cdn.simpleicons.org/github",
      categories: ["Development", "Version Control"],
    },
  },
  {
    id: "config-2",
    mcp_server_id: "server-notion",
    organization_id: "org-1",
    auth_type: AuthType.OAUTH,
    all_tools_enabled: false,
    enabled_tools: [mockMCPTools.notion[0], mockMCPTools.notion[1]],
    allowed_teams: [
      {
        team_id: "team-3",
        name: "Product",
        description: "Product team",
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    mcp_server: {
      id: "server-notion",
      name: "NOTION",
      url: "https://api.notion.com/mcp",
      description:
        "Notion-hosted remote MCP with OAuth; lets AI search, read, create & update workspace content",
      logo: "https://cdn.simpleicons.org/notion",
      categories: ["Productivity", "Documentation"],
    },
  },
];

export const mockMCPServerConfigurationsBasic: MCPServerConfigurationPublicBasic[] =
  mockMCPServerConfigurations.map((config) => ({
    id: config.id,
    mcp_server_id: config.mcp_server_id,
    mcp_server: config.mcp_server,
  }));
