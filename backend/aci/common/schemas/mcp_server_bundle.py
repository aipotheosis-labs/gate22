from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class MCPServerBundleCreate(BaseModel):
    name: str
    description: str | None = None
    mcp_server_configuration_ids: list[UUID] = Field(..., min_length=1)


class MCPServerBundlePublic(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    user_id: UUID
    organization_id: UUID
    mcp_server_configuration_ids: list[UUID]

    created_at: datetime
    updated_at: datetime
