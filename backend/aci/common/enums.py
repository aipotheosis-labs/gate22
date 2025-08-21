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
