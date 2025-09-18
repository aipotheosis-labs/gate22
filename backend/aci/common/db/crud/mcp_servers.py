from typing import Literal, overload
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServer
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_server import CustomMCPServerCreate, PublicMCPServerUpsert

logger = get_logger(__name__)


@overload
def get_mcp_server_by_name(
    db_session: Session, name: str, throw_error_if_not_found: Literal[True]
) -> MCPServer: ...


@overload
def get_mcp_server_by_name(
    db_session: Session, name: str, throw_error_if_not_found: Literal[False]
) -> MCPServer | None: ...


def get_mcp_server_by_name(
    db_session: Session, name: str, throw_error_if_not_found: bool
) -> MCPServer | None:
    statement = select(MCPServer).where(MCPServer.name == name)

    mcp_server: MCPServer | None = None
    if throw_error_if_not_found:
        mcp_server = db_session.execute(statement).scalar_one()
        return mcp_server
    else:
        mcp_server = db_session.execute(statement).scalar_one_or_none()
        return mcp_server


@overload
def get_mcp_server_by_id(
    db_session: Session, id: UUID, throw_error_if_not_found: Literal[True]
) -> MCPServer: ...


@overload
def get_mcp_server_by_id(
    db_session: Session, id: UUID, throw_error_if_not_found: Literal[False]
) -> MCPServer | None: ...


def get_mcp_server_by_id(
    db_session: Session, id: UUID, throw_error_if_not_found: bool
) -> MCPServer | None:
    statement = select(MCPServer).where(MCPServer.id == id)

    mcp_server: MCPServer | None = None
    if throw_error_if_not_found:
        mcp_server = db_session.execute(statement).scalar_one()
        return mcp_server
    else:
        mcp_server = db_session.execute(statement).scalar_one_or_none()
        return mcp_server


def create_public_mcp_server(
    db_session: Session, mcp_server_upsert: PublicMCPServerUpsert, embedding: list[float]
) -> MCPServer:
    mcp_server_data = mcp_server_upsert.model_dump(mode="json", exclude_none=True)
    mcp_server = MCPServer(
        **mcp_server_data,
        embedding=embedding,
        organization_id=None,
        last_synced_at=None,
    )
    db_session.add(mcp_server)
    db_session.flush()
    db_session.refresh(mcp_server)
    return mcp_server


def update_public_mcp_server(
    db_session: Session,
    mcp_server: MCPServer,
    mcp_server_upsert: PublicMCPServerUpsert,
    embedding: list[float] | None = None,
) -> MCPServer:
    new_mcp_server_data = mcp_server_upsert.model_dump(mode="json", exclude_none=True)

    for field, value in new_mcp_server_data.items():
        setattr(mcp_server, field, value)

    if embedding:
        mcp_server.embedding = embedding

    db_session.flush()
    db_session.refresh(mcp_server)
    return mcp_server


def create_custom_mcp_server(
    db_session: Session,
    organization_id: UUID,
    custom_mcp_server_upsert: CustomMCPServerCreate,
    embedding: list[float],
) -> MCPServer:
    mcp_server_data = custom_mcp_server_upsert.model_dump(mode="json", exclude_none=True)
    mcp_server = MCPServer(
        **mcp_server_data,
        embedding=embedding,
        organization_id=organization_id,
        last_synced_at=None,
    )
    db_session.add(mcp_server)
    db_session.flush()
    db_session.refresh(mcp_server)
    return mcp_server


def list_mcp_servers(
    db_session: Session,
    organization_id: UUID | None = None,
    offset: int | None = None,
    limit: int | None = None,
) -> list[MCPServer]:
    """
    Returns:
        List of MCP Servers.
        If organization_id is provided, returns Public MCP Servers + Custom MCP Servers under the
        organization.
        If not provided, returns all Public MCP Servers.
    """
    statement = select(MCPServer).order_by(MCPServer.name.asc())

    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    if organization_id is not None:
        statement = statement.where(
            or_(
                MCPServer.organization_id == organization_id,
                MCPServer.organization_id.is_(None),
            )
        )
    else:
        statement = statement.where(MCPServer.organization_id.is_(None))

    servers = list(db_session.execute(statement).scalars().all())
    return servers
