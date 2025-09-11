from enum import StrEnum


class UserIdentityProvider(StrEnum):
    GOOGLE = "google"  # google login
    EMAIL = "email"  # email/password login


class OrganizationRole(StrEnum):
    ADMIN = "admin"  # e.g., manager MCP server configuration
    MEMBER = "member"  # e.g., developer who bundle and use MCP servers


class TeamRole(StrEnum):
    # NOTE: currently we don't really need to differentiate between team members
    # keeping the enum structure for future use
    MEMBER = "member"


class AuthType(StrEnum):
    NO_AUTH = "no_auth"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"


class ConnectedAccountOwnership(StrEnum):
    INDIVIDUAL = "individual"
    SHARED = "shared"


class HttpLocation(StrEnum):
    PATH = "path"
    QUERY = "query"
    HEADER = "header"
    COOKIE = "cookie"
    BODY = "body"


class MCPServerTransportType(StrEnum):
    STREAMABLE_HTTP = "streamable_http"
    SSE = "sse"
