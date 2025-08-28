from typing import Literal, overload
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerConfiguration, Team
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


def get_mcp_server_configurations(
    db_session: Session,
    organization_id: UUID,
    team_ids: list[UUID] | None = None,  # None means no filter
    offset: int | None = None,
    limit: int | None = None,
) -> list[MCPServerConfiguration]:
    statement = select(MCPServerConfiguration).where(
        MCPServerConfiguration.organization_id == organization_id,
    )

    if team_ids is not None:
        # Verify the team ids are in the org
        select_team_statement = select(Team).where(
            Team.id.in_(team_ids), Team.organization_id == organization_id
        )
        org_teams = list(db_session.execute(select_team_statement).scalars().all())

        # overlap() is not type hinted but is available.
        # Make sure the field is Column of PostgreSQL array (import sqlalchemy.dialects.postgresql)
        statement = statement.where(
            MCPServerConfiguration.allowed_teams.overlap([team.id for team in org_teams]),
        )

    statement = statement.order_by(MCPServerConfiguration.created_at.desc())
    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)

    return list(db_session.execute(statement).scalars().all())


def delete_mcp_server_configuration(
    db_session: Session,
    mcp_server_configuration_id: UUID,
) -> None:
    db_session.query(MCPServerConfiguration).filter(
        MCPServerConfiguration.id == mcp_server_configuration_id
    ).delete()
