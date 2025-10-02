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


def get_session(db_session: Session, id: UUID, include_deleted: bool = False) -> MCPSession | None:
    statement = select(MCPSession).where(MCPSession.id == id)
    if not include_deleted:
        statement = statement.where(MCPSession.deleted.is_(False))
    return db_session.execute(statement).scalar_one_or_none()


def update_session_last_accessed_at(
    db_session: Session, mcp_session: MCPSession, last_accessed_at: datetime
) -> None:
    mcp_session.last_accessed_at = last_accessed_at
    db_session.flush()
    db_session.refresh(mcp_session)
    return None


def update_session_external_mcp_sessions(
    db_session: Session, mcp_session: MCPSession, external_mcp_sessions: dict[str, str]
) -> None:
    mcp_session.external_mcp_sessions = external_mcp_sessions
    db_session.flush()
    db_session.refresh(mcp_session)
    return None


def update_session_external_mcp_session(
    db_session: Session, mcp_session: MCPSession, mcp_server_id: UUID, mcp_session_id: str
) -> None:
    # NOTE: JSONB is not mutable (didn't set it to avoid suprises), assigning new value
    # directly will not trigger the update.
    new_dict = mcp_session.external_mcp_sessions.copy()
    new_dict[str(mcp_server_id)] = mcp_session_id
    mcp_session.external_mcp_sessions = new_dict
    db_session.flush()

    return None


def delete_session(db_session: Session, mcp_session: MCPSession) -> None:
    mcp_session.deleted = True
    db_session.flush()
    return None
