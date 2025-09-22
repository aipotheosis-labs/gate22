from openai import OpenAI
from sqlalchemy.orm import Session

from aci.common import auth_credentials_manager as acm
from aci.common import embeddings
from aci.common.db import crud
from aci.common.db.sql_models import MCPServer
from aci.common.enums import ConnectedAccountOwnership
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_tool import MCPToolEmbeddingFields, MCPToolUpsert
from aci.control_plane import config
from aci.control_plane.exceptions import MCPToolsManagerError
from aci.control_plane.services.mcp_tools.mcp_tools_fetcher import MCPToolsFetcher

logger = get_logger(__name__)


openai_client = OpenAI(api_key=config.OPENAI_API_KEY)


class MCPToolsManager:
    async def refresh_mcp_tools(self, db_session: Session, mcp_server: MCPServer) -> None:
        mcp_server_configurations = crud.mcp_server_configurations.get_mcp_server_configurations(
            db_session,
            mcp_server.id,
            connected_account_ownerships=[ConnectedAccountOwnership.OPERATIONAL],
        )
        if len(mcp_server_configurations) == 0:
            raise MCPToolsManagerError("MCP server has no operational mcp server configuration")

        auth_config = acm.get_auth_config(mcp_server, mcp_server_configurations[0])
        auth_credentials = await acm.get_auth_credentials(
            db_session, mcp_server_configurations[0].id, ConnectedAccountOwnership.OPERATIONAL
        )

        # Fetch the tools
        fetcher = MCPToolsFetcher(timeout_seconds=30)
        tools = await fetcher.fetch_tools(mcp_server, auth_config, auth_credentials)
        logger.info(f"Fetched {len(tools)} tools")

        # Embed the tools
        mcp_tool_upserts = [MCPToolUpsert.model_validate(tool) for tool in tools]
        embeddings.generate_mcp_tool_embeddings(
            openai_client,
            [
                MCPToolEmbeddingFields.model_validate(mcp_tool.model_dump())
                for mcp_tool in mcp_tool_upserts
            ],
        )
