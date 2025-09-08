from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServerConfiguration
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_server_configuration import (
    MCPServerConfigurationCreate,
    MCPServerConfigurationPublic,
    MCPServerConfigurationUpdate,
)
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import access_control, schema_utils
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model_exclude_none=True)
async def create_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerConfigurationCreate,
) -> MCPServerConfigurationPublic:
    # TODO: check allowed_teams are actually in the org
    # TODO: check enabled_tools are actually in the mcp server
    access_control.check_act_as_organization_role(
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
    auth_configs = [
        AuthConfig.model_validate(auth_config_dict) for auth_config_dict in mcp_server.auth_configs
    ]
    if body.auth_type not in [auth_config.root.type for auth_config in auth_configs]:
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

    return schema_utils.construct_mcp_server_configuration_public(
        context.db_session, mcp_server_configuration
    )


@router.get("")
async def list_mcp_server_configurations(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerConfigurationPublic]:
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

    return PaginationResponse[MCPServerConfigurationPublic](
        data=[
            schema_utils.construct_mcp_server_configuration_public(
                context.db_session, mcp_server_configuration
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
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=mcp_server_configuration.organization_id,
        throw_error_if_not_permitted=True,
    )

    if context.act_as.role == OrganizationRole.MEMBER:
        # If user is member, check if the MCP server configuration's allowed teams contains the
        # user's team
        access_control.check_mcp_server_config_accessibility(
            db_session=context.db_session,
            user_id=context.user_id,
            mcp_server_configuration_id=mcp_server_configuration_id,
            throw_error_if_not_permitted=True,
        )

    return schema_utils.construct_mcp_server_configuration_public(
        context.db_session, mcp_server_configuration
    )


@router.patch("/{mcp_server_configuration_id}", response_model=MCPServerConfigurationPublic)
async def update_mcp_server_configuration(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_configuration_id: UUID,
    body: MCPServerConfigurationUpdate,
) -> MCPServerConfigurationPublic:
    mcp_server_configuration = crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
        context.db_session, mcp_server_configuration_id, throw_error_if_not_found=False
    )
    if mcp_server_configuration is None:
        raise HTTPException(status_code=404, detail="MCP server configuration not found")

    # Check if the MCP server configuration is under the user's org
    # Check if the user is acted as admin
    access_control.check_act_as_organization_role(
        context.act_as,
        requested_organization_id=mcp_server_configuration.organization_id,
        required_role=OrganizationRole.ADMIN,
        throw_error_if_not_permitted=True,
    )

    # Check if all team exists in the organization
    if body.allowed_teams is not None:
        for team_id in body.allowed_teams:
            team = crud.teams.get_team_by_id(context.db_session, team_id)
            if team is None:
                logger.error(f"Team {team_id} not found")
                raise HTTPException(status_code=400, detail=f"Team {team_id} not found")
            elif team.organization_id != mcp_server_configuration.organization_id:
                logger.error(f"Team {team_id} not in the organization")
                raise HTTPException(
                    status_code=400, detail=f"Team {team_id} not in the organization"
                )

    # Check if all tool exists in the MCP server
    if body.enabled_tools is not None:
        for tool_id in body.enabled_tools:
            tool = crud.mcp_tools.get_mcp_tool_by_id(context.db_session, tool_id)
            if tool is None:
                logger.error(f"Tool {tool_id} not found")
                raise HTTPException(status_code=400, detail=f"Tool {tool_id} not found")
            if tool.mcp_server_id != mcp_server_configuration.mcp_server_id:
                logger.error(f"Tool {tool_id} not in the MCP server")
                raise HTTPException(status_code=400, detail=f"Tool {tool_id} not in the MCP server")

    # Perform the update
    mcp_server_configuration = crud.mcp_server_configurations.update_mcp_server_configuration(
        db_session=context.db_session,
        mcp_server_configuration_id=mcp_server_configuration_id,
        mcp_server_configuration_update=body,
    )

    if body.allowed_teams is not None:
        # If the allowed teams are updated, check and clean up any stale connected accounts and
        # bundles
        _check_stale_connected_accounts_and_bundles(
            db_session=context.db_session,
            mcp_server_configuration=mcp_server_configuration,
        )

    context.db_session.commit()

    return schema_utils.construct_mcp_server_configuration_public(
        context.db_session, mcp_server_configuration
    )


def _check_stale_connected_accounts_and_bundles(
    db_session: Session, mcp_server_configuration: MCPServerConfiguration
) -> None:
    # Check and clean up any connected accounts that are no longer accessible to the
    # MCPServerConfiguration by the ConnectedAccount's owner.
    connected_accounts = (
        crud.connected_accounts.get_connected_accounts_by_mcp_server_configuration_id(
            db_session=db_session,
            mcp_server_configuration_id=mcp_server_configuration.id,
        )
    )
    for connected_account in connected_accounts:
        accessible = access_control.check_mcp_server_config_accessibility(
            db_session=db_session,
            user_id=connected_account.user_id,
            mcp_server_configuration_id=mcp_server_configuration.id,
            throw_error_if_not_permitted=False,
        )
        if not accessible:
            logger.info(
                f"Deleting the connected account {connected_account.id} as the user does not have access to the MCP server configuration {mcp_server_configuration.id}"  # noqa: E501
            )
            crud.connected_accounts.delete_connected_account(
                db_session=db_session,
                connected_account_id=connected_account.id,
            )

    # If the allowed teams are updated, check and remove any MCPServerConfiguration inside the
    # MCPBundles of the organization that is no longer accessible by the MCPBundles's owner.
    mcp_server_bundles = crud.mcp_server_bundles.get_mcp_server_bundles_by_organization_id_and_contains_mcp_server_configuration_id(  # noqa: E501
        db_session=db_session,
        organization_id=mcp_server_configuration.organization_id,
        mcp_server_configuration_id=mcp_server_configuration.id,
    )
    for mcp_server_bundle in mcp_server_bundles:
        accessible = access_control.check_mcp_server_config_accessibility(
            db_session=db_session,
            user_id=mcp_server_bundle.user_id,
            mcp_server_configuration_id=mcp_server_configuration.id,
            throw_error_if_not_permitted=False,
        )
        if not accessible:
            updated_config_ids = list(dict.fromkeys(mcp_server_bundle.mcp_server_configuration_ids))
            updated_config_ids.remove(mcp_server_configuration.id)

            crud.mcp_server_bundles.update_mcp_server_bundle_configuration_ids(
                db_session=db_session,
                mcp_server_bundle_id=mcp_server_bundle.id,
                update_mcp_server_bundle_configuration_ids=updated_config_ids,
            )


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
        access_control.check_act_as_organization_role(
            context.act_as,
            requested_organization_id=mcp_server_configuration.organization_id,
            required_role=OrganizationRole.ADMIN,
            throw_error_if_not_permitted=True,
        )

        crud.mcp_server_configurations.delete_mcp_server_configuration(
            context.db_session, mcp_server_configuration_id
        )

        context.db_session.commit()
    else:
        raise HTTPException(
            status_code=404,
            detail=f"MCP Server Configuration {mcp_server_configuration_id} not found",
        )
