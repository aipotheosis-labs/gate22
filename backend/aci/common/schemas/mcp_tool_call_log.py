import base64
import json
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


class MCPToolCallLogCursor(BaseModel):
    """
    Internal cursor representation for time-series pagination.
    Format: base64(timestamp:uuid)
    """

    timestamp: datetime
    id: UUID

    @staticmethod
    def encode(timestamp: datetime, id: UUID) -> str:
        """Encode cursor to base64 string."""
        payload = {
            "timestamp": timestamp.isoformat(),
            "id": str(id),
        }
        return base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()

    @staticmethod
    def decode(cursor: str) -> "MCPToolCallLogCursor":
        """Decode cursor from base64 string."""
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()).decode())
        return MCPToolCallLogCursor(
            timestamp=datetime.fromisoformat(data["timestamp"]), id=UUID(data["id"])
        )
