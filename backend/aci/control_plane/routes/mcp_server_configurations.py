from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import TypeAdapter

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationCreate,
    MCPServerConfigurationPublic,
)
from aci.common.schemas.pagination import PaginationParams
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model_exclude_none=True)
async def create_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerConfigurationCreate,
) -> MCPServerConfigurationPublic:
    # TODO: is the acl logic correct? can we abstract this to a acl module for reuse?
    # TODO: check allowed_teams are actually in the org
    # TODO: check enabled_tools are actually in the mcp server
    if context.act_as is None or context.act_as.role != OrganizationRole.ADMIN:
        logger.error("User does not have admin role")
        raise HTTPException(status_code=403, detail="Forbidden")

    mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        context.db_session, body.mcp_server_id, throw_error_if_not_found=False
    )
    if mcp_server is None:
        logger.error(
            f"MCP server not found for mcp server configuration {body.mcp_server_id}",
        )
        raise HTTPException(status_code=404, detail="MCP server not found")

    # auth_type must be one of the supported auth types
    type_adapter = TypeAdapter(list[AuthConfig])
    auth_configs = type_adapter.validate_python(mcp_server.auth_configs)
    if body.auth_type not in [auth_config.type for auth_config in auth_configs]:
        logger.error(
            f"Invalid auth type {body.auth_type} for mcp server configuration {body.mcp_server_id}",
        )
        raise HTTPException(status_code=400, detail="Invalid auth type")

    mcp_server_configuration = crud.mcp_server_configurations.create_mcp_server_configuration(
        context.db_session,
        context.act_as.organization_id,
        body,
    )

    context.db_session.commit()

    return MCPServerConfigurationPublic.model_validate(
        mcp_server_configuration, from_attributes=True
    )


@router.get("", response_model=list[MCPServerConfigurationPublic])
async def list_mcp_server_configurations(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> list[MCPServerConfigurationPublic]:
    # Admin can see all MCP server configurations under the org.
    if context.act_as.role == OrganizationRole.ADMIN:
        # Admin can see all MCP server configurations under the org
        mcp_server_configurations = crud.mcp_server_configurations.get_mcp_server_configurations(
            context.db_session,
            context.act_as.organization_id,
        )
    elif context.act_as.role == OrganizationRole.MEMBER:
        # Member can see MCP server configured for the teams that the member belongs to.
        org_teams = crud.teams.get_teams_by_user_id(
            db_session=context.db_session,
            organization_id=context.act_as.organization_id,
            user_id=context.user_id,
        )
        mcp_server_configurations = crud.mcp_server_configurations.get_mcp_server_configurations(
            context.db_session,
            context.act_as.organization_id,
            team_ids=[team.id for team in org_teams],
        )
    return [
        MCPServerConfigurationPublic.model_validate(mcp_server_configuration, from_attributes=True)
        for mcp_server_configuration in mcp_server_configurations
    ]
