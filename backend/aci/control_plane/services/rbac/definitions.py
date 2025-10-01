# Ownership can be public / org
from enum import StrEnum

from pydantic import BaseModel

from aci.common.db.sql_models import (
    ConnectedAccount,
    MCPServer,
    MCPServerBundle,
    MCPServerConfiguration,
    Organization,
    Team,
)
from aci.common.enums import ConnectedAccountOwnership

"""
Action String Convention:
    <resource_type>.(<resource_subtype>|*):<action>
"""


class MCPServerAction(StrEnum):
    LIST = "mcp_server:list"
    READ = "mcp_server:read"
    CREATE = "mcp_server:create"
    UPDATE = "mcp_server:update"
    DELETE = "mcp_server:delete"
    REFRESH_TOOLS = "mcp_server:refresh_tools"
    OAUTH2_DISCOVERY = "mcp_server:oauth2_discovery"
    OAUTH2_DCR = "mcp_server:oauth2_dcr"

    # Permission to create a MCP server configuration on a MCP server
    CREATE_CONFIGURATION_ON = "mcp_server:create_configuration_on"


class MCPServerConfigurationAction(StrEnum):
    LIST = "mcp_server_configuration:list"

    READ = "mcp_server_configuration:read"
    CREATE = "mcp_server_configuration:create"
    UPDATE = "mcp_server_configuration:update"
    DELETE = "mcp_server_configuration:delete"

    # Permission to create a bundle on a MCP server configuration
    CREATE_BUNDLE_ON = "mcp_server_configuration:create_bundle_on"
    # Permission to create a connected account on a MCP server configuration
    CREATE_CONNECTED_ACCOUNT_ON = "mcp_server_configuration:create_connected_account_on"


class MCPServerBundleAction(StrEnum):
    CREATE = "mcp_server_bundle:create"
    LIST = "mcp_server_bundle:list"
    READ = "mcp_server_bundle:read"
    DELETE = "mcp_server_bundle:delete"


class ConnectedAccountAction(StrEnum):
    CREATE = "connected_account:create"
    DELETE = "connected_account:delete"
    LIST = "connected_account:list"


class TeamAction(StrEnum):
    CREATE = "team:create"
    LIST = "team:list"
    LIST_MEMBER = "team:list_member"
    ADD_MEMBER = "team:add_member"
    REMOVE_MEMBER = "team:remove_member"


class OrganizationAction(StrEnum):
    REMOVE_MEMBER = "organization:remove_member"
    UPDATE_MEMBER_ROLE = "organization:update_member_role"
    LIST_MEMBER = "organization:list_member"
    CREATE_INVITATION = "organization:create_invitation"
    CANCEL_INVITATION = "organization:cancel_invitation"
    LIST_INVITATION = "organization:list_invitation"


ControlPlaneActionEnum = (
    MCPServerAction
    | MCPServerConfigurationAction
    | MCPServerBundleAction
    | ConnectedAccountAction
    | TeamAction
    | OrganizationAction
)

AccessibleResource = (
    MCPServer | MCPServerConfiguration | MCPServerBundle | ConnectedAccount | Team | Organization
)


class ResourceScope(StrEnum):
    # Allowed to access resource within same org
    SAME_ORG = "same_org"

    # Allowed to access resource within same org, and user is the owner of the resource
    SELF_SAME_ORG = "same_org:self"

    # Allowed to access resource within same org, and user is in the resource allowed team
    ALLOWED_TEAM_SAME_ORG = "same_org:allowed_team"

    ANY = "any"


class AllowedResourceCriterion(BaseModel):
    # Used generally for all type of resources
    resource_scope: ResourceScope | None = None

    # Used for MCP server
    is_public: bool | None = None
    # Used for MCP server configuration
    connected_account_ownership: ConnectedAccountOwnership | None = None
    # Used for connected account
    ownership: ConnectedAccountOwnership | None = None


class ControlPlanePermission(BaseModel):
    """
    Define a permission for an action
    """

    action: ControlPlaneActionEnum
    resource_type: str | None = None
    allowed_resource_criteria: list[AllowedResourceCriterion] | None = None
