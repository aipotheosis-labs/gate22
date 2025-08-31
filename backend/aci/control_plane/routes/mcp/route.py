from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.control_plane import dependencies as deps
from aci.control_plane.routes.mcp.jsonrpc import (
    JSONRPCErrorCode,
    JSONRPCErrorResponse,
    JSONRPCInitializeRequest,
    JSONRPCNotificationInitialized,
    JSONRPCRequest,
    JSONRPCSuccessResponse,
    JSONRPCToolsCallRequest,
    JSONRPCToolsListRequest,
)
from aci.control_plane.routes.mcp.tools.execute_tool import EXECUTE_TOOL, handle_execute_tool
from aci.control_plane.routes.mcp.tools.search_tools import SEARCH_TOOLS, handle_search_tools

logger = get_logger(__name__)
router = APIRouter()

SUPPORTED_PROTOCOL_VERSION = "2025-06-18"


# TODO: this is not a pure jsonrpc endpoint
# Unknown tools, Invalid arguments, Server errors should be handled as jsonrpc error,
# instead of http error (e.g., 400 Bad Request, 500 Internal Server Error)
@router.post("", status_code=status.HTTP_200_OK)
async def mcp_post(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    bundle_id: UUID,
    body: JSONRPCRequest,
    mcp_protocol_version: Annotated[str | None, Header()] = None,
) -> JSONRPCSuccessResponse | JSONRPCErrorResponse | None:
    logger.info(f"Received MCP request: {body.model_dump()}")

    mcp_server_bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
        db_session,
        bundle_id,
    )
    if mcp_server_bundle is None:
        logger.error(f"Bundle not found, bundle_id={bundle_id}")
        return JSONRPCErrorResponse(
            id=getattr(body, "id", None),  # Use getattr to safely get id, defaulting to None
            error=JSONRPCErrorResponse.ErrorData(
                code=-32004,
                message=f"Bundle not found, bundle_id={bundle_id}",
            ),
        )

    match body:
        case JSONRPCInitializeRequest():
            logger.info(f"Received initialize request={body.model_dump()}")
            return JSONRPCSuccessResponse(
                id=body.id,
                result={
                    "protocolVersion": SUPPORTED_PROTOCOL_VERSION
                    if mcp_protocol_version is None
                    else mcp_protocol_version,
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": "ACI.dev MCP Gateway",
                        "title": "ACI.dev MCP Gateway",
                        "version": "1.0.0",
                    },
                    # TODO: add instructions
                    "instructions": "",
                },
            )

        case JSONRPCToolsListRequest():
            logger.info(f"Received tools/list request={body.model_dump()}")
            logger.info(f"searched tools={SEARCH_TOOLS}")
            logger.info(f"executed tools={EXECUTE_TOOL}")
            return JSONRPCSuccessResponse(
                id=body.id,
                result={
                    "tools": [
                        SEARCH_TOOLS,
                        EXECUTE_TOOL,
                    ],
                },
            )

        case JSONRPCToolsCallRequest():
            logger.info(f"Received tools/call request={body.model_dump()}")
            match body.params.name:
                case "SEARCH_TOOLS":
                    return await handle_search_tools(db_session, mcp_server_bundle, body)
                case "EXECUTE_TOOL":
                    return await handle_execute_tool(db_session, mcp_server_bundle, body)
                case _:
                    logger.error(f"Unknown tool: {body.params.name}")
                    return JSONRPCErrorResponse(
                        id=body.id,
                        error=JSONRPCErrorResponse.ErrorData(
                            code=JSONRPCErrorCode.INVALID_METHOD_PARAMS,
                            message=f"Unknown tool: {body.params.name}",
                        ),
                    )

        case JSONRPCNotificationInitialized():
            # NOTE: no-op for initialized notifications
            logger.info(f"Received initialized notification={body.model_dump()}")
            return None


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def mcp_delete() -> None:
    """
    NOTE: delete is a no-op for now.
    """
    pass
