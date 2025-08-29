import time
from collections.abc import AsyncGenerator
from typing import Annotated, Any, Literal
from uuid import UUID

import httpx
from fastapi import APIRouter, Depends, Header, status
from mcp import ClientSession
from mcp import types as mcp_types
from mcp.client.streamable_http import streamablehttp_client
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import (
    MCPServer,
    MCPServerBundle,
    MCPServerConfiguration,
)
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import (
    APIKeyConfig,
    APIKeyCredentials,
    AuthConfig,
    AuthCredentials,
    NoAuthConfig,
    NoAuthCredentials,
    OAuth2Config,
    OAuth2Credentials,
)
from aci.common.schemas.mcp_tool import MCPToolMetadata
from aci.control_plane import auth_credentials_manager as acm
from aci.control_plane import dependencies as deps

# TODO: move exceptions to a central location?
from aci.control_plane.exceptions import (
    MCPServerNotConfigured,
    MCPToolNotEnabled,
    MCPToolNotFound,
)

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
    # TODO: slight modification to the mcp_types.CallToolRequestParams
    # might need to change back if we want to support direct tool call without going through the
    # "EXECUTE_TOOL" tool
    class CallToolRequestParams(mcp_types.RequestParams):
        """Parameters for calling a tool."""

        name: str
        arguments: dict[str, Any]
        model_config = ConfigDict(extra="allow")

    jsonrpc: Literal["2.0"] = "2.0"
    id: int | str
    method: Literal["tools/call"]
    # TODO: use more mcp sdk types like CallToolRequestParams for the rest of the types
    params: CallToolRequestParams


class JSONRPCNotificationInitialized(BaseModel):
    jsonrpc: Literal["2.0"] = "2.0"
    method: Literal["notifications/initialized"]
    params: dict = Field(default_factory=dict)


# TODO: use RootModel?
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
            match body.params.name:
                case "SEARCH_TOOLS":
                    logger.info(f"Received SEARCH_TOOLS request, arguments={body.params.arguments}")
                    return JSONRPCSuccessResponse(
                        id=body.id,
                        result={},
                    )
                case "EXECUTE_TOOL":
                    logger.info(f"Received EXECUTE_TOOL request, arguments={body.params.arguments}")
                    arguments = body.params.arguments
                    tool_name: str | None = arguments.get("tool_name")
                    tool_arguments: dict | None = arguments.get("tool_arguments")
                    if tool_name is None or tool_arguments is None:
                        logger.error(
                            f"Invalid tool arguments for EXECUTE_TOOL, tool_name={tool_name}, tool_arguments={tool_arguments}"  # noqa: E501
                        )
                        return JSONRPCErrorResponse(
                            id=body.id,
                            error={
                                "code": -32602,
                                "message": "Invalid tool arguments for EXECUTE_TOOL",
                            },
                        )
                    try:
                        tool_call_result = await handle_execute_tool(
                            db_session,
                            mcp_server_bundle,
                            tool_name,
                            tool_arguments,
                        )
                        return JSONRPCSuccessResponse(
                            id=body.id,
                            result=tool_call_result.model_dump(),
                        )
                    # TODO: catch specific errors and use more specific error code?
                    except Exception as e:
                        logger.exception("Error executing tool")
                        return JSONRPCErrorResponse(
                            id=body.id,
                            error={
                                "code": -32603,
                                "message": str(e),
                            },
                        )
                case _:
                    logger.error(f"Unknown tool: {body.params.name}")
                    return JSONRPCErrorResponse(
                        id=body.id,
                        error={
                            "code": -32601,
                            "message": f"Unknown tool: {body.params.name}",
                        },
                    )

        case JSONRPCNotificationInitialized():
            # NOTE: no-op for initialized notifications
            logger.info(f"Received initialized notification={body.model_dump()}")
            return None


# TODO: handle direct tool call that is not through the "EXECUTE_TOOL" tool


# TODO: for now the MCPAuthManager is somewhat "static", meaning it doesn't support
# refreshing token or updating refreshed token back to the database. This is fine for now because
# we create and destroy the streamablehttp_client and ClientSession for each user request.
# In the future, if we want to support long-lived connections, we need to implement a more
# sophisticated auth credentials manager that can refresh tokens and update refreshed tokens back
# to the database, similar to OAuthClientProvider from mcp python sdk.
class MCPAuthManager(httpx.Auth):
    def __init__(self, auth_config: AuthConfig, auth_credentials: AuthCredentials):
        self.auth_config = auth_config
        self.auth_credentials = auth_credentials

    async def async_auth_flow(
        self, request: httpx.Request
    ) -> AsyncGenerator[httpx.Request, httpx.Response]:
        # TODO: better way to do type narrowing?
        # TODO: for now assume only headers are supported for credentials
        if isinstance(self.auth_config.root, OAuth2Config) and isinstance(
            self.auth_credentials.root, OAuth2Credentials
        ):
            request.headers[self.auth_config.root.name] = (
                f"{self.auth_config.root.prefix} {self.auth_credentials.root.access_token}"
                if self.auth_config.root.prefix
                else self.auth_credentials.root.access_token
            )
        elif isinstance(self.auth_config.root, APIKeyConfig) and isinstance(
            self.auth_credentials.root, APIKeyCredentials
        ):
            request.headers[self.auth_config.root.name] = self.auth_credentials.root.secret_key
        elif isinstance(self.auth_config.root, NoAuthConfig) and isinstance(
            self.auth_credentials.root, NoAuthCredentials
        ):
            pass
        else:
            raise ValueError(
                f"Unsupported auth config and credentials: {self.auth_config}, {self.auth_credentials}"  # noqa: E501
            )
        yield request


