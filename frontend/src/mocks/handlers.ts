import { http, HttpResponse, delay } from "msw";
import { db } from "./db";

// Define proper types for request bodies
interface LoginRequest {
  email: string;
  password: string;
}

interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

interface InviteUserRequest {
  email: string;
  role: string;
}

interface AgentRequest {
  name: string;
  description: string;
  allowed_apps?: string[];
  custom_instructions?: Record<string, string>;
  status?: string;
}

interface AppRequest {
  name: string;
  description: string;
  type?: string;
  url?: string;
  status?: string;
}

interface AppConfigRequest {
  app_id: string;
  name: string;
  config: Record<string, unknown>;
  environment: string;
}

interface LinkedAccountRequest {
  provider: string;
  account_name: string;
  email: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface TeamRequest {
  name: string;
  description?: string;
  organization_id?: string;
}

interface OrganizationRequest {
  name: string;
  description?: string;
}

interface AppFunctionRequest {
  app_id: string;
  name: string;
  description: string;
  parameters?: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  response_schema?: Record<string, unknown>;
}

// Add realistic delay to simulate network latency
const MOCK_DELAY = 200;

export const handlers = [
  // Auth endpoints
  http.post("*/api/auth/login", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as LoginRequest;

    // Mock validation - accept any email/password for demo
    // In production, this would validate against a real database

    return HttpResponse.json({
      token: "mock-jwt-token-" + Date.now(),
      user: {
        userId: "user-" + Math.random().toString(36).substr(2, 9),
        email: body.email,
        firstName: body.email.split("@")[0],
        lastName: "User",
        username: body.email.split("@")[0],
        pictureUrl: `https://ui-avatars.com/api/?name=${body.email.split("@")[0]}&background=random`,
      },
      org: {
        orgId: "org-demo-001",
        orgName: "Demo Organization",
        userRole: "admin",
        userPermissions: ["read", "write", "admin", "delete"],
      },
    });
  }),

