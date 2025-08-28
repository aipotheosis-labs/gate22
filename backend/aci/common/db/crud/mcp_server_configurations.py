from typing import Literal, overload
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerConfiguration
from aci.common.schemas.mcp_server_configuration import MCPServerConfigurationCreate


def create_mcp_server_configuration(
    db_session: Session,
    organization_id: UUID,
    mcp_server_configuration: MCPServerConfigurationCreate,
) -> MCPServerConfiguration:
    db_mcp_server_configuration = MCPServerConfiguration(
        mcp_server_id=mcp_server_configuration.mcp_server_id,
        organization_id=organization_id,
        auth_type=mcp_server_configuration.auth_type,
        all_tools_enabled=mcp_server_configuration.all_tools_enabled,
        enabled_tools=mcp_server_configuration.enabled_tools,
        allowed_teams=mcp_server_configuration.allowed_teams,
    )
    db_session.add(db_mcp_server_configuration)
    db_session.flush()
    db_session.refresh(db_mcp_server_configuration)

    return db_mcp_server_configuration


@overload
def get_mcp_server_configuration_by_id(
    db_session: Session,
    mcp_server_configuration_id: UUID,
    throw_error_if_not_found: Literal[True],
) -> MCPServerConfiguration: ...


@overload
def get_mcp_server_configuration_by_id(
    db_session: Session,
    mcp_server_configuration_id: UUID,
    throw_error_if_not_found: Literal[False],
) -> MCPServerConfiguration | None: ...


def get_mcp_server_configuration_by_id(
    db_session: Session,
    mcp_server_configuration_id: UUID,
    throw_error_if_not_found: bool,
) -> MCPServerConfiguration | None:
    statement = select(MCPServerConfiguration).where(
        MCPServerConfiguration.id == mcp_server_configuration_id
    )

    mcp_server_configuration: MCPServerConfiguration | None = None
    if throw_error_if_not_found:
        mcp_server_configuration = db_session.execute(statement).scalar_one()
        return mcp_server_configuration
    else:
        mcp_server_configuration = db_session.execute(statement).scalar_one_or_none()
        return mcp_server_configuration
