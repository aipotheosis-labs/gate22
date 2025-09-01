from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server import MCPServerPublic
from aci.common.schemas.pagination import PaginationParams, PaginationResponse
from aci.control_plane import dependencies as deps
from aci.control_plane import schema_utils

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

    return schema_utils.construct_mcp_server_public(mcp_server)


@router.get("")
async def list_mcp_servers(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    pagination_params: Annotated[PaginationParams, Depends()],
) -> PaginationResponse[MCPServerPublic]:
    # TODO: support search by keywords / categories (currently filtering is done in Frontend)

    mcp_servers = crud.mcp_servers.list_mcp_servers(
        db_session, offset=pagination_params.offset, limit=pagination_params.limit
    )

    return PaginationResponse(
        data=[schema_utils.construct_mcp_server_public(mcp_server) for mcp_server in mcp_servers],
        offset=pagination_params.offset,
    )
