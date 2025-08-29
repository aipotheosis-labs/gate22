from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import TypeAdapter
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServerConfiguration
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_server import MCPServerPublicBasic
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationCreate,
    MCPServerConfigurationPublic,
    MCPServerConfigurationPublicBasic,
)
from aci.common.schemas.mcp_tool import MCPToolPublic
from aci.common.schemas.organization import TeamInfo
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import dependencies as deps
from aci.control_plane import rbac

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model_exclude_none=True)
async def create_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerConfigurationCreate,
) -> MCPServerConfigurationPublic:
    # TODO: check allowed_teams are actually in the org
    # TODO: check enabled_tools are actually in the mcp server
    rbac.check_permission(
        context.act_as,
        requested_organization_id=context.act_as.organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

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

    return _construct_mcp_server_configuration_public(context.db_session, mcp_server_configuration)


@router.get("")
async def list_mcp_server_configurations(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerConfigurationPublicBasic]:
    team_ids: list[UUID] | None

    if context.act_as.role == OrganizationRole.ADMIN:
        # Admin can see all MCP server configurations under the org.
        team_ids = None  # Not to filter for admin
    elif context.act_as.role == OrganizationRole.MEMBER:
        # Member can see MCP server configured for the teams that the member belongs to.
        org_teams = crud.teams.get_teams_by_user_id(
            db_session=context.db_session,
            organization_id=context.act_as.organization_id,
            user_id=context.user_id,
        )
        team_ids = [team.id for team in org_teams]

    # Admin can see all MCP server configurations under the org
    mcp_server_configurations = crud.mcp_server_configurations.get_mcp_server_configurations(
        context.db_session,
        context.act_as.organization_id,
        offset=pagination_params.offset,
        limit=pagination_params.limit,
        team_ids=team_ids,
    )

    logger.info(f"mcp_server_configurations: {mcp_server_configurations}")

    return PaginationResponse[MCPServerConfigurationPublicBasic](
        data=[
            MCPServerConfigurationPublicBasic.model_validate(
                mcp_server_configuration, from_attributes=True
            )
            for mcp_server_configuration in mcp_server_configurations
        ],
        offset=pagination_params.offset,
    )


@router.get("/{mcp_server_configuration_id}", response_model=MCPServerConfigurationPublic)
async def get_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_configuration_id: UUID,
) -> MCPServerConfigurationPublic:
    mcp_server_configuration = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        context.db_session, mcp_server_configuration_id, throw_error_if_not_found=False
    )
    if mcp_server_configuration is None:
        raise HTTPException(status_code=404, detail="MCP server configuration not found")

    # Check if the MCP server configuration is under the user's org
    if mcp_server_configuration.organization_id != context.act_as.organization_id:
        logger.info(
            f"MCP server configuration {mcp_server_configuration_id} is not under the user's org"
        )
        raise HTTPException(status_code=403, detail="Forbidden")

    elif context.act_as.role == OrganizationRole.MEMBER:
        # If user is member, check if the MCP server configuration's allowed teams contains the
        # user's team
        rbac.is_mcp_server_configuration_in_user_team(
            db_session=context.db_session,
            user_id=context.user_id,
            act_as_organization_id=context.act_as.organization_id,
            mcp_server_configuration_id=mcp_server_configuration_id,
            throw_error_if_not_permitted=True,
        )

    return _construct_mcp_server_configuration_public(context.db_session, mcp_server_configuration)


@router.delete("/{mcp_server_configuration_id}", status_code=status.HTTP_200_OK)
async def delete_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_configuration_id: UUID,
) -> None:
    mcp_server_configuration = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        context.db_session, mcp_server_configuration_id, throw_error_if_not_found=False
    )

    if mcp_server_configuration is not None:
        # Check if the user is an admin and is acted as the organization_id of the MCP server
        # configuration
        rbac.check_permission(
            context.act_as,
            requested_organization_id=mcp_server_configuration.organization_id,
            required_role=OrganizationRole.ADMIN,
            throw_error_if_not_permitted=True,
        )

        crud.mcp_server_configurations.delete_mcp_server_configuration(
            context.db_session, mcp_server_configuration_id
        )
    else:
        raise HTTPException(
            status_code=404,
            detail=f"MCP Server Configuration {mcp_server_configuration_id} not found",
        )

    context.db_session.commit()


def _construct_mcp_server_configuration_public(
    db_session: Session, mcp_server_configuration: MCPServerConfiguration
) -> MCPServerConfigurationPublic:
    """
    Dynamically retreive and populate the enabled_tools and allowed_teams
    for the MCP server configuration.
    """
    enabled_tools = crud.mcp_tools.get_mcp_tools_by_ids(
        db_session, mcp_server_configuration.enabled_tools
    )
    allowed_teams = crud.teams.get_teams_by_ids(db_session, mcp_server_configuration.allowed_teams)

    return MCPServerConfigurationPublic(
        id=mcp_server_configuration.id,
        mcp_server_id=mcp_server_configuration.mcp_server_id,
        organization_id=mcp_server_configuration.organization_id,
        auth_type=mcp_server_configuration.auth_type,
        all_tools_enabled=mcp_server_configuration.all_tools_enabled,
        enabled_tools=[
            MCPToolPublic.model_validate(tool, from_attributes=True) for tool in enabled_tools
        ],
        allowed_teams=[
            TeamInfo(
                team_id=team.id,
                name=team.name,
                description=team.description,
                created_at=team.created_at,
            )
            for team in allowed_teams
        ],
        mcp_server=MCPServerPublicBasic.model_validate(
            mcp_server_configuration.mcp_server, from_attributes=True
        ),
        created_at=mcp_server_configuration.created_at,
        updated_at=mcp_server_configuration.updated_at,
    )
