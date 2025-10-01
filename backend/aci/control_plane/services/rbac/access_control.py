from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import (
    ConnectedAccount,
    MCPServer,
    MCPServerBundle,
    MCPServerConfiguration,
    Organization,
    Team,
)
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.auth import ActAsInfo
from aci.control_plane.dependencies import RequestContext
from aci.control_plane.exceptions import NotPermittedError
from aci.control_plane.services.rbac.acl_loader import ACL
from aci.control_plane.services.rbac.definitions import (
    AccessibleResource,
    ConnectedAccountAction,
    ControlPlaneActionEnum,
    ControlPlanePermission,
    MCPServerAction,
    MCPServerBundleAction,
    MCPServerConfigurationAction,
    OrganizationAction,
    ResourceScope,
    TeamAction,
)

logger = get_logger(__name__)


def _match_user_action_permission(
    context: RequestContext,
    action: ControlPlaneActionEnum,
) -> ControlPlanePermission | None:
    """
    Match the user action to the permission in the ACL.
    """
    if context.act_as.role in ACL:
        for permission in ACL[context.act_as.role]:
            if permission.action == action:
                return permission
    return None


def is_action_permitted(
    context: RequestContext,
    user_action: ControlPlaneActionEnum,
    *,
    resource: AccessibleResource | None = None,
    resource_id: UUID | None = None,
    throw_error_if_not_permitted: bool = True,
) -> bool:
    """
    Check if the user has permission to perform the action on the resource.
    """
    # Make sure only either of resource or resource_id is provided
    if resource is not None and resource_id is not None:
        if throw_error_if_not_permitted:
            raise ValueError(
                "Resource and resource_id cannot be provided at the same time. Provide either one to avoid ambiguity."  # noqa: E501
            )
        return False

    # Find the permission for the action
    permission = _match_user_action_permission(context, user_action)
    if permission is None:
        if throw_error_if_not_permitted:
            raise NotPermittedError(
                message=f"User {context.user_id} (Acted as: {context.act_as.role}) is not permitted to perform action {user_action}"  # noqa: E501
            )
        return False

    # No allowed resource criteria is defined, we don't need to check the resource
    if permission.allowed_resource_criteria is None:
        return True

    # Resource lookup if not provided
    if resource is None and resource_id is not None:
        resource = _resource_lookup(context.db_session, user_action, resource_id)

    if not resource:
        if throw_error_if_not_permitted:
            raise NotPermittedError(
                message=f"User {context.user_id} (Acted as: {context.act_as.role}) does not have permission to perform action {user_action} on the resource {resource_id}"  # noqa: E501
            )
        else:
            return False

    # Make sure the resource provided match the permission resource type
    if resource.__class__.__name__ != permission.resource_type:
        if throw_error_if_not_permitted:
            raise NotPermittedError(
                message=f"User {context.user_id} (Acted as: {context.act_as.role}) does not have permission to perform action {user_action} on the resource {resource_id}"  # noqa: E501
            )
        return False

    # Check all the defined allowed resource criteria, reject if any of them is not met
    for criterion in permission.allowed_resource_criteria:
        if criterion.resource_scope is not None:
            if not _is_resource_match_allowed_resource_scope(
                context, resource, criterion.resource_scope
            ):
                return False

        if criterion.is_public is not None:
            if not isinstance(resource, MCPServer):
                return False
            if resource.organization_id is None:
                return False

        if criterion.connected_account_ownership is not None:
            if not isinstance(resource, MCPServerConfiguration):
                return False
            if resource.connected_account_ownership != criterion.connected_account_ownership:
                return False

        if criterion.ownership is not None:
            if not isinstance(resource, ConnectedAccount):
                return False
            if resource.ownership != criterion.ownership:
                return False

    return True


def _is_resource_match_allowed_resource_scope(
    context: RequestContext,
    resource: AccessibleResource,
    allowed_resource_scope: ResourceScope,
) -> bool:
    """
    Check if the resource scope is allowed.
    """
    match allowed_resource_scope:
        case ResourceScope.SAME_ORG:
            return _is_resource_same_org(context.act_as, resource)
        case ResourceScope.SELF_SAME_ORG:
            return _is_resource_self(context.user_id, resource)
        case ResourceScope.ALLOWED_TEAM_SAME_ORG:
            return _is_user_in_resource_allowed_teams(context.db_session, context.user_id, resource)
        case ResourceScope.ANY:
            return True


def _is_resource_same_org(
    act_as: ActAsInfo,
    resource: AccessibleResource,
) -> bool:
    """
    Helper function to check if the resource is within the organization of the act_as.
    """
    if isinstance(resource, MCPServer):
        return resource.organization_id == act_as.organization_id
    elif isinstance(resource, MCPServerConfiguration):
        return resource.organization_id == act_as.organization_id
    elif isinstance(resource, MCPServerBundle):
        return resource.organization_id == act_as.organization_id
    elif isinstance(resource, ConnectedAccount):
        return resource.mcp_server_configuration.organization_id == act_as.organization_id
    elif isinstance(resource, Team):
        return resource.organization_id == act_as.organization_id
    elif isinstance(resource, Organization):
        return resource.id == act_as.organization_id


