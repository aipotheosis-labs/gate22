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


def get_session(db_session: Session, session_id: UUID) -> MCPSession | None:
    return db_session.execute(
        select(MCPSession).where(MCPSession.id == session_id)
    ).scalar_one_or_none()
