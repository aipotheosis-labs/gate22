from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPToolCallLog
from aci.common.schemas.mcp_tool_call_log import MCPToolCallLogCreate


def create(db_session: Session, log_create: MCPToolCallLogCreate) -> MCPToolCallLog:
    log = MCPToolCallLog(**log_create.model_dump())
    db_session.add(log)
    db_session.flush()
    db_session.refresh(log)
    return log
