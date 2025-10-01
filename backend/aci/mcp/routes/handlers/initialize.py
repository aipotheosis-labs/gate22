from mcp import types as mcp_types

from aci.mcp.routes.handlers.tools.execute_tool import EXECUTE_TOOL
from aci.mcp.routes.handlers.tools.search_tools import SEARCH_TOOLS
from aci.mcp.routes.jsonrpc import (
    JSONRPCInitializeRequest,
    JSONRPCSuccessResponse,
)

SUPPORTED_PROTOCOL_VERSION = "2025-06-18"


async def handle_initialize(
    payload: JSONRPCInitializeRequest,
) -> JSONRPCSuccessResponse:
    """
    Handle the initialize request for a MCP server.
    """
    mcp_protocol_version = (
        payload.params.protocol_version
        if payload.params.protocol_version
        else SUPPORTED_PROTOCOL_VERSION
    )

    return JSONRPCSuccessResponse(
        id=payload.id,
        result=mcp_types.InitializeResult(
            protocolVersion=mcp_protocol_version,
            # NOTE: for now we don't support tools list changed
            capabilities=mcp_types.ServerCapabilities(
                tools=mcp_types.ToolsCapability(listChanged=False)
            ),
            serverInfo=mcp_types.Implementation(
                name="ACI.dev MCP Gateway", title="ACI.dev MCP Gateway", version="0.0.1"
            ),
            # TODO: add instructions (maybe dynamically based on what mcp servers are available for the bundle) # noqa: E501
            instructions=f"use {SEARCH_TOOLS.name} and {EXECUTE_TOOL.name} to discover and execute tools",  # noqa: E501
        ).model_dump(exclude_none=True),
    )
