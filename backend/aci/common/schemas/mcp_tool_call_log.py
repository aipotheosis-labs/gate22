from dataclasses import dataclass
from uuid import UUID

from pydantic import BaseModel

from aci.common.enums import MCPToolCallStatus


class MCPToolCallLogCreate(BaseModel):
    request_id: str
    session_id: UUID
    bundle_name: str
    mcp_server_name: str
    mcp_tool_name: str
    arguments: dict
    result: dict
    status: MCPToolCallStatus
    via_execute_tool: bool
    bundle_id: UUID
    mcp_server_id: UUID
    mcp_tool_id: UUID


@dataclass
class MCPToolCallLogData:
    """
    Data object that accumulates data during tool execution for logging purposes.
    Fields are populated progressively as the tool call is processed.
    """

    request_id: str
    session_id: UUID
    bundle_name: str
    bundle_id: UUID
    via_execute_tool: bool
    jsonrpc_payload: dict

    # Below fields are populated progressively as the tool call is processed.
    mcp_server_name: str | None = None
    mcp_server_id: UUID | None = None
    mcp_tool_name: str | None = None
    mcp_tool_id: UUID | None = None
    mcp_server_configuration_name: str | None = None
    mcp_server_configuration_id: UUID | None = None
    arguments: str | None = None
    result: dict | None = None
    status: MCPToolCallStatus | None = None
    duration_ms: int | None = None

    def to_log_dict(self) -> dict:
        """
        Convert context to dictionary suitable for MCPToolCallLogCreate.
        Uses available data even if execution failed partway through.
        """
        return {}
