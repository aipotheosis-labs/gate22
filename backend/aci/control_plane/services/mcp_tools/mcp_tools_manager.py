from sqlalchemy.orm import Session

from aci.common import auth_credentials_manager as acm
from aci.common import embeddings, mcp_tool_utils
from aci.common.db.sql_models import MCPServer
from aci.common.logging_setup import get_logger
from aci.common.openai_client import get_openai_client
from aci.common.schemas.mcp_tool import MCPToolEmbeddingFields, MCPToolMetadata, MCPToolUpsert
from aci.control_plane.exceptions import MCPToolsManagerError
from aci.control_plane.services.mcp_tools.mcp_tools_fetcher import MCPToolsFetcher

logger = get_logger(__name__)


class MCPToolsManager:
    def __init__(self, mcp_server: MCPServer):
        self.mcp_server = mcp_server

    async def refresh_mcp_tools(self, db_session: Session) -> None:
        if self.mcp_server.ops_account is None:
            raise MCPToolsManagerError("MCP server has no ops account")

        auth_config = acm.get_ops_account_auth_config(self.mcp_server.ops_account)
        auth_credentials = await acm.get_ops_account_auth_credentials(
            db_session, self.mcp_server.ops_account.id
        )

        # Fetch the tools
        fetcher = MCPToolsFetcher(timeout_seconds=30)
        tools = await fetcher.fetch_tools(self.mcp_server, auth_config, auth_credentials)
        logger.info(f"Fetched {len(tools)} tools")

        # Embed the tools
        mcp_tool_upserts = []
        for tool in tools:
            sanitized_name = mcp_tool_utils.sanitize_canonical_tool_name(tool.name)
            tool_name = f"{self.mcp_server.name}__{sanitized_name}"
            mcp_tool_upsert = MCPToolUpsert(
                name=tool_name,
                description=tool.description if tool.description is not None else "",
                input_schema=tool.inputSchema,
                tags=[],
                tool_metadata=MCPToolMetadata(
                    canonical_tool_name=tool.name,
                    canonical_tool_description_hash=mcp_tool_utils.normalize_and_hash_content(
                        tool.description
                    )
                    if tool.description is not None
                    else "",
                    canonical_tool_input_schema_hash=mcp_tool_utils.normalize_and_hash_content(
                        tool.inputSchema
                    ),
                ),
            )
            logger.info(f"MCP tool: {tool_name} --> {mcp_tool_upsert.name}")
            mcp_tool_upserts.append(mcp_tool_upsert)

        embeddings.generate_mcp_tool_embeddings(
            get_openai_client(),
            [
                MCPToolEmbeddingFields.model_validate(mcp_tool.model_dump())
                for mcp_tool in mcp_tool_upserts
            ],
        )
