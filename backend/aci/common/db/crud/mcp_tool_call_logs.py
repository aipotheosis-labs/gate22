from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPToolCallLog
from aci.common.schemas.mcp_tool_call_log import (
    MCPToolCallLogCreate,
    MCPToolCallLogCursor,
)


def create(db_session: Session, log_create: MCPToolCallLogCreate) -> MCPToolCallLog:
    log = MCPToolCallLog(**log_create.model_dump())
    db_session.add(log)
    db_session.flush()
    db_session.refresh(log)
    return log


def get(
    db_session: Session,
    limit: int,
    cursor: MCPToolCallLogCursor | None = None,
    mcp_tool_name: str | None = None,
) -> tuple[list[MCPToolCallLog], MCPToolCallLog | None]:
    """
    Get paginated tool call logs with cursor-based pagination.
    Results are ordered by started_at DESC (most recent first) and id DESC for stable pagination.
    Returns a tuple of
     - (results, last item) if there are more results
     - (results, None) if there are no more results
    NOTE: we use started_at instead of created_at because the latter is auto generated
    during insert. Plus we want to sort by the time the tool call arrives not when it's done.
    """
    statement = select(MCPToolCallLog)

    # Filters
    if mcp_tool_name:
        statement = statement.where(MCPToolCallLog.mcp_tool_name == mcp_tool_name)

    # Handle cursor pagination
    if cursor:
        statement = statement.where(
            (MCPToolCallLog.started_at < cursor.started_at)
            | ((MCPToolCallLog.started_at == cursor.started_at) & (MCPToolCallLog.id < cursor.id))
        )

    # Order by started_at DESC, id DESC for stable pagination
    statement = statement.order_by(desc(MCPToolCallLog.started_at), desc(MCPToolCallLog.id))

    # Fetch limit + 1 to determine if there are more results
    statement = statement.limit(limit + 1)

    results = db_session.execute(statement).scalars().all()

    # Determine next cursor
    has_more = len(results) > limit
    if has_more:
        return list(results[:limit]), results[limit - 1]
    else:
        return list(results), None
