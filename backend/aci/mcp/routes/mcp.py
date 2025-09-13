from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.mcp import dependencies as deps
from aci.mcp.exceptions import InvalidJSONRPCPayloadError, UnsupportedJSONRPCMethodError
from aci.mcp.routes.jsonrpc import (
    JSONRPCErrorCode,
    JSONRPCErrorResponse,
    JSONRPCInitializeRequest,
    JSONRPCNotificationInitialized,
    JSONRPCPayload,
    JSONRPCPingRequest,
    JSONRPCSuccessResponse,
    JSONRPCToolsCallRequest,
    JSONRPCToolsListRequest,
)
from aci.mcp.routes.tools.execute_tool import EXECUTE_TOOL, handle_execute_tool
from aci.mcp.routes.tools.search_tools import SEARCH_TOOLS, handle_search_tools

logger = get_logger(__name__)
router = APIRouter()

SUPPORTED_PROTOCOL_VERSION = "2025-06-18"


# TODO: this is not a pure jsonrpc endpoint
# Unknown tools, Invalid arguments, Server errors should be handled as jsonrpc error,
# instead of http error (e.g., 400 Bad Request, 500 Internal Server Error)
@router.post("", status_code=status.HTTP_200_OK)
async def mcp_post(
    db_session: Annotated[Session, Depends(deps.yield_db_session)],
    request: Request,
    response: Response,
    bundle_id: UUID,
    mcp_protocol_version: Annotated[str | None, Header()] = None,
) -> JSONRPCSuccessResponse | JSONRPCErrorResponse | None:
    # parse payload
    try:
        payload = await _parse_payload(request)
    except UnsupportedJSONRPCMethodError as e:
        logger.error(str(e))
        return JSONRPCErrorResponse(
            id=e.id,
            error=JSONRPCErrorResponse.ErrorData(
                code=JSONRPCErrorCode.METHOD_NOT_FOUND,
                message=str(e),
            ),
        )
    except InvalidJSONRPCPayloadError as e:
        logger.error(str(e))
        return JSONRPCErrorResponse(
            id=e.id,
            error=JSONRPCErrorResponse.ErrorData(
                code=JSONRPCErrorCode.INVALID_REQUEST,
                message=str(e),
            ),
        )
    except Exception as e:
        logger.exception(f"Unexpected error parsing payload: {e}")
        return JSONRPCErrorResponse(
            # In jsonrpc, id is required in response, if unable to to detect, it must be Nullable
            id=None,
            error=JSONRPCErrorResponse.ErrorData(
                code=JSONRPCErrorCode.PARSE_ERROR,
                message=str(e),
            ),
        )

    mcp_server_bundle = crud.mcp_server_bundles.get_mcp_server_bundle_by_id(
        db_session,
        bundle_id,
    )
    if mcp_server_bundle is None:
        logger.error(f"Bundle not found, bundle_id={bundle_id}")
        return JSONRPCErrorResponse(
            id=payload.id if not isinstance(payload, JSONRPCNotificationInitialized) else None,
            error=JSONRPCErrorResponse.ErrorData(
                code=JSONRPCErrorCode.INVALID_REQUEST,
                message=f"Bundle not found, bundle_id={bundle_id}",
            ),
        )

    match payload:
        case JSONRPCInitializeRequest():
            logger.info(f"Received initialize request={payload.model_dump()}")
            return JSONRPCSuccessResponse(
                id=payload.id,
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

        case JSONRPCToolsListRequest():
            logger.info(f"Received tools/list request={payload.model_dump()}")
            return JSONRPCSuccessResponse(
                id=payload.id,
                result={
                    "tools": [
                        SEARCH_TOOLS,
                        EXECUTE_TOOL,
                    ],
                },
            )

        case JSONRPCToolsCallRequest():
            logger.info(f"Received tools/call request={payload.model_dump()}")
            match payload.params.name:
                # TODO: derive from SEARCH_TOOLS and EXECUTE_TOOL instead of string literals
                case "SEARCH_TOOLS":
                    return await handle_search_tools(db_session, mcp_server_bundle, payload)
                case "EXECUTE_TOOL":
                    return await handle_execute_tool(db_session, mcp_server_bundle, payload)
                case _:
                    logger.error(f"Unknown tool: {payload.params.name}")
                    return JSONRPCErrorResponse(
                        id=payload.id,
                        error=JSONRPCErrorResponse.ErrorData(
                            code=JSONRPCErrorCode.INVALID_METHOD_PARAMS,
                            message=f"Unknown tool: {payload.params.name}",
                        ),
                    )

        case JSONRPCNotificationInitialized():
            # NOTE: no-op for initialized notifications
            logger.info(f"Received initialized notification={payload.model_dump()}")
            # NOTE: it's important to return 202 otherwise some clients will not handle the response
            response.status_code = status.HTTP_202_ACCEPTED
            return None

        case JSONRPCPingRequest():
            logger.info(f"Received ping request={payload.model_dump()}")
            return JSONRPCSuccessResponse(
                id=payload.id,
                result={},
            )


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def mcp_delete() -> None:
    """
    NOTE: delete is a no-op for now.
    """
    pass


# NOTE: for now we don't support sse stream feature so for GET return 405
@router.get("", status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
async def mcp_get() -> None:
    """
    NOTE: get is not allowed for now.
    """
    pass


async def _parse_payload(
    request: Request,
) -> (
    JSONRPCInitializeRequest
    | JSONRPCToolsListRequest
    | JSONRPCToolsCallRequest
    | JSONRPCNotificationInitialized
    | JSONRPCPingRequest
):
    payload = await request.json()
    if isinstance(payload, dict):
        try:
            jprc_payload = JSONRPCPayload.model_validate(payload)
        except ValidationError as e:
            raise InvalidJSONRPCPayloadError(f"Invalid payload: {e}", payload.get("id")) from e

        match jprc_payload.method:
            case "initialize":
                try:
                    return JSONRPCInitializeRequest.model_validate(payload)
                except ValidationError as e:
                    raise InvalidJSONRPCPayloadError(
                        f"Invalid initialize request: {e}", jprc_payload.id
                    ) from e
            case "tools/list":
                try:
                    return JSONRPCToolsListRequest.model_validate(payload)
                except ValidationError as e:
                    raise InvalidJSONRPCPayloadError(
                        f"Invalid tools/list request: {e}", jprc_payload.id
                    ) from e
            case "tools/call":
                try:
                    return JSONRPCToolsCallRequest.model_validate(payload)
                except ValidationError as e:
                    raise InvalidJSONRPCPayloadError(
                        f"Invalid tools/call request: {e}", jprc_payload.id
                    ) from e
            case "notifications/initialized":
                try:
                    return JSONRPCNotificationInitialized.model_validate(payload)
                except ValidationError as e:
                    raise InvalidJSONRPCPayloadError(
                        f"Invalid notifications/initialized request: {e}", jprc_payload.id
                    ) from e
            case "ping":
                try:
                    return JSONRPCPingRequest.model_validate(payload)
                except ValidationError as e:
                    raise InvalidJSONRPCPayloadError(
                        f"Invalid ping request: {e}", jprc_payload.id
                    ) from e
            case _:
                raise UnsupportedJSONRPCMethodError(jprc_payload.method, jprc_payload.id)
    else:
        raise InvalidJSONRPCPayloadError(f"Invalid payload type: {type(payload)}")
