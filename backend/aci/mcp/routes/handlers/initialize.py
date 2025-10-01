from aci.mcp.routes.handlers.tools.execute_tool import EXECUTE_TOOL
from aci.mcp.routes.handlers.tools.search_tools import SEARCH_TOOLS
from aci.mcp.routes.jsonrpc import (
    JSONRPCInitializeRequest,
    JSONRPCSuccessResponse,
)

SUPPORTED_PROTOCOL_VERSION = "2025-06-18"


async def handle_initialize(
    request: JSONRPCInitializeRequest,
    mcp_protocol_version: str | None,
) -> JSONRPCSuccessResponse:
    """
    Handle the initialize request for a MCP server.
    """
    return JSONRPCSuccessResponse(
        id=request.id,
        result={
            "protocolVersion": SUPPORTED_PROTOCOL_VERSION
            if mcp_protocol_version is None
            else mcp_protocol_version,
            "capabilities": {"tools": {}},
            "serverInfo": {
                "name": "ACI.dev MCP Gateway",
                "title": "ACI.dev MCP Gateway",
                "version": "0.0.1",
            },
            # TODO: add instructions
            "instructions": f"use {SEARCH_TOOLS.get('name')} and {EXECUTE_TOOL.get('name')} to discover and execute tools",  # noqa: E501
        },
    )
