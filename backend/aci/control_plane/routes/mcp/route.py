from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.logging_setup import get_logger
from aci.control_plane import dependencies as deps

logger = get_logger(__name__)
router = APIRouter()

SUPPORTED_PROTOCOL_VERSION = "2025-06-18"


SEARCH_TOOLS = {
    "name": "SEARCH_TOOLS",
    "description": "This tool allows you to find relevant tools and their schemas that can help complete your tasks.",  # noqa: E501
    "inputSchema": {
        "type": "object",
        "properties": {
            "intent": {
                "type": "string",
                "description": "Use this to find relevant tools you might need. Returned results of this "  # noqa: E501
                "tool will be sorted by relevance to the intent.",
            },
            "limit": {
                "type": "integer",
                "default": 100,
                "description": "The maximum number of tools to return from the search per response.",  # noqa: E501
                "minimum": 1,
            },
            "offset": {
                "type": "integer",
                "default": 0,
                "minimum": 0,
                "description": "Pagination offset.",
            },
        },
        "required": [],
        "additionalProperties": False,
    },
}

EXECUTE_TOOL = {
    "name": "EXECUTE_TOOL",
    "description": "Execute a specific retrieved tool. Provide the executable tool name, and the "
    "required tool parameters for that tool based on tool definition retrieved.",
    "inputSchema": {
        "type": "object",
        "properties": {
            "tool_name": {
                "type": "string",
                "description": "The name of the tool to execute",
            },
            "tool_arguments": {
                "type": "object",
                "description": "A dictionary containing key-value pairs of input parameters required by the "  # noqa: E501
                "specified tool. The parameter names and types must match those defined in "
                "the tool definition previously retrieved. If the tool requires no "
                "parameters, provide an empty object.",
                "additionalProperties": True,
            },
        },
        "required": ["tool_name", "tool_arguments"],
        "additionalProperties": False,
    },
}


class JSONRPCInitializeRequest(BaseModel):
    class InitializeParams(BaseModel):
        protocol_version: str = Field(alias="protocolVersion")
        # TODO: use a more specific type for capabilities and clientInfo?
        capabilities: dict = Field(default_factory=dict)
        client_info: dict = Field(default_factory=dict, alias="clientInfo")

    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    method: Literal["initialize"]
    params: InitializeParams


class JSONRPCToolsListRequest(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    method: Literal["tools/list"]


class JSONRPCToolsCallRequest(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    method: Literal["tools/call"]
    params: dict = Field(default_factory=dict)


class JSONRPCNotificationInitialized(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    method: Literal["notifications/initialized"]
    params: dict = Field(default_factory=dict)


JSONRPCRequest = Annotated[
    JSONRPCInitializeRequest
    | JSONRPCToolsListRequest
    | JSONRPCToolsCallRequest
    | JSONRPCNotificationInitialized,
    Field(discriminator="method"),
]


class JSONRPCSuccessResponse(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    result: dict = Field(default_factory=dict)


class JSONRPCErrorResponse(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str | None = None
    error: dict = Field(default_factory=dict)


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
            error={
                "code": -32004,
                "message": f"Bundle not found, bundle_id={bundle_id}",
            },
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
            params = body.params
            match params.get("name"):
                case "SEARCH_TOOLS":
                    logger.info(
                        f"Received SEARCH_TOOLS request, arguments={params.get('arguments')}"
                    )
                    return JSONRPCSuccessResponse(
                        id=body.id,
                        result={},
                    )
                case "EXECUTE_TOOL":
                    logger.info(
                        f"Received EXECUTE_TOOL request, arguments={params.get('arguments')}"
                    )
                    return JSONRPCSuccessResponse(
                        id=body.id,
                        result={},
                    )
                case _:
                    logger.error(f"Unknown tool: {params.get('name')}")
                    return JSONRPCErrorResponse(
                        id=body.id,
                        error={
                            "code": -32601,
                            "message": f"Unknown tool: {params.get('name')}",
                        },
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
