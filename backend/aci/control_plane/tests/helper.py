import json
import logging
from pathlib import Path

from openai import OpenAI

from aci.common import embeddings
from aci.common.schemas.mcp_server import MCPServerEmbeddingFields, MCPServerUpsert
from aci.common.schemas.mcp_tool import MCPToolEmbeddingFields, MCPToolUpsert
from aci.control_plane import config

logger = logging.getLogger(__name__)
openai_client = OpenAI(api_key=config.OPENAI_API_KEY)
DUMMY_MCP_SERVERS_DIR = Path(__file__).parent / "dummy_mcp_servers"


def prepare_mcp_servers() -> list[
    tuple[MCPServerUpsert, list[MCPToolUpsert], list[float], list[list[float]]]
]:
    """
    Prepare dummy apps and functions for testing.
    Returns a list of tuples, where each tuple contains:
    - MCPServerUpsert: the mcp server to to created in the db
    - list[MCPToolUpsert]: the mcp tools of the mcp server to to created in the db
    - list[float]: the mcp server embedding
    - list[list[float]]: the embeddings for each mcp tool
    """
    results: list[tuple[MCPServerUpsert, list[MCPToolUpsert], list[float], list[list[float]]]] = []

    for app_dir in [*DUMMY_MCP_SERVERS_DIR.glob("*")]:
        server_file = app_dir / "server.json"
        tools_file = app_dir / "tools.json"
        with open(server_file) as f:
            mcp_server_upsert: MCPServerUpsert = MCPServerUpsert.model_validate(json.load(f))
            mcp_server_embedding_fields = MCPServerEmbeddingFields.model_validate(
                mcp_server_upsert.model_dump()
            )
        with open(tools_file) as f:
            tools_upsert: list[MCPToolUpsert] = [
                MCPToolUpsert.model_validate(tool) for tool in json.load(f)
            ]
            tools_embedding_fields: list[MCPToolEmbeddingFields] = [
                MCPToolEmbeddingFields.model_validate(tool_upsert.model_dump())
                for tool_upsert in tools_upsert
            ]
        # check function names match app name
        for tool_upsert in tools_upsert:
            assert tool_upsert.name.startswith(mcp_server_upsert.name)

        mcp_server_embedding = embeddings.generate_mcp_server_embedding(
            openai_client,
            mcp_server_embedding_fields,
        )
        mcp_tool_embeddings = embeddings.generate_mcp_tool_embeddings(
            openai_client,
            tools_embedding_fields,
        )
        results.append(
            (
                mcp_server_upsert,
                tools_upsert,
                mcp_server_embedding,
                mcp_tool_embeddings,
            )
        )
    return results
