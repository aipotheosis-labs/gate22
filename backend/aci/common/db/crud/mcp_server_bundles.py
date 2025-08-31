from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerBundle, MCPServerConfiguration
from aci.common.schemas.mcp_server_bundle import MCPServerBundleCreate


def create_mcp_server_bundle(
    db_session: Session,
    user_id: UUID,
    organization_id: UUID,
    mcp_server_bundle_create: MCPServerBundleCreate,
) -> MCPServerBundle:
    mcp_server_bundle = MCPServerBundle(
        name=mcp_server_bundle_create.name,
        description=mcp_server_bundle_create.description,
        user_id=user_id,
        organization_id=organization_id,
        mcp_server_configuration_ids=mcp_server_bundle_create.mcp_server_configuration_ids,
    )
    db_session.add(mcp_server_bundle)
    db_session.flush()
    db_session.refresh(mcp_server_bundle)

    return mcp_server_bundle


def get_mcp_server_bundle_by_id(
    db_session: Session,
    mcp_server_bundle_id: UUID,
) -> MCPServerBundle | None:
    statement = select(MCPServerBundle).where(MCPServerBundle.id == mcp_server_bundle_id)
    return db_session.execute(statement).scalar_one_or_none()


def get_mcp_server_bundles_by_organization_id(
    db_session: Session,
    organization_id: UUID,
    offset: int | None = None,
    limit: int | None = None,
) -> list[MCPServerBundle]:
    statement = (
        select(MCPServerBundle)
        .where(MCPServerBundle.organization_id == organization_id)
        .order_by(MCPServerBundle.created_at.desc())
    )
    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)
    return list(db_session.execute(statement).scalars().all())


def get_mcp_server_bundles_by_user_id_and_organization_id(
    db_session: Session,
    user_id: UUID,
    organization_id: UUID,
    offset: int | None = None,
    limit: int | None = None,
) -> list[MCPServerBundle]:
    statement = (
        select(MCPServerBundle)
        .where(
            MCPServerBundle.user_id == user_id, MCPServerBundle.organization_id == organization_id
        )
        .order_by(MCPServerBundle.created_at.desc())
    )
    if offset is not None:
        statement = statement.offset(offset)
    if limit is not None:
        statement = statement.limit(limit)
    return list(db_session.execute(statement).scalars().all())


def delete_mcp_server_bundle(
    db_session: Session,
    mcp_server_bundle_id: UUID,
) -> None:
    statement = delete(MCPServerBundle).where(MCPServerBundle.id == mcp_server_bundle_id)
    db_session.execute(statement)


def get_mcp_server_configurations_of_mcp_server_bundle(
    db_session: Session,
    mcp_server_bundle: MCPServerBundle,
) -> list[MCPServerConfiguration]:
    statement = select(MCPServerConfiguration).where(
        MCPServerConfiguration.id.in_(mcp_server_bundle.mcp_server_configuration_ids)
    )
    return list(db_session.execute(statement).scalars().all())
