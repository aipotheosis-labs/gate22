from openai import OpenAI
from sqlalchemy.orm import Session

from aci.common import auth_credentials_manager as acm
from aci.common import embeddings
from aci.common.db.sql_models import MCPServer
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_tool import MCPToolEmbeddingFields, MCPToolUpsert
from aci.control_plane import config
from aci.control_plane.exceptions import MCPToolsManagerError
from aci.control_plane.services.mcp_tools.mcp_tools_fetcher import MCPToolsFetcher

logger = get_logger(__name__)


openai_client = OpenAI(api_key=config.OPENAI_API_KEY)


class MCPToolsManager:
    async def refresh_mcp_tools(self, db_session: Session, mcp_server: MCPServer) -> None:
        if mcp_server.ops_account is None:
            raise MCPToolsManagerError("MCP server has no ops account")

        auth_config = acm.get_ops_account_auth_config(mcp_server.ops_account)
        auth_credentials = await acm.get_ops_account_auth_credentials(
            db_session, mcp_server.ops_account.id
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
