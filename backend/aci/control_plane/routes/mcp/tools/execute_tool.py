import time

from mcp import types as mcp_types
from mcp.client.session import ClientSession
from mcp.client.sse import sse_client
from mcp.client.streamable_http import streamablehttp_client
from sqlalchemy.orm import Session

from aci.common.db import crud
from aci.common.db.sql_models import MCPServer, MCPServerBundle, MCPServerConfiguration
from aci.common.enums import MCPServerTransportType
from aci.common.logging_setup import get_logger
from aci.common.schemas.mcp_auth import (
    AuthConfig,
    AuthCredentials,
)
from aci.common.schemas.mcp_tool import MCPToolMetadata
from aci.control_plane import auth_credentials_manager as acm
from aci.control_plane.exceptions import (
    MCPServerNotConfigured,
    MCPToolNotEnabled,
    MCPToolNotFound,
)
from aci.control_plane.routes.mcp.mcp_auth_manager import MCPAuthManager

logger = get_logger(__name__)

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


# TODO: handle direct tool call that is not through the "EXECUTE_TOOL" tool


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
    # TODO: abstract this logic to a service layer function
    for mcp_server_configuration_id in mcp_server_bundle.mcp_server_configuration_ids:
        mcp_server_configuration_candidate = (
            crud.mcp_server_configurations.get_mcp_server_configuration_by_id(
                db_session,
                mcp_server_configuration_id,
                False,
            )
        )
        if mcp_server_configuration_candidate is None:
            logger.error(
                f"MCP server configuration not found even though the id is part of the bundle, mcp_server_configuration_id={mcp_server_configuration_id}"  # noqa: E501
            )
            continue
        # TODO: this is under the assumption that the mcp server configuration is unique
        # per mcp server
        if mcp_server_configuration_candidate.mcp_server_id == mcp_server.id:
            mcp_server_configuration = mcp_server_configuration_candidate
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

    return await _forward_tool_call(
        name=MCPToolMetadata.model_validate(mcp_tool.tool_metadata).canonical_tool_name,
        arguments=tool_arguments,
        mcp_server=mcp_server,
        auth_config=auth_config,
        auth_credentials=auth_credentials,
    )


async def _forward_tool_call(
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
    match mcp_server.transport_type:
        case MCPServerTransportType.STREAMABLE_HTTP:
            async with streamablehttp_client(mcp_server.url, auth=mcp_auth_credentials_manager) as (
                read,
                write,
                _,
            ):
                async with ClientSession(read, write) as session:
                    return await _call_tool(session, name, arguments)

        case MCPServerTransportType.SSE:
            async with sse_client(mcp_server.url, auth=mcp_auth_credentials_manager) as (
                read,
                write,
            ):
                async with ClientSession(read, write) as session:
                    return await _call_tool(session, name, arguments)


async def _call_tool(
    session: ClientSession, name: str, arguments: dict
) -> mcp_types.CallToolResult:
    # initialize
    # TODO: conditionally initialize the session based on the mcp server?
    # many mcp servers don't support/need to initialize the session
    start_time = time.time()
    await session.initialize()
    logger.info(f"Initialize took {time.time() - start_time} seconds")

    # call tool
    start_time = time.time()
    tool_call_response = await session.call_tool(
        name=name,
        arguments=arguments,
    )
    logger.info(f"Tool call took {time.time() - start_time} seconds")
    logger.debug(tool_call_response.model_dump_json())
    return tool_call_response
