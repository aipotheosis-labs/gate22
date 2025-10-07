from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPToolCallLog
from aci.common.schemas.mcp_tool_call_log import MCPToolCallLogData


def create_log(db_session: Session, log_data: MCPToolCallLogData) -> MCPToolCallLog:
    log = MCPToolCallLog(**vars(log_data))
    db_session.add(log)
    db_session.flush()
    return log
