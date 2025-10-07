from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from aci.common.db.crud import mcp_tool_call_logs
from aci.common.enums import OrganizationRole
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_tool_call_log import MCPToolCallLogCursor, MCPToolCallLogResponse
from aci.common.schemas.pagination import CursorPaginationParams, CursorPaginationResponse
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()


@router.get("/tool-calls", response_model=CursorPaginationResponse[MCPToolCallLogResponse])
async def get_tool_call_logs(
    context: Annotated[deps.RequestContext, Depends(deps.get_request_context)],
    pagination: Annotated[CursorPaginationParams, Depends()],
    mcp_tool_name: Annotated[str | None, Query()] = None,
) -> CursorPaginationResponse[MCPToolCallLogResponse]:
    """
    Get paginated tool call logs with cursor-based pagination.
    Results are ordered by started_at DESC (most recent first).
    """
    cursor = None
    if pagination.cursor is not None:
        try:
            cursor = MCPToolCallLogCursor.decode(pagination.cursor)
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid cursor") from e

    if context.act_as.role == OrganizationRole.ADMIN:
        logs, next_log = mcp_tool_call_logs.get_by_org(
            db_session=context.db_session,
            organization_id=context.act_as.organization_id,
            limit=pagination.limit,
            cursor=cursor,
            mcp_tool_name=mcp_tool_name,
        )
    else:
        logs, next_log = mcp_tool_call_logs.get_by_user(
            db_session=context.db_session,
            user_id=context.user_id,
            limit=pagination.limit,
            cursor=cursor,
            mcp_tool_name=mcp_tool_name,
        )

    return CursorPaginationResponse(
        data=[MCPToolCallLogResponse.model_validate(log, from_attributes=True) for log in logs],
        next_cursor=MCPToolCallLogCursor.encode(next_log.started_at, next_log.id)
        if next_log
        else None,
    )
