from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerBundle
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
