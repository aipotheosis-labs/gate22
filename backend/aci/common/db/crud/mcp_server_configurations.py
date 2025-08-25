from uuid import UUID

from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerConfiguration
from aci.common.schemas.mcp.configuration import MCPServerConfigurationCreate


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