  http.get("*/api/auth/me", async ({ request }) => {
    await delay(MOCK_DELAY);

    // Check authorization header
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new HttpResponse(null, { status: 401 });
    }

    // For demo, return mock user data
    return HttpResponse.json({
      user: {
        userId: "user-demo-001",
        email: "demo@example.com",
        firstName: "Demo",
        lastName: "User",
        username: "demo",
        pictureUrl:
          "https://ui-avatars.com/api/?name=Demo+User&background=random",
      },
      org: {
        orgId: "org-demo-001",
        orgName: "Demo Organization",
        userRole: "admin",
        userPermissions: ["read", "write", "admin", "delete"],
      },
    });
  }),

  http.post("*/api/auth/signup", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as SignupRequest;

    // Create new user in the database
    const newUser = db.user.create({
      email: body.email,
      name: `${body.firstName || "New"} ${body.lastName || "User"}`,
      role: "user",
    });

    // For signup, we don't include org data - user will create it in onboarding
    return HttpResponse.json({
      token: "mock-jwt-token-" + Date.now(),
      user: {
        userId: newUser.id,
        email: newUser.email,
        firstName: body.firstName || body.email.split("@")[0],
        lastName: body.lastName || "User",
        username: body.email.split("@")[0],
        pictureUrl: `https://ui-avatars.com/api/?name=${body.email.split("@")[0]}&background=random`,
        metadata: {},
      },
      // No org data on signup - will be created in onboarding
    });
  }),

  http.post("*/api/auth/logout", async () => {
    await delay(MOCK_DELAY);
    return HttpResponse.json({ success: true });
  }),

  http.post("*/api/auth/refresh", async () => {
    await delay(MOCK_DELAY);
    return HttpResponse.json({
      access_token: "new-mock-jwt-token",
      refresh_token: "new-mock-refresh-token",
    });
  }),

  // Agents endpoints
  http.get("*/v1/agents", async () => {
    await delay(MOCK_DELAY);
    const agents = db.agent.findMany({});
    return HttpResponse.json(agents);
  }),

  http.get("*/v1/agents/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const agent = db.agent.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!agent) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(agent);
  }),

  http.post("*/v1/agents", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as AgentRequest;
    const agent = db.agent.create(body);
    return HttpResponse.json(agent, { status: 201 });
  }),

  http.patch("*/v1/agents/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<AgentRequest>;
    const agent = db.agent.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!agent) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(agent);
  }),

  http.delete("*/v1/agents/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const agent = db.agent.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!agent) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Apps endpoints
  http.get("*/v1/apps", async () => {
    await delay(MOCK_DELAY);
    const apps = db.app.findMany({});
    return HttpResponse.json(apps);
  }),

  http.get("*/v1/apps/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const app = db.app.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!app) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(app);
  }),

  http.post("*/v1/apps", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as AppRequest;
    const app = db.app.create(body);
    return HttpResponse.json(app, { status: 201 });
  }),

  http.patch("*/v1/apps/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<AppRequest>;
    const app = db.app.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!app) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(app);
  }),

  http.delete("*/v1/apps/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const app = db.app.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!app) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // App Configs endpoints
  http.get("*/v1/appconfigs", async ({ request }) => {
    await delay(MOCK_DELAY);
    const url = new URL(request.url);
    const appId = url.searchParams.get("app_id");

    let configs = db.appConfig.findMany({});

    if (appId) {
      configs = configs.filter((config) => config.app_id === appId);
    }

    return HttpResponse.json(configs);
  }),

  http.get("*/v1/appconfigs/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const config = db.appConfig.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!config) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(config);
  }),

  http.post("*/v1/appconfigs", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as AppConfigRequest;
    const config = db.appConfig.create(body);
    return HttpResponse.json(config, { status: 201 });
  }),

  http.patch("*/v1/appconfigs/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<AppConfigRequest>;
    const config = db.appConfig.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!config) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(config);
  }),

  http.delete("*/v1/appconfigs/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const config = db.appConfig.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!config) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Linked Accounts endpoints
  http.get("*/v1/linked-accounts", async () => {
    await delay(MOCK_DELAY);
    const accounts = db.linkedAccount.findMany({});
    return HttpResponse.json(accounts);
  }),

  http.get("*/v1/linked-accounts/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const account = db.linkedAccount.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!account) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(account);
  }),

  http.post("*/v1/linked-accounts", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as LinkedAccountRequest;
    const account = db.linkedAccount.create(body);
    return HttpResponse.json(account, { status: 201 });
  }),

  http.delete("*/v1/linked-accounts/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const account = db.linkedAccount.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!account) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Teams endpoints
  http.get("*/v1/teams", async () => {
    await delay(MOCK_DELAY);
    const teams = db.team.findMany({});
    return HttpResponse.json(teams);
  }),

  http.get("*/v1/teams/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const team = db.team.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!team) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(team);
  }),

  http.post("*/v1/teams", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as TeamRequest;
    const team = db.team.create(body);
    return HttpResponse.json(team, { status: 201 });
  }),

  http.patch("*/v1/teams/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<TeamRequest>;
    const team = db.team.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!team) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(team);
  }),

  http.delete("*/v1/teams/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const team = db.team.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!team) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // Organization users management - MUST come before generic organization endpoints
  http.get("*/v1/organizations/users", async () => {
    await delay(MOCK_DELAY);
    // Organization ID available in header if needed

    // Return all users for the organization
    const users = db.user.findMany({});
    return HttpResponse.json(
      users.map((user) => {
        const userName = typeof user.name === "string" ? user.name : "User";
        const nameParts = userName.split(" ");
        return {
          userId: user.id,
          email: user.email,
          firstName: nameParts[0] || "User",
          lastName: nameParts[1] || "",
          role: user.role,
        };
      }),
    );
  }),

  http.post("*/v1/organizations/invite-user", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as InviteUserRequest;

    // Create a new user invitation
    const newUser = db.user.create({
      email: body.email,
      name: body.email.split("@")[0],
      role: body.role,
    });

    return HttpResponse.json({
      success: true,
      message: `Invitation sent to ${body.email}`,
      user: newUser,
    });
  }),

  http.delete("*/v1/organizations/users/:userId", async ({ params }) => {
    await delay(MOCK_DELAY);
    // Organization ID available in header if needed

    // Delete the user
    db.user.delete({
      where: { id: { equals: params.userId as string } },
    });

    return new HttpResponse(null, { status: 204 });
  }),

  // Organizations endpoints - generic organization routes come after specific ones
  http.get("*/v1/organizations", async () => {
    await delay(MOCK_DELAY);
    const organizations = db.organization.findMany({});
    return HttpResponse.json(organizations);
  }),

  http.get("*/v1/organizations/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const organization = db.organization.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!organization) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(organization);
  }),

  http.post("*/v1/organizations", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as OrganizationRequest;
    const organization = db.organization.create(body);
    return HttpResponse.json(organization, { status: 201 });
  }),

  http.patch("*/v1/organizations/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<OrganizationRequest>;
    const organization = db.organization.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!organization) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(organization);
  }),

  http.delete("*/v1/organizations/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const organization = db.organization.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!organization) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),

  // App Functions endpoints
  http.get("*/v1/app-functions", async ({ request }) => {
    await delay(MOCK_DELAY);
    const url = new URL(request.url);
    const appId = url.searchParams.get("app_id");

    let functions = db.appFunction.findMany({});

    if (appId) {
      functions = functions.filter((func) => func.app_id === appId);
    }

    return HttpResponse.json(functions);
  }),

  http.get("*/v1/app-functions/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const func = db.appFunction.findFirst({
      where: { id: { equals: params.id as string } },
    });

    if (!func) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(func);
  }),

  http.post("*/v1/app-functions", async ({ request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as AppFunctionRequest;
    const func = db.appFunction.create(body);
    return HttpResponse.json(func, { status: 201 });
  }),

  http.patch("*/v1/app-functions/:id", async ({ params, request }) => {
    await delay(MOCK_DELAY);
    const body = (await request.json()) as Partial<AppFunctionRequest>;
    const func = db.appFunction.update({
      where: { id: { equals: params.id as string } },
      data: { ...body, updated_at: new Date().toISOString() },
    });

    if (!func) {
      return new HttpResponse(null, { status: 404 });
    }

    return HttpResponse.json(func);
  }),

  http.delete("*/v1/app-functions/:id", async ({ params }) => {
    await delay(MOCK_DELAY);
    const func = db.appFunction.delete({
      where: { id: { equals: params.id as string } },
    });

    if (!func) {
      return new HttpResponse(null, { status: 404 });
    }

    return new HttpResponse(null, { status: 204 });
  }),
];