def _is_user_in_resource_allowed_teams(
    db_session: Session,
    user_id: UUID,
    resource: AccessibleResource,
) -> bool:
    """
    Helper function to check if the resource has allowed any of the user's team.
    """
    if isinstance(resource, MCPServerConfiguration):
        return _is_mcp_server_configuration_in_allowed_team(db_session, user_id, resource.id)
    else:
        return False


def _is_resource_self(user_id: UUID, resource: AccessibleResource) -> bool:
    """
    Helper function to check if the resource belongs to user itself
    """
    if isinstance(resource, ConnectedAccount):
        return resource.user_id == user_id
    elif isinstance(resource, MCPServerBundle):
        return resource.user_id == user_id
    else:
        return False


def _resource_lookup(
    db_session: Session,
    action: ControlPlaneActionEnum,
    resource_id: UUID,
) -> AccessibleResource | None:
    """
    Lookup the resource by the resource_id.
    """
    if isinstance(action, MCPServerAction):
        return crud.mcp_servers.get_mcp_server_by_id(
            db_session, resource_id, throw_error_if_not_found=False
        )
    elif isinstance(action, MCPServerConfigurationAction):
        return crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
            db_session, resource_id, throw_error_if_not_found=False
        )
    elif isinstance(action, MCPServerBundleAction):
        return crud.mcp_server_bundles.get_mcp_server_bundle_by_id(db_session, resource_id)
    elif isinstance(action, ConnectedAccountAction):
        return crud.connected_accounts.get_connected_account_by_id(db_session, resource_id)
    elif isinstance(action, TeamAction):
        return crud.teams.get_team_by_id(db_session, resource_id)
    elif isinstance(action, OrganizationAction):
        return crud.organizations.get_organization_by_id(db_session, resource_id)


def check_mcp_server_config_accessibility(
    db_session: Session,
    user_id: UUID,
    mcp_server_configuration_id: UUID,
    throw_error_if_not_permitted: bool = True,
) -> bool:
    """
    Check if the user has access to a MCP server configuration.
    """
    if not _is_mcp_server_configuration_in_allowed_team(
        db_session, user_id, mcp_server_configuration_id
    ):
        if throw_error_if_not_permitted:
            raise NotPermittedError(
                message=f"none of the user's team is allowed in MCP Server "
                f"Configuration {mcp_server_configuration_id}"
            )
        return True
    return False


def check_act_as_organization_role(
    act_as: ActAsInfo,
    requested_organization_id: UUID | None = None,
    required_role: OrganizationRole = OrganizationRole.MEMBER,
    throw_error_if_not_permitted: bool = True,
) -> bool:
    """
    Check based on user's act_as information, verify if the user's act as:
    - Matches the requested organization_id
    - The role has permission to the requested role. (Admin is eligible to act as member role)

    This function throws an NotPermittedError if the user is not permitted to act as the requested
    organization and role.
    """
    try:
        if requested_organization_id and act_as.organization_id != requested_organization_id:
            raise NotPermittedError(
                message=f"ActAs organization_id {act_as.organization_id} does not match the "
                f"requested organization_id {requested_organization_id}"
            )
        if required_role == OrganizationRole.ADMIN and act_as.role != OrganizationRole.ADMIN:
            raise NotPermittedError(
                message=f"ActAs role {act_as.role} is not permitted to perform this action. "
                f"Required role: {required_role}"
            )
    except NotPermittedError as e:
        logger.error(f"NotPermittedError: {e.message}")
        if throw_error_if_not_permitted:
            raise e
        return False

    return True


def _is_mcp_server_configuration_in_allowed_team(
    db_session: Session,
    user_id: UUID,
    mcp_server_configuration_id: UUID,
) -> bool:
    """
    Returns:
        Whether the organization member has access to a MCP server configuration.
        Current rule:
        - True if the organization member belongs to any team that is allowed by the MCP server
        configuration
        - False otherwise
    """
    logger.debug(
        f"Checking if User {user_id} has access to the MCPServerConfiguration {mcp_server_configuration_id} as member"  # noqa: E501
    )

    mcp_server_configuration = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        db_session, mcp_server_configuration_id, throw_error_if_not_found=True
    )

    user_teams = crud.teams.get_teams_by_user_id(
        db_session, mcp_server_configuration.organization_id, user_id
    )
    user_team_ids: set[UUID] = {team.id for team in user_teams}
    allowed_team_ids: set[UUID] = set(mcp_server_configuration.allowed_teams or [])

    logger.debug(f"User teams: {user_team_ids}")
    logger.debug(f"Config allowed_teams: {allowed_team_ids}")

    # Check if any of the user's team is allowed by the MCP server configuration
    # (if any overlap between user_team_ids and allowed_team_ids)
    if user_team_ids.intersection(allowed_team_ids):
        logger.debug(
            f"User {user_id} has access to MCP Server Configuration {mcp_server_configuration_id}"
        )
        return True
    else:
        return False
