import { factory, primaryKey, nullable } from "@mswjs/data";

// Helper to generate simple IDs
let idCounter = 1;
const generateId = () => `${idCounter++}-${Date.now()}`;

// Create the mock database
export const db = factory({
  user: {
    id: primaryKey(generateId),
    email: () => "user@example.com",
    name: () => "Test User",
    role: () => "admin",
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  organization: {
    id: primaryKey(generateId),
    name: () => "Test Organization",
    description: nullable(() => "A test organization for development"),
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  team: {
    id: primaryKey(generateId),
    name: () => "Development Team",
    description: nullable(() => "Main development team"),
    organization_id: () => "org-1",
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  agent: {
    id: primaryKey(generateId),
    name: () => "Test Agent",
    description: () => "An AI agent for testing",
    allowed_apps: () => [],
    custom_instructions: () => ({}),
    status: () => "active",
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  app: {
    id: primaryKey(generateId),
    name: () => "Test Application",
    description: () => "A test application for development",
    type: () => "web",
    url: nullable(() => "https://example.com"),
    status: () => "active",
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  appConfig: {
    id: primaryKey(generateId),
    app_id: () => "app-1",
    name: () => "Test Config",
    config: () => ({}),
    environment: () => "development",
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  linkedAccount: {
    id: primaryKey(generateId),
    provider: () => "github",
    account_id: () => generateId(),
    account_name: () => "testuser",
    email: () => "test@example.com",
    status: () => "active",
    metadata: () => ({}),
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },

  appFunction: {
    id: primaryKey(generateId),
    app_id: () => "app-1",
    name: () => "testFunction",
    description: () => "A test function",
    parameters: () => [],
    response_schema: () => ({}),
    created_at: () => new Date().toISOString(),
    updated_at: () => new Date().toISOString(),
  },
});

// Mock data samples
const mockOrganizations = [
  { id: "org-1", name: "Acme Corp", description: "Main organization" },
  { id: "org-2", name: "Tech Startup", description: "Innovative tech company" },
  {
    id: "org-3",
    name: "Global Enterprises",
    description: "Worldwide operations",
  },
];

const mockTeams = [
  {
    id: "team-1",
    name: "Frontend Team",
    description: "UI/UX development",
    organization_id: "org-1",
  },
  {
    id: "team-2",
    name: "Backend Team",
    description: "API development",
    organization_id: "org-1",
  },
  {
    id: "team-3",
    name: "DevOps Team",
    description: "Infrastructure",
    organization_id: "org-2",
  },
  {
    id: "team-4",
    name: "QA Team",
    description: "Quality assurance",
    organization_id: "org-2",
  },
];

const mockAgents = [
  {
    id: "agent-1",
    name: "Code Assistant",
    description: "Helps with coding tasks",
    allowed_apps: ["app-1", "app-2"],
    status: "active",
  },
  {
    id: "agent-2",
    name: "Data Analyst",
    description: "Analyzes data and generates reports",
    allowed_apps: ["app-3"],
    status: "active",
  },
  {
    id: "agent-3",
    name: "Customer Support",
    description: "Handles customer inquiries",
    allowed_apps: ["app-4"],
    status: "active",
  },
  {
    id: "agent-4",
    name: "Content Creator",
    description: "Generates content and documentation",
    allowed_apps: ["app-1", "app-3"],
    status: "active",
  },
  {
    id: "agent-5",
    name: "Testing Bot",
    description: "Automated testing assistant",
    allowed_apps: ["app-2"],
    status: "inactive",
  },
];

const mockApps = [
  {
    id: "app-1",
    name: "Dashboard App",
    description: "Main dashboard application",
    type: "web",
    url: "https://dashboard.example.com",
    status: "active",
  },
  {
    id: "app-2",
    name: "Mobile App",
    description: "Mobile application for iOS and Android",
    type: "mobile",
    status: "active",
  },
  {
    id: "app-3",
    name: "Analytics API",
    description: "Analytics and reporting API",
    type: "api",
    url: "https://api.example.com",
    status: "active",
  },
  {
    id: "app-4",
    name: "Admin Portal",
    description: "Administrative portal",
    type: "web",
    url: "https://admin.example.com",
    status: "active",
  },
];

const mockAppConfigs = [
  {
    id: "config-1",
    app_id: "app-1",
    name: "Production Config",
    config: { apiUrl: "https://api.prod.example.com", timeout: 30000 },
    environment: "production",
  },
  {
    id: "config-2",
    app_id: "app-1",
    name: "Staging Config",
    config: { apiUrl: "https://api.staging.example.com", timeout: 60000 },
    environment: "staging",
  },
  {
    id: "config-3",
    app_id: "app-2",
    name: "Mobile Dev Config",
    config: { debugMode: true, logLevel: "verbose" },
    environment: "development",
  },
  {
    id: "config-4",
    app_id: "app-3",
    name: "API Config",
    config: { rateLimit: 1000, cacheEnabled: true },
    environment: "production",
  },
];

const mockLinkedAccounts = [
  {
    id: "account-1",
    provider: "github",
    account_name: "john_doe",
    email: "john@example.com",
    status: "active",
    metadata: { repos: 42, followers: 100 },
  },
  {
    id: "account-2",
    provider: "google",
    account_name: "jane.smith",
    email: "jane@example.com",
    status: "active",
    metadata: { drive_usage: "15GB" },
  },
  {
    id: "account-3",
    provider: "microsoft",
    account_name: "bob_wilson",
    email: "bob@example.com",
    status: "active",
    metadata: { teams_connected: 3 },
  },
  {
    id: "account-4",
    provider: "slack",
    account_name: "alice_team",
    email: "alice@example.com",
    status: "active",
    metadata: { workspaces: 2 },
  },
  {
    id: "account-5",
    provider: "github",
    account_name: "dev_team",
    email: "team@example.com",
    status: "inactive",
    metadata: { repos: 10 },
  },
  {
    id: "account-6",
    provider: "google",
    account_name: "admin_user",
    email: "admin@example.com",
    status: "active",
    metadata: { admin: true },
  },
];

const mockAppFunctions = [
  {
    id: "func-1",
    app_id: "app-1",
    name: "getUserData",
    description: "Fetches user data",
    parameters: [{ name: "userId", type: "string", required: true }],
  },
  {
    id: "func-2",
    app_id: "app-1",
    name: "updateProfile",
    description: "Updates user profile",
    parameters: [
      { name: "userId", type: "string", required: true },
      { name: "data", type: "object", required: true },
    ],
  },
  {
    id: "func-3",
    app_id: "app-2",
    name: "sendNotification",
    description: "Sends push notification",
    parameters: [
      { name: "deviceId", type: "string", required: true },
      { name: "message", type: "string", required: true },
    ],
  },
  {
    id: "func-4",
    app_id: "app-3",
    name: "generateReport",
    description: "Generates analytics report",
    parameters: [
      { name: "startDate", type: "date", required: true },
      { name: "endDate", type: "date", required: true },
    ],
  },
];

// Seed initial data
export function seedDatabase() {
  // Reset counter
  idCounter = 1;

  // Create organizations
  mockOrganizations.forEach((org) => {
    db.organization.create(org);
  });

  // Create teams
  mockTeams.forEach((team) => {
    db.team.create(team);
  });

  // Create agents
  mockAgents.forEach((agent) => {
    db.agent.create({
      ...agent,
      custom_instructions: {
        instruction1: "Be helpful and concise",
        instruction2: "Follow best practices",
      },
    });
  });

  // Create apps
  mockApps.forEach((app) => {
    db.app.create(app);
  });

  // Create app configs
  mockAppConfigs.forEach((config) => {
    db.appConfig.create(config);
  });

  // Create app functions
  mockAppFunctions.forEach((func) => {
    db.appFunction.create({
      ...func,
      response_schema: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          data: { type: "object" },
        },
      },
    });
  });

  // Create linked accounts
  mockLinkedAccounts.forEach((account) => {
    db.linkedAccount.create(account);
  });

  // Create sample users
  const sampleUsers = [
    {
      id: "user-1",
      email: "admin@example.com",
      name: "Admin User",
      role: "admin",
    },
    {
      id: "user-2",
      email: "john.doe@example.com",
      name: "John Doe",
      role: "owner",
    },
    {
      id: "user-3",
      email: "jane.smith@example.com",
      name: "Jane Smith",
      role: "member",
    },
    {
      id: "user-4",
      email: "bob.wilson@example.com",
      name: "Bob Wilson",
      role: "member",
    },
    {
      id: "user-5",
      email: "alice.johnson@example.com",
      name: "Alice Johnson",
      role: "viewer",
    },
    {
      id: "user-6",
      email: "david.brown@example.com",
      name: "David Brown",
      role: "member",
    },
    {
      id: "user-7",
      email: "sarah.davis@example.com",
      name: "Sarah Davis",
      role: "admin",
    },
    {
      id: "user-8",
      email: "michael.jones@example.com",
      name: "Michael Jones",
      role: "member",
    },
  ];

  sampleUsers.forEach((user) => {
    db.user.create(user);
  });
}

// Reset database
export function resetDatabase() {
  db.user.deleteMany({ where: {} });
  db.organization.deleteMany({ where: {} });
  db.team.deleteMany({ where: {} });
  db.agent.deleteMany({ where: {} });
  db.app.deleteMany({ where: {} });
  db.appConfig.deleteMany({ where: {} });
  db.linkedAccount.deleteMany({ where: {} });
  db.appFunction.deleteMany({ where: {} });
  seedDatabase();
}
