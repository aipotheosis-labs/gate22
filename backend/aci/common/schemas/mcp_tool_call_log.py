from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from aci.common.enums import MCPToolCallStatus


class MCPToolCallLogCreate(BaseModel):
    request_id: str
    session_id: UUID
    bundle_name: str
    bundle_id: UUID
    mcp_server_name: str | None = None
    mcp_server_id: UUID | None = None
    mcp_tool_name: str | None = None
    mcp_tool_id: UUID | None = None
    mcp_server_configuration_name: str | None = None
    mcp_server_configuration_id: UUID | None = None
    arguments: str | None = None
    result: dict
    status: MCPToolCallStatus
    duration_ms: int
    via_execute_tool: bool
    jsonrpc_payload: dict

    model_config = ConfigDict(extra="forbid")


class MCPToolCallLogResponse(BaseModel):
    id: UUID
    request_id: str
    session_id: UUID
    bundle_name: str
    bundle_id: UUID
    mcp_server_name: str | None = None
    mcp_server_id: UUID | None = None
    mcp_tool_name: str | None = None
    mcp_tool_id: UUID | None = None
    mcp_server_configuration_name: str | None = None
    mcp_server_configuration_id: UUID | None = None
    arguments: str | None = None
    result: dict
    status: MCPToolCallStatus
    duration_ms: int
    via_execute_tool: bool
    jsonrpc_payload: dict

    created_at: datetime
    updated_at: datetime