async def handle_execute_tool(
    db_session: Session,
    mcp_server_bundle: MCPServerBundle,
    tool_name: str,
    tool_arguments: dict,
) -> mcp_types.CallToolResult:
    mcp_tool = crud.mcp_tools.get_mcp_tool_by_name(db_session, tool_name, False)
    if mcp_tool is None:
        logger.error(f"MCP tool not found, tool_name={tool_name}")
        raise MCPToolNotFound(tool_name)

    mcp_server = mcp_tool.mcp_server
    mcp_server_configuration: MCPServerConfiguration | None = None
    # find the mcp server configuration (from the mcp server bundle's configuration list) that is
    # the mcp server
    for mcp_server_configuration_id in mcp_server_bundle.mcp_server_configuration_ids:
        mcp_server_configuration = (
            crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
                db_session,
                mcp_server_configuration_id,
                False,
            )
        )
        if mcp_server_configuration is None:
            logger.error(
                f"MCP server configuration not found even though the id is part of the bundle, mcp_server_configuration_id={mcp_server_configuration_id}"  # noqa: E501
            )
            continue
        # TODO: this is under the assumption that the mcp server configuration is unique
        # per mcp server
        if mcp_server_configuration.mcp_server_id == mcp_server.id:
            mcp_server_configuration = mcp_server_configuration
            break

    if mcp_server_configuration is None:
        logger.error(
            f"MCP server not configured, mcp_server_id={mcp_server.id}, mcp_server_name={mcp_server.name}"  # noqa: E501
        )
        raise MCPServerNotConfigured(mcp_server.name)

    # check if this tool is enabled in the mcp server configuration
    # TODO: test
    if (
        not mcp_server_configuration.all_tools_enabled
        and mcp_tool.id not in mcp_server_configuration.enabled_tools
    ):
        logger.error(
            f"MCP tool not enabled in mcp server configuration, mcp_tool_id={mcp_tool.id}, mcp_tool_name={mcp_tool.name}"  # noqa: E501
        )
        raise MCPToolNotEnabled(mcp_tool.name)

    # Get the auth config and credentials for the mcp server configuration per user
    auth_config = acm.get_auth_config(mcp_server, mcp_server_configuration)
    # TODO: handle token refresh for oauth2 credentials
    auth_credentials = await acm.get_auth_credentials(
        db_session,
        mcp_server_bundle.user_id,
        mcp_server_configuration.id,
    )
    # TODO: need to commit because get_auth_credentials might update the auth credentials
    # consider making the logic here more explicit?
    db_session.commit()

    return await _handle_tool_call(
        name=MCPToolMetadata.model_validate(mcp_tool.tool_metadata).canonical_tool_name,
        arguments=tool_arguments,
        mcp_server=mcp_server,
        auth_config=auth_config,
        auth_credentials=auth_credentials,
    )


async def _handle_tool_call(
    name: str,
    arguments: dict,
    mcp_server: MCPServer,
    auth_config: AuthConfig,
    auth_credentials: AuthCredentials,
) -> mcp_types.CallToolResult:
    # TODO: use the correct auth type
    mcp_auth_credentials_manager = MCPAuthManager(
        auth_config=auth_config,
        auth_credentials=auth_credentials,
    )
    # TODO: support both http and sse mcp servers
    async with streamablehttp_client(mcp_server.url, auth=mcp_auth_credentials_manager) as (
        read,
        write,
        _,
    ):
        async with ClientSession(read, write) as session:
            start_time = time.time()
            await session.initialize()
            logger.info(f"Initialize took {time.time() - start_time} seconds")

            start_time = time.time()
            tools = await session.list_tools()
            logger.info(f"Listed tools took {time.time() - start_time} seconds")
            logger.info(f"Available tools: {[tool.name for tool in tools.tools]}")

            # handle tool call
            start_time = time.time()
            tool_call_response = await session.call_tool(
                name=name,
                arguments=arguments,
            )
            logger.info(f"Tool call took {time.time() - start_time} seconds")
            logger.info(tool_call_response.model_dump_json())
            return tool_call_response


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def mcp_delete() -> None:
    """
    NOTE: delete is a no-op for now.
    """
    pass
