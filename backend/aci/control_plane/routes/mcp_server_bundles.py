from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_bundle import (
    MCPServerBundleCreate,
    MCPServerBundlePublic,
)
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import dependencies as deps
from aci.control_plane import rbac, schema_utils
from aci.control_plane.exceptions import NotPermittedError

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model=MCPServerBundlePublic, response_model_exclude_none=True)
async def create_mcp_server_bundle(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerBundleCreate,
) -> MCPServerBundlePublic:
    # TODO: acl control
    # Only member can create MCP server bundle
    if context.act_as.role == OrganizationRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    for mcp_server_configuration_id in body.mcp_server_configuration_ids:
        # make sure mcp_server_configuration_ids are actually in the org and user belongs
        # to a team that has access to the mcp server configuration
        rbac.is_mcp_server_configuration_in_user_team(
            db_session=context.db_session,
            user_id=context.user_id,
            act_as_organization_id=context.act_as.organization_id,
            mcp_server_configuration_id=mcp_server_configuration_id,
            throw_error_if_not_permitted=True,
        )

        connected_account = crud.connected_accounts.get_connected_account_by_user_id_and_mcp_server_configuration_id(  # noqa: E501
            context.db_session,
            context.user_id,
            mcp_server_configuration_id,
        )
        if connected_account is None:
            logger.error(
                f"Connected account not found for user {context.user_id} and mcp "
                f"configuration {mcp_server_configuration_id}",
            )
            raise HTTPException(
                status_code=404,
                detail=f"Connected account not found for user {context.user_id} and "
                f"mcp server configuration {mcp_server_configuration_id}",
            )

    mcp_server_bundle = crud.mcp_server_bundles.create_mcp_server_bundle(
        context.db_session,
        context.user_id,
        context.act_as.organization_id,
        body,
    )

    context.db_session.commit()

    return schema_utils.construct_mcp_server_bundle_public(context.db_session, mcp_server_bundle)


@router.get("", response_model=PaginationResponse[MCPServerBundlePublic])
async def list_mcp_server_bundles(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerBundlePublic]:
    if context.act_as.role == OrganizationRole.ADMIN:
        mcp_server_bundles = crud.mcp_server_bundles.get_mcp_server_bundles_by_organization_id(
            context.db_session,
            context.act_as.organization_id,
            offset=pagination_params.offset,
            limit=pagination_params.limit,
        )
    else:
        mcp_server_bundles = (
            crud.mcp_server_bundles.get_mcp_server_bundles_by_user_id_and_organization_id(
                context.db_session,
                context.user_id,
                context.act_as.organization_id,
                offset=pagination_params.offset,
                limit=pagination_params.limit,
            )
        )

    return PaginationResponse[MCPServerBundlePublic](
        data=[
            schema_utils.construct_mcp_server_bundle_public(context.db_session, mcp_server_bundle)
            for mcp_server_bundle in mcp_server_bundles
        ],
        offset=pagination_params.offset,
    )


@router.get("/{mcp_server_bundle_id}", response_model=MCPServerBundlePublic)
async def get_mcp_server_bundle(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_bundle_id: UUID,
) -> MCPServerBundlePublic:
    mcp_server_bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
        context.db_session, mcp_server_bundle_id
    )

    if mcp_server_bundle is None:
        raise HTTPException(status_code=404, detail="MCP server bundle not found")

    # check if the MCP server bundle is under the user's org
    rbac.check_permission(
        context.act_as,
        requested_organization_id=mcp_server_bundle.organization_id,
        throw_error_if_not_permitted=True,
    )

    if context.act_as.role == OrganizationRole.MEMBER:
        # If user is member, check if the MCP server bundle is belongs to the member
        if mcp_server_bundle.user_id != context.user_id:
            logger.error(
                f"MCP server bundle {mcp_server_bundle_id} is not belongs to the member {context.user_id}"  # noqa: E501
            )
            raise NotPermittedError(message="Cannot access MCP server bundle")

    return schema_utils.construct_mcp_server_bundle_public(context.db_session, mcp_server_bundle)


@router.delete("/{mcp_server_bundle_id}", status_code=status.HTTP_200_OK)
async def delete_mcp_server_bundle(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_bundle_id: UUID,
) -> None:
    mcp_server_bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
        context.db_session, mcp_server_bundle_id
    )
    if mcp_server_bundle is None:
        raise HTTPException(status_code=404, detail="MCP server bundle not found")

    # check if the MCP server bundle is under the user's org
    rbac.check_permission(
        context.act_as,
        requested_organization_id=mcp_server_bundle.organization_id,
        throw_error_if_not_permitted=True,
    )

    if context.act_as.role == OrganizationRole.MEMBER:
        # If user is member, check if the MCP server bundle is belongs to the member
        if mcp_server_bundle.user_id != context.user_id:
            logger.error(
                f"MCP server bundle {mcp_server_bundle_id} is not belongs to the member {context.user_id}"  # noqa: E501
            )
            raise NotPermittedError(message="Cannot delete MCP server bundle")

        crud.mcp_server_bundles.delete_mcp_server_bundle(context.db_session, mcp_server_bundle_id)
        context.db_session.commit()

    else:
        # Admin cannot delete MCP server bundle
        raise NotPermittedError(message="Cannot delete MCP server bundle")
