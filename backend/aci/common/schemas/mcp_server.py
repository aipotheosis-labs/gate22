import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from aci.common.enums import AuthType
from aci.common.schemas.mcp_auth import AuthConfig
from aci.common.schemas.mcp_tool import MCPToolPublic


# NOTE: using a generic metadata schema for now before the schema is finalized
class MCPServerMetadata(BaseModel):
    need_session: bool = Field(
        ...,
        description="""Whether a session is required to use the mcp server,
        i.e the mcp-session-id header is required""",
    )


class MCPServerUpsert(BaseModel, extra="forbid"):
    name: str
    url: str
    description: str
    logo: str
    categories: list[str]
    auth_configs: list[AuthConfig]
    server_metadata: MCPServerMetadata

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        if not re.match(r"^[A-Z0-9_]+$", v) or "__" in v:
            raise ValueError(
                "name must be uppercase, contain only letters, numbers and underscores, and not "
                "have consecutive underscores"
            )
        return v


class MCPServerEmbeddingFields(BaseModel):
    """
    Fields used for generating the embeddings.
    """

    name: str
    url: str
    description: str
    categories: list[str]


class MCPServerPublic(BaseModel):
    id: UUID
    name: str
    url: str
    description: str
    logo: str
    categories: list[str]
    supported_auth_types: list[AuthType]

    tools: list[MCPToolPublic]

    created_at: datetime
    updated_at: datetime
