from datetime import datetime
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.sql import select

from aci.common.db.sql_models import MCPSession


def create_session(
    db_session: Session, bundle_id: UUID, external_mcp_sessions: dict[str, str]
) -> MCPSession:
    mcp_session = MCPSession(
        bundle_id=bundle_id,
        external_mcp_sessions=external_mcp_sessions,
    )
    db_session.add(mcp_session)
    db_session.flush()
    db_session.refresh(mcp_session)
    return mcp_session


def get_session(db_session: Session, id: UUID) -> MCPSession | None:
    return db_session.execute(select(MCPSession).where(MCPSession.id == id)).scalar_one_or_none()


def update_session_last_accessed_at(
    db_session: Session, mcp_session: MCPSession, last_accessed_at: datetime
) -> None:
    mcp_session.last_accessed_at = last_accessed_at
    db_session.flush()
    db_session.refresh(mcp_session)
    return None
