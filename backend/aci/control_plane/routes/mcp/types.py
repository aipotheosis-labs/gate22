from typing import Annotated, Any, Literal

from mcp import types as mcp_types
from pydantic import BaseModel, ConfigDict, Field


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
