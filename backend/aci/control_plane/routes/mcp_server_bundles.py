from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from aci.common.db import crud
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server_bundle import (
    MCPServerBundleCreate,
    MCPServerBundlePublic,
)
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.post("", response_model=MCPServerBundlePublic, response_model_exclude_none=True)
async def create_mcp_server_bundle(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    body: MCPServerBundleCreate,
) -> MCPServerBundlePublic:
    # TODO: acl control
    if context.act_as is None or context.act_as.role != OrganizationRole.ADMIN:
        raise HTTPException(status_code=403, detail="Forbidden")

    # TODO: make sure mcp_server_configuration_ids are actually in the org and user belongs
    # to a team that has access to the mcp server configuration

    for mcp_server_configuration_id in body.mcp_server_configuration_ids:
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

    return MCPServerBundlePublic.model_validate(mcp_server_bundle, from_attributes=True)
