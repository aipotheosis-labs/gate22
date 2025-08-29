from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_server import MCPServerPublic, MCPServerPublicBasic
from aci.common.schemas.mcp_tool import MCPToolPublic
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


# TODO: support both query by mcp server id and name
@router.get("/{mcp_server_id}", response_model=MCPServerPublic, response_model_exclude_none=True)
async def get_mcp_server(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    mcp_server_id: UUID,
) -> MCPServerPublic:
    mcp_server = crud.mcp_servers.get_mcp_server_by_id(
        context.db_session, mcp_server_id, throw_error_if_not_found=False
    )
    if not mcp_server:
        # TODO: should we only use custom error class here, e.g, MCPServerNotFoundError?
        raise HTTPException(status_code=404, detail="MCP server not found")

    auth_configs = [
        AuthConfig.model_validate(auth_config_dict) for auth_config_dict in mcp_server.auth_configs
    ]

    mcp_server_public = MCPServerPublic(
        id=mcp_server.id,
        name=mcp_server.name,
        url=mcp_server.url,
        description=mcp_server.description,
        logo=mcp_server.logo,
        categories=mcp_server.categories,
        supported_auth_types=[auth_config.root.type for auth_config in auth_configs],
        tools=[
            MCPToolPublic.model_validate(tool, from_attributes=True) for tool in mcp_server.tools
        ],
        created_at=mcp_server.created_at,
        updated_at=mcp_server.updated_at,
    )

    return mcp_server_public


@router.get("")
async def list_mcp_servers(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerPublicBasic]:
    # TODO: support search by keywords / categories (currently filtering is done in Frontend)

    mcp_servers = crud.mcp_servers.list_mcp_servers(
        db_session, offset=pagination_params.offset, limit=pagination_params.limit
    )
    return PaginationResponse(
        data=[
            MCPServerPublicBasic.model_validate(mcp_server, from_attributes=True)
            for mcp_server in mcp_servers
        ],
        offset=pagination_params.offset,
    )
