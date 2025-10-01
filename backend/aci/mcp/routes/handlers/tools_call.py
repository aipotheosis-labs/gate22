from sqlalchemy.orm import Session

from aci.common.db.sql_models import MCPServerBundle
from aci.common.logging_setup import get_logger
from aci.mcp.routes.handlers.tools.execute_tool import handle_execute_tool
from aci.mcp.routes.handlers.tools.search_tools import handle_search_tools
from aci.mcp.routes.jsonrpc import (
    JSONRPCErrorCode,
    JSONRPCErrorResponse,
    JSONRPCSuccessResponse,
    JSONRPCToolsCallRequest,
)

logger = get_logger(__name__)


async def handle_tools_call(
    request: JSONRPCToolsCallRequest,
    db_session: Session,
    mcp_server_bundle: MCPServerBundle,
) -> JSONRPCSuccessResponse | JSONRPCErrorResponse:
    """
    Handle the tools/call request for a MCP server bundle.
    """
    match request.params.name:
        # TODO: derive from SEARCH_TOOLS and EXECUTE_TOOL instead of string literals
        case "SEARCH_TOOLS":
            return await handle_search_tools(db_session, mcp_server_bundle, request)
        case "EXECUTE_TOOL":
            return await handle_execute_tool(db_session, mcp_server_bundle, request)
        case _:
            logger.error(f"Unknown tool: {request.params.name}")
            return JSONRPCErrorResponse(
                id=request.id,
                error=JSONRPCErrorResponse.ErrorData(
                    code=JSONRPCErrorCode.INVALID_METHOD_PARAMS,
                    message=f"Unknown tool: {request.params.name}",
                ),
            )
