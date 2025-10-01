from aci.mcp.routes.handlers.tools.execute_tool import EXECUTE_TOOL
from aci.mcp.routes.handlers.tools.search_tools import SEARCH_TOOLS
from aci.mcp.routes.jsonrpc import (
    JSONRPCSuccessResponse,
    JSONRPCToolsListRequest,
)


async def handle_tools_list(
    request: JSONRPCToolsListRequest,
) -> JSONRPCSuccessResponse:
    """
    Handle the tools/list request for a MCP server.
    """

    return JSONRPCSuccessResponse(
        id=request.id,
        result={
            "tools": [
                SEARCH_TOOLS,
                EXECUTE_TOOL,
            ],
        },
    )
